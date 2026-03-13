import AVFoundation
import Speech
import os.log

#if canImport(FoundationModels)
import FoundationModels
#endif

private let vaLog = OSLog(subsystem: "com.lux.lnlrules", category: "VoiceAssistant")

// MARK: - Event Delegate

@objc protocol VoiceAssistantEventDelegate: AnyObject {
    func onSpeechPartialResults(_ value: String)
    func onSpeechFinalResults(_ value: String)
    func onAIChunkReceived(_ chunk: String)
    func onDownloadProgress(_ bytesDownloaded: Double)
    func onTTSFinished()
}

// MARK: - VoiceAssistantSwift

@objcMembers
class VoiceAssistantSwift: NSObject {

    weak var eventDelegate: VoiceAssistantEventDelegate?

    // MARK: STT (lazy to avoid init-time crashes)

    private lazy var speechRecognizer: SFSpeechRecognizer? = {
        SFSpeechRecognizer(locale: Locale(identifier: "en-US"))
    }()
    private var recognitionRequest: SFSpeechAudioBufferRecognitionRequest?
    private var recognitionTask: SFSpeechRecognitionTask?
    private lazy var audioEngine: AVAudioEngine = {
        AVAudioEngine()
    }()
    private var listeningResolve: ((String) -> Void)?
    private var listeningReject: ((String, String) -> Void)?

    // MARK: TTS (lazy to avoid init-time crashes)

    private lazy var synthesizer: AVSpeechSynthesizer = {
        let synth = AVSpeechSynthesizer()
        synth.delegate = self
        return synth
    }()
    private var selectedVoiceIdentifier: String?

    private var pendingTtsCount = 0
    private var generationComplete = false
    private let completionLock = NSLock()

    // MARK: Thinking Sound (lazy to avoid init-time crashes)

    private lazy var thinkingSound: ThinkingSoundPlayer = {
        ThinkingSoundPlayer()
    }()
    private var thinkingSoundEnabled = true

    // MARK: Inference

    private var activeInferenceTask: Any?

    // MARK: Init

    override init() {
        super.init()
    }

    // MARK: - Model Lifecycle

    func checkModelStatus() -> String {
        #if canImport(FoundationModels)
        os_log(.info, log: vaLog, "FoundationModels compiled in - checking iOS 26 availability")
        if #available(iOS 26, *) {
            let status = mapModelAvailability()
            os_log(.info, log: vaLog, "Model status: %{public}@", status)
            return status
        } else {
            os_log(.error, log: vaLog, "iOS 26 not available at runtime")
        }
        #else
        os_log(.error, log: vaLog, "FoundationModels NOT compiled - canImport failed")
        #endif
        return "unavailable"
    }

    func getModelDebugInfo() -> String {
        var info: [String: Any] = [:]

        let osVersion = ProcessInfo.processInfo.operatingSystemVersion
        info["iosVersion"] = "\(osVersion.majorVersion).\(osVersion.minorVersion).\(osVersion.patchVersion)"
        info["iosVersionMajor"] = osVersion.majorVersion

        #if canImport(FoundationModels)
        info["foundationModelsCompiled"] = true
        if #available(iOS 26, *) {
            info["ios26RuntimeAvailable"] = true
            let availability = SystemLanguageModel.default.availability
            switch availability {
            case .available:
                info["modelAvailability"] = "available"
            case .unavailable(let reason):
                info["modelAvailability"] = "unavailable"
                info["unavailableReason"] = String(describing: reason)
            @unknown default:
                info["modelAvailability"] = "unknown"
            }
        } else {
            info["ios26RuntimeAvailable"] = false
        }
        #else
        info["foundationModelsCompiled"] = false
        info["ios26RuntimeAvailable"] = false
        #endif

        if let data = try? JSONSerialization.data(withJSONObject: info),
           let json = String(data: data, encoding: .utf8) {
            return json
        }
        return "{}"
    }

    // MARK: - Mic Permission Status

    func getSpeechPermissionStatus() -> String {
        let status = SFSpeechRecognizer.authorizationStatus()
        switch status {
        case .authorized:
            return "granted"
        case .denied:
            return "denied"
        case .restricted:
            return "restricted"
        case .notDetermined:
            return "undetermined"
        @unknown default:
            return "undetermined"
        }
    }

    func getMicPermissionStatus() -> String {
        let status = AVAudioSession.sharedInstance().recordPermission
        switch status {
        case .granted:
            return "granted"
        case .denied:
            return "denied"
        case .undetermined:
            return "undetermined"
        @unknown default:
            return "undetermined"
        }
    }

    func requestMicPermission(
        resolve: @escaping (String) -> Void,
        reject: @escaping (String, String) -> Void
    ) {
        AVAudioSession.sharedInstance().requestRecordPermission { granted in
            DispatchQueue.main.async {
                resolve(granted ? "granted" : "denied")
            }
        }
    }

    func downloadModel(
        resolve: @escaping (String) -> Void,
        reject: @escaping (String, String) -> Void
    ) {
        #if canImport(FoundationModels)
        if #available(iOS 26, *) {
            let status = mapModelAvailability()
            if status == "available" {
                resolve("completed")
            } else {
                reject("MODEL_NOT_READY", "Model is managed by the OS. Current status: \(status). Check Apple Intelligence settings.")
            }
            return
        }
        #endif
        reject("UNAVAILABLE", "Foundation Models not available on this device")
    }

    // MARK: - Speech Recognition

    func startListening(
        resolve: @escaping (String) -> Void,
        reject: @escaping (String, String) -> Void
    ) {
        SFSpeechRecognizer.requestAuthorization { [weak self] status in
            guard let self = self else { return }
            switch status {
            case .authorized:
                break
            case .denied:
                reject("speech_denied", "Speech recognition permission denied. Enable it in Settings > Privacy & Security > Speech Recognition.")
                return
            case .restricted:
                reject("speech_restricted", "Siri & Dictation are disabled. Enable them in Settings > Apple Intelligence & Siri.")
                return
            case .notDetermined:
                reject("speech_not_determined", "Speech recognition permission not yet granted.")
                return
            @unknown default:
                reject("speech_unavailable", "Speech recognition is unavailable.")
                return
            }
            self.requestMicPermission { granted in
                guard granted else {
                    reject("insufficient_permissions", "Microphone permission denied")
                    return
                }
                DispatchQueue.main.async {
                    self.performStartListening(resolve: resolve, reject: reject)
                }
            }
        }
    }

    func stopListening() {
        DispatchQueue.main.async { [weak self] in
            self?.recognitionTask?.finish()
        }
    }

    // MARK: - Inference

    func askQuestion(
        fullPrompt: String,
        resolve: @escaping (String) -> Void,
        reject: @escaping (String, String) -> Void
    ) {
        completionLock.lock()
        pendingTtsCount = 0
        generationComplete = false
        completionLock.unlock()

        configureAudioSessionForPlayback()

        if thinkingSoundEnabled {
            thinkingSound.play()
        }

        #if canImport(FoundationModels)
        if #available(iOS 26, *) {
            performAskQuestion(fullPrompt: fullPrompt, resolve: resolve, reject: reject)
            return
        }
        #endif
        reject("UNAVAILABLE", "AI model is not available on this iOS version")
    }

    // MARK: - TTS

    func speak(text: String) {
        guard !text.trimmingCharacters(in: .whitespaces).isEmpty else { return }

        thinkingSound.stop()
        configureAudioSessionForPlayback()

        completionLock.lock()
        pendingTtsCount += 1
        completionLock.unlock()

        let utterance = AVSpeechUtterance(string: text)
        if let id = selectedVoiceIdentifier {
            utterance.voice = AVSpeechSynthesisVoice(identifier: id)
        } else {
            utterance.voice = AVSpeechSynthesisVoice(language: "en-US")
        }

        synthesizer.speak(utterance)
    }

    func stopSpeaking() {
        synthesizer.stopSpeaking(at: .immediate)
    }

    // MARK: - Kill Switch

    func stopAssistant() {
        cancelInferenceTask()

        completionLock.lock()
        pendingTtsCount = 0
        generationComplete = false
        completionLock.unlock()

        thinkingSound.stop()
        stopAudioEngine()

        DispatchQueue.main.async { [weak self] in
            guard let self = self else { return }
            self.recognitionTask?.cancel()
            self.recognitionTask = nil
            self.recognitionRequest = nil

            if let reject = self.listeningReject {
                reject("CANCELLED", "Assistant stopped by user")
            }
            self.listeningResolve = nil
            self.listeningReject = nil
        }

        synthesizer.stopSpeaking(at: .immediate)
        deactivateAudioSession()
    }

    // MARK: - Voice Selection

    func getAvailableVoices(
        resolve: @escaping (String) -> Void,
        reject: @escaping (String, String) -> Void
    ) {
        let voices = AVSpeechSynthesisVoice.speechVoices()
            .filter { $0.language.hasPrefix("en") }
            .sorted { v1, v2 in
                if v1.language != v2.language { return v1.language < v2.language }
                return v1.quality.rawValue > v2.quality.rawValue
            }

        var voiceArray: [[String: Any]] = []
        var nameCounts: [String: Int] = [:]

        for voice in voices {
            let raw = buildRawDisplayName(for: voice)
            nameCounts[raw, default: 0] += 1
        }
        var nameCounters: [String: Int] = [:]

        for voice in voices {
            let raw = buildRawDisplayName(for: voice)
            let displayName: String
            if nameCounts[raw, default: 0] > 1 {
                let n = (nameCounters[raw] ?? 0) + 1
                nameCounters[raw] = n
                displayName = "\(raw) \(n)"
            } else {
                displayName = raw
            }

            voiceArray.append([
                "id": voice.identifier,
                "name": displayName,
                "gender": detectGender(for: voice),
                "language": voice.language,
                "localeDisplay": localeDisplay(for: voice.language),
                "quality": voice.quality.rawValue,
                "qualityLabel": qualityLabel(for: voice.quality),
            ])
        }

        let currentVoiceId = selectedVoiceIdentifier ?? ""
        let result: [String: Any] = ["voices": voiceArray, "activeVoiceId": currentVoiceId]

        if let data = try? JSONSerialization.data(withJSONObject: result),
           let json = String(data: data, encoding: .utf8) {
            resolve(json)
        } else {
            resolve("{\"voices\":[],\"activeVoiceId\":\"\"}")
        }
    }

    func setVoice(voiceId: String) {
        selectedVoiceIdentifier = voiceId
    }

    func setThinkingSoundEnabled(enabled: Bool) {
        thinkingSoundEnabled = enabled
        if !enabled { thinkingSound.stop() }
    }

    func markSpeechQueueComplete() {
        completionLock.lock()
        generationComplete = true
        let shouldFire = pendingTtsCount <= 0
        completionLock.unlock()

        if shouldFire {
            deactivateAudioSession()
            eventDelegate?.onTTSFinished()
        }
    }

    func invalidate() {
        stopAssistant()
    }
}

// MARK: - Private Implementation

private extension VoiceAssistantSwift {

    // MARK: Mic Permission

    func requestMicPermission(completion: @escaping (Bool) -> Void) {
        AVAudioSession.sharedInstance().requestRecordPermission { granted in
            completion(granted)
        }
    }

    // MARK: STT Implementation

    func performStartListening(
        resolve: @escaping (String) -> Void,
        reject: @escaping (String, String) -> Void
    ) {
        listeningResolve = resolve
        listeningReject = reject

        let request = SFSpeechAudioBufferRecognitionRequest()
        request.shouldReportPartialResults = true
        request.requiresOnDeviceRecognition = true
        recognitionRequest = request

        recognitionTask = speechRecognizer?.recognitionTask(with: request) { [weak self] result, error in
            guard let self = self else { return }

            if let result = result {
                let text = result.bestTranscription.formattedString
                if result.isFinal {
                    self.eventDelegate?.onSpeechFinalResults(text)
                    self.stopAudioEngine()
                    self.listeningResolve?(text)
                    self.listeningResolve = nil
                    self.listeningReject = nil
                } else {
                    self.eventDelegate?.onSpeechPartialResults(text)
                }
            }

            if let error = error {
                self.stopAudioEngine()
                let nsError = error as NSError
                let isCancellation = nsError.domain == "kAFAssistantErrorDomain" && nsError.code == 216
                if !isCancellation {
                    self.listeningReject?("SPEECH_ERROR", error.localizedDescription)
                    self.listeningResolve = nil
                    self.listeningReject = nil
                }
            }
        }

        let inputNode = audioEngine.inputNode
        let recordingFormat = inputNode.outputFormat(forBus: 0)
        inputNode.installTap(onBus: 0, bufferSize: 1024, format: recordingFormat) { [weak self] buffer, _ in
            self?.recognitionRequest?.append(buffer)
        }

        do {
            let session = AVAudioSession.sharedInstance()
            try session.setCategory(.playAndRecord, options: [.duckOthers, .defaultToSpeaker])
            try session.setActive(true, options: .notifyOthersOnDeactivation)
            audioEngine.prepare()
            try audioEngine.start()
        } catch {
            reject("AUDIO_ERROR", error.localizedDescription)
            listeningResolve = nil
            listeningReject = nil
        }
    }

    func stopAudioEngine() {
        audioEngine.stop()
        audioEngine.inputNode.removeTap(onBus: 0)
        recognitionRequest?.endAudio()
        recognitionRequest = nil
        recognitionTask = nil
    }

    // MARK: Inference Implementation

    #if canImport(FoundationModels)
    @available(iOS 26, *)
    func performAskQuestion(
        fullPrompt: String,
        resolve: @escaping (String) -> Void,
        reject: @escaping (String, String) -> Void
    ) {
        let task = Task { [weak self] in
            guard let self = self else { return }
            do {
                let session = LanguageModelSession()
                var fullResponse = ""

                let stream = session.streamResponse(to: fullPrompt)
                for try await partialResult in stream {
                    if Task.isCancelled { break }
                    let chunk = partialResult.content
                    let newText = String(chunk.dropFirst(fullResponse.count))
                    if !newText.isEmpty {
                        fullResponse = chunk
                        let captured = newText
                        DispatchQueue.main.async {
                            self.eventDelegate?.onAIChunkReceived(captured)
                        }
                    }
                }

                let captured = fullResponse
                DispatchQueue.main.async {
                    resolve(captured)
                }
            } catch {
                guard !Task.isCancelled else { return }
                let message = error.localizedDescription
                DispatchQueue.main.async {
                    reject("ASK_QUESTION_ERROR", message)
                }
            }
            self.activeInferenceTask = nil
        }
        activeInferenceTask = task
    }

    @available(iOS 26, *)
    func mapModelAvailability() -> String {
        let availability = SystemLanguageModel.default.availability
        switch availability {
        case .available:
            return "available"
        case .unavailable(let reason):
            switch reason {
            case .modelNotReady:
                return "not_ready"
            case .deviceNotEligible:
                return "unavailable"
            case .appleIntelligenceNotEnabled:
                return "ai_disabled"
            @unknown default:
                return "unavailable"
            }
        @unknown default:
            return "unavailable"
        }
    }
    #endif

    func cancelInferenceTask() {
        #if canImport(FoundationModels)
        if #available(iOS 26, *) {
            (activeInferenceTask as? Task<Void, Never>)?.cancel()
        }
        #endif
        activeInferenceTask = nil
    }

    // MARK: Audio Session

    func configureAudioSessionForPlayback() {
        do {
            let session = AVAudioSession.sharedInstance()
            try session.setCategory(.playAndRecord, options: [.duckOthers, .defaultToSpeaker])
            try session.setActive(true, options: .notifyOthersOnDeactivation)
        } catch { }
    }

    func deactivateAudioSession() {
        do {
            try AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
        } catch { }
    }

    // MARK: Voice Helpers

    func qualityLabel(for quality: AVSpeechSynthesisVoiceQuality) -> String {
        switch quality {
        case .premium:  return "Premium"
        case .enhanced: return "Enhanced"
        default:        return "Standard"
        }
    }

    func detectGender(for voice: AVSpeechSynthesisVoice) -> String {
        if #available(iOS 17, *) {
            switch voice.gender {
            case .female:      return "female"
            case .male:        return "male"
            case .unspecified:  return "unknown"
            @unknown default:  return "unknown"
            }
        }
        let name = voice.name.lowercased()
        let female = ["samantha", "karen", "moira", "tessa", "fiona", "victoria",
                       "ava", "allison", "susan", "kate", "nicky", "serena", "zoe"]
        let male   = ["daniel", "aaron", "fred", "tom", "alex", "oliver",
                       "liam", "james", "arthur", "gordon", "lee", "ralph", "rishi"]
        if female.contains(where: { name.contains($0) }) { return "female" }
        if male.contains(where: { name.contains($0) })   { return "male" }
        return "unknown"
    }

    func buildRawDisplayName(for voice: AVSpeechSynthesisVoice) -> String {
        let gender = detectGender(for: voice)
        let quality = qualityLabel(for: voice.quality)
        switch gender {
        case "female": return "Female · \(quality)"
        case "male":   return "Male · \(quality)"
        default:       return quality
        }
    }

    func localeDisplay(for languageTag: String) -> String {
        let components = Locale.components(fromIdentifier: languageTag)
        guard let regionCode = components["kCFLocaleCountryCodeKey"],
              regionCode.count == 2 else {
            let display = Locale(identifier: "en_US").localizedString(forIdentifier: languageTag)
            return display ?? languageTag
        }
        let flag = countryCodeToFlag(regionCode)
        let countryName = Locale(identifier: "en_US").localizedString(forRegionCode: regionCode) ?? languageTag
        return flag.isEmpty ? countryName : "\(flag) \(countryName)"
    }

    func countryCodeToFlag(_ code: String) -> String {
        let base: UInt32 = 0x1F1E6 - UInt32(UnicodeScalar("A").value)
        let chars = code.uppercased().unicodeScalars.compactMap { scalar -> String? in
            guard let flag = UnicodeScalar(base + scalar.value) else { return nil }
            return String(flag)
        }
        return chars.count == 2 ? chars.joined() : ""
    }
}

// MARK: - AVSpeechSynthesizerDelegate

extension VoiceAssistantSwift: AVSpeechSynthesizerDelegate {
    func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer, didFinish utterance: AVSpeechUtterance) {
        completionLock.lock()
        pendingTtsCount -= 1
        let shouldFire = pendingTtsCount <= 0 && generationComplete
        completionLock.unlock()

        if shouldFire {
            deactivateAudioSession()
            eventDelegate?.onTTSFinished()
        }
    }
}
