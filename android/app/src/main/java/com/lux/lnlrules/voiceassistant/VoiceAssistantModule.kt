package com.lux.lnlrules.voiceassistant

import android.content.Context
import android.content.Intent
import android.media.AudioAttributes
import android.media.AudioFocusRequest
import android.media.AudioManager
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import android.speech.tts.Voice
import android.util.Log
import androidx.annotation.RequiresApi
import org.json.JSONArray
import org.json.JSONObject
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.google.mlkit.genai.common.DownloadStatus
import com.google.mlkit.genai.common.FeatureStatus
import com.google.mlkit.genai.prompt.Generation
import com.google.mlkit.genai.prompt.GenerativeModel
import com.lux.lnlrules.NativeVoiceAssistantSpec
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch
import java.util.Locale

/**
 * Full Voice-to-AI-to-Voice loop over Gemini Nano.
 *
 * ┌──────────────┐    ┌──────────────────────────┐    ┌────────────────┐
 * │ SpeechRecog. │───▶│  Gemini Nano (streaming) │───▶│ TextToSpeech   │
 * │  (Android)   │    │  generateContentStream() │    │ (QUEUE_ADD)    │
 * └──────────────┘    └──────────────────────────┘    └────────────────┘
 *
 * Events emitted to JS:
 *   onSpeechPartialResults  – live interim STT text while user speaks
 *   onSpeechFinalResults    – confirmed final STT text
 *   onAIChunkReceived       – individual streamed token chunk from Nano
 */
class VoiceAssistantModule(reactContext: ReactApplicationContext) :
    NativeVoiceAssistantSpec(reactContext) {

    // ─────────────────────────────────────────────────────────── Fields ──

    private val generativeModel: GenerativeModel by lazy { Generation.getClient() }

    // SupervisorJob: one failed child coroutine does not cancel siblings.
    private val moduleScope = CoroutineScope(SupervisorJob() + Dispatchers.Main)

    // All SpeechRecognizer calls must be made on the main thread.
    private val mainHandler = Handler(Looper.getMainLooper())

    // ── STT
    private var speechRecognizer: SpeechRecognizer? = null
    private var listeningPromise: Promise? = null

    // ── TTS
    private var tts: TextToSpeech? = null
    private var ttsReady = false

    // Active Gemini Nano inference job — cancelled by stopAssistant().
    private var activeInferenceJob: Job? = null

    // Buffer that accumulates streaming chunks until a sentence boundary is found.
    private val sentenceBuffer = StringBuilder()

    // ── Audio focus
    private val audioManager: AudioManager by lazy {
        reactApplicationContext.getSystemService(Context.AUDIO_SERVICE) as AudioManager
    }
    private var audioFocusRequest: AudioFocusRequest? = null

    // ─────────────────────────────────────────────────────── Lifecycle ──

    init {
        initTts()
    }

    override fun getName(): String = NAME

    override fun invalidate() {
        moduleScope.cancel()
        mainHandler.post {
            speechRecognizer?.destroy()
            speechRecognizer = null
        }
        tts?.shutdown()
        tts = null
        ttsReady = false
        abandonAudioFocus()
        super.invalidate()
    }

    // ────────────────────────────────────────── Model status / download ──

    override fun checkModelStatus(promise: Promise) {
        moduleScope.launch {
            try {
                val statusString = when (generativeModel.checkStatus()) {
                    FeatureStatus.AVAILABLE    -> "available"
                    FeatureStatus.DOWNLOADABLE -> "downloadable"
                    FeatureStatus.DOWNLOADING  -> "downloading"
                    FeatureStatus.UNAVAILABLE  -> "unavailable"
                    else                       -> "unavailable"
                }
                promise.resolve(statusString)
            } catch (e: Exception) {
                promise.reject("CHECK_STATUS_ERROR", e.message ?: "Unknown error", e)
            }
        }
    }

    override fun downloadModel(promise: Promise) {
        moduleScope.launch {
            try {
                var settled = false
                generativeModel.download().collect { status ->
                    if (settled) return@collect
                    when (status) {
                        is DownloadStatus.DownloadStarted  -> Unit
                        is DownloadStatus.DownloadProgress -> Unit
                        DownloadStatus.DownloadCompleted   -> {
                            settled = true
                            promise.resolve("completed")
                        }
                        is DownloadStatus.DownloadFailed   -> {
                            settled = true
                            promise.reject(
                                "DOWNLOAD_FAILED",
                                status.e.message ?: "Download failed",
                                status.e,
                            )
                        }
                    }
                }
            } catch (e: Exception) {
                promise.reject("DOWNLOAD_ERROR", e.message ?: "Unknown error", e)
            }
        }
    }

    // ─────────────────────────────────────────── Speech recognition ──

    /**
     * Starts on-device (API 31+) or system-default speech recognition.
     * Resolves with the final recognised text; partial results fire via onSpeechPartialResults.
     */
    override fun startListening(promise: Promise) {
        listeningPromise = promise
        mainHandler.post {
            if (speechRecognizer == null) {
                speechRecognizer = createSpeechRecognizer()
                speechRecognizer?.setRecognitionListener(recognitionListener)
            }
            val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
                putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
                putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true)
                putExtra(RecognizerIntent.EXTRA_PREFER_OFFLINE, true)
            }
            speechRecognizer?.startListening(intent)
        }
    }

    /**
     * Stops the recognition session. Android will still deliver final results via onResults,
     * which resolves the promise returned by startListening().
     */
    override fun stopListening() {
        mainHandler.post { speechRecognizer?.stopListening() }
    }

    private fun createSpeechRecognizer(): SpeechRecognizer =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S &&
            SpeechRecognizer.isOnDeviceRecognitionAvailable(reactApplicationContext)
        ) {
            SpeechRecognizer.createOnDeviceSpeechRecognizer(reactApplicationContext)
        } else {
            SpeechRecognizer.createSpeechRecognizer(reactApplicationContext)
        }

    private val recognitionListener = object : RecognitionListener {
        override fun onReadyForSpeech(params: Bundle?) = Unit
        override fun onBeginningOfSpeech() = Unit
        override fun onRmsChanged(rmsdB: Float) = Unit
        override fun onBufferReceived(buffer: ByteArray?) = Unit
        override fun onEndOfSpeech() = Unit
        override fun onEvent(eventType: Int, params: Bundle?) = Unit

        override fun onPartialResults(partialResults: Bundle?) {
            val text = partialResults
                ?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
                ?.firstOrNull() ?: return
            emitOnSpeechPartialResults(
                Arguments.createMap().apply { putString("value", text) }
            )
        }

        override fun onResults(results: Bundle?) {
            val text = results
                ?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
                ?.firstOrNull() ?: ""
            emitOnSpeechFinalResults(
                Arguments.createMap().apply { putString("value", text) }
            )
            listeningPromise?.resolve(text)
            listeningPromise = null
        }

        override fun onError(error: Int) {
            listeningPromise?.reject("SPEECH_ERROR", speechErrorCode(error))
            listeningPromise = null
        }
    }

    private fun speechErrorCode(error: Int): String = when (error) {
        SpeechRecognizer.ERROR_NETWORK_TIMEOUT         -> "network_timeout"
        SpeechRecognizer.ERROR_NETWORK                 -> "network_error"
        SpeechRecognizer.ERROR_AUDIO                   -> "audio_error"
        SpeechRecognizer.ERROR_SERVER                  -> "server_error"
        SpeechRecognizer.ERROR_CLIENT                  -> "client_error"
        SpeechRecognizer.ERROR_SPEECH_TIMEOUT          -> "speech_timeout"
        SpeechRecognizer.ERROR_NO_MATCH                -> "no_match"
        SpeechRecognizer.ERROR_RECOGNIZER_BUSY         -> "recognizer_busy"
        SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS -> "insufficient_permissions"
        else                                           -> "unknown_error"
    }

    // ─────────────────────────────────────────────────────── Inference ──

    /**
     * Streams a prompt (question + context) through Gemini Nano.
     *
     * Context is prepended to the prompt so Nano treats it as background knowledge.
     * Each streamed chunk is:
     *   1. Emitted to JS via onAIChunkReceived for real-time UI updates.
     *   2. Accumulated in sentenceBuffer; complete sentences are spoken immediately.
     * Resolves with the full response text when streaming finishes.
     */
    override fun askQuestion(question: String, context: String, promise: Promise) {
        activeInferenceJob = moduleScope.launch {
            try {
                val prompt = buildPrompt(question, context)
                val fullResponse = StringBuilder()
                sentenceBuffer.clear()

                generativeModel.generateContentStream(prompt).collect { chunk ->
                    val text = chunk.candidates.firstOrNull()?.text ?: return@collect
                    fullResponse.append(text)
                    emitOnAIChunkReceived(
                        Arguments.createMap().apply { putString("chunk", text) }
                    )
                    accumulateAndSpeak(text)
                }

                flushRemainingBuffer()
                promise.resolve(fullResponse.toString())
            } catch (e: Exception) {
                promise.reject("ASK_QUESTION_ERROR", e.message ?: "Unknown error", e)
            } finally {
                activeInferenceJob = null
            }
        }
    }

    /**
     * Kill switch: cancels the active Gemini Nano inference job, stops STT,
     * stops TTS playback, clears the sentence buffer, and releases audio focus.
     * Safe to call at any point in the voice loop — listening, thinking, or speaking.
     */
    override fun stopAssistant() {
        activeInferenceJob?.cancel()
        activeInferenceJob = null
        sentenceBuffer.clear()
        // Cancel any in-flight STT session and reject its promise.
        mainHandler.post {
            speechRecognizer?.cancel()
            listeningPromise?.reject("CANCELLED", "Assistant stopped by user")
            listeningPromise = null
        }
        tts?.stop()
        abandonAudioFocus()
    }

    private fun buildPrompt(question: String, context: String): String = buildString {
        if (context.isNotBlank()) {
            append(context)
            append("\n\n")
        }
        append("Question: ")
        append(question)
    }

    // ───────────────────────────────────────────────────────────── TTS ──

    /**
     * Speaks text immediately via Android TTS.
     * Uses QUEUE_ADD so streamed sentences are queued back-to-back for natural flow.
     * Requests audio focus (ducks music) before the first utterance.
     */
    override fun speak(text: String) {
        if (!ttsReady || text.isBlank()) return
        requestAudioFocus()
        tts?.speak(text, TextToSpeech.QUEUE_ADD, null, UTTERANCE_ID)
    }

    override fun stopSpeaking() {
        tts?.stop()
    }

    // ────────────────────────────────────────────────── Voice selection ──

    /**
     * Returns a JSON object:
     *   { "voices": [{ "id", "name", "language", "localeDisplay" }, …], "activeVoiceId": string }
     *
     * Includes all offline voices for every language.
     * Voices are sorted by locale then quality (high → low).
     * Display names describe gender (where detectable) and quality tier.
     * Duplicate names within the same locale get a numeric suffix.
     * activeVoiceId is the voice currently active on the TTS engine.
     */
    override fun getAvailableVoices(promise: Promise) {
        if (!ttsReady) {
            promise.resolve("{\"voices\":[],\"activeVoiceId\":\"\"}")
            return
        }
        try {
            val voices = tts?.voices
                ?.filter { !it.isNetworkConnectionRequired && it.locale.language == "en" }
                ?.sortedWith(compareBy({ it.locale.toLanguageTag() }, { -it.quality }, { it.name }))
                ?: emptyList()

            // Dedup display names within each locale group.
            val byLocale = voices.groupBy { it.locale.toLanguageTag() }
            val finalNameMap = mutableMapOf<String, String>() // id → display name

            for ((_, localeVoices) in byLocale) {
                val rawNames = localeVoices.map { buildRawVoiceDisplayName(it) }
                val nameCounters = mutableMapOf<String, Int>()
                val occurrences = rawNames.groupingBy { it }.eachCount()
                rawNames.forEachIndexed { i, raw ->
                    finalNameMap[localeVoices[i].name] = if (occurrences[raw]!! > 1) {
                        val n = (nameCounters[raw] ?: 0) + 1
                        nameCounters[raw] = n
                        "$raw $n"
                    } else raw
                }
            }

            val jsonArray = JSONArray()
            voices.forEach { voice ->
                Log.w(NAME, "VOICE id=${voice.name} | quality=${voice.quality} | locale=${voice.locale} | features=${voice.features}")
                val obj = JSONObject()
                obj.put("id", voice.name)
                obj.put("name", finalNameMap[voice.name] ?: voice.name)
                obj.put("gender", detectGender(voice))
                obj.put("language", voice.locale.toLanguageTag())
                val country = voice.locale.country
                val flag = countryCodeToFlag(country)
                val countryName = voice.locale.getDisplayCountry(Locale.ENGLISH)
                    .ifBlank { voice.locale.getDisplayName(Locale.ENGLISH) }
                obj.put("localeDisplay", if (flag.isNotEmpty()) "$flag $countryName" else countryName)
                obj.put("quality", voice.quality)
                obj.put("qualityLabel", qualityLabel(voice.quality))
                obj.put("latency", voice.latency)
                obj.put("latencyLabel", latencyLabel(voice.latency))
                obj.put("networkRequired", voice.isNetworkConnectionRequired)
                val featuresArray = JSONArray()
                voice.features.forEach { featuresArray.put(it) }
                obj.put("features", featuresArray)
                jsonArray.put(obj)
            }

            val result = JSONObject()
            result.put("voices", jsonArray)
            result.put("activeVoiceId", tts?.voice?.name ?: "")
            promise.resolve(result.toString())
        } catch (e: Exception) {
            promise.reject("VOICES_ERROR", e.message ?: "Failed to enumerate voices", e)
        }
    }

    /**
     * Sets the active TTS voice for all subsequent speak() calls.
     * No-op if TTS is not ready or the voice id is not found.
     */
    override fun setVoice(voiceId: String) {
        if (!ttsReady) return
        val voice = tts?.voices?.find { it.name == voiceId } ?: return
        tts?.voice = voice
    }

    /**
     * Derives a display name for a voice scoped within its locale group.
     * Region is omitted — callers group by locale so the section header provides that context.
     *
     * Detects gender from the voice identifier using:
     *   1. A named-voice lookup table for known Gemini/modern voice names.
     *   2. A heuristic on the segment between -x- and the next hyphen:
     *      segment contains "f" → female (e.g. sfg, tpf)
     *      segment contains "m" → male   (e.g. iom, msm00013)
     *   3. Full-ID substring fallback for explicit "female"/"male" text.
     */
    private fun detectGender(voice: Voice): String {
        val id = voice.name.lowercase()

        // Segment between -x- and the following hyphen (e.g. "sfg", "iom", "orbit").
        val xSegment = id.substringAfter("-x-", "").substringBefore("-")

        // 1. Named-voice lookup (Gemini Live voices + known legacy codes).
        val namedVoices = mapOf(
            // Gemini Live voices (user-confirmed and pitch/descriptor-based)
            "orbit"   to "male",
            "orion"   to "male",
            "pegasus" to "male",
            "dipper"  to "male",
            "eclipse" to "male",
            "lyra"    to "female",
            "ursa"    to "female",
            "nova"    to "female",
            "vega"    to "female",
            "capella" to "female",
            // Known legacy named code
            "rjs"     to "male",
        )
        namedVoices[xSegment]?.let { return it }

        // 2. Heuristic: letter indicator in the -x- segment.
        if (xSegment.isNotEmpty()) {
            if (xSegment.contains("f")) return "female"
            if (xSegment.contains("m")) return "male"
        }

        // 3. Explicit substring fallback (covers "#female_1" style IDs).
        if (id.contains("female")) return "female"
        if (id.contains("male"))   return "male"

        return "unknown"
    }

    private fun qualityLabel(quality: Int): String = when {
        quality >= Voice.QUALITY_VERY_HIGH -> "Very High ($quality)"
        quality >= Voice.QUALITY_HIGH      -> "High ($quality)"
        quality >= Voice.QUALITY_NORMAL    -> "Normal ($quality)"
        quality >= Voice.QUALITY_LOW       -> "Low ($quality)"
        else                               -> "Very Low ($quality)"
    }

    private fun latencyLabel(latency: Int): String = when {
        latency <= Voice.LATENCY_VERY_LOW  -> "Very Low ($latency)"
        latency <= Voice.LATENCY_LOW       -> "Low ($latency)"
        latency <= Voice.LATENCY_NORMAL    -> "Normal ($latency)"
        latency <= Voice.LATENCY_HIGH      -> "High ($latency)"
        else                               -> "Very High ($latency)"
    }

    private fun countryCodeToFlag(countryCode: String): String {
        if (countryCode.length != 2) return ""
        val base = 0x1F1E6 - 'A'.code
        return String(Character.toChars(countryCode[0].uppercaseChar().code + base)) +
               String(Character.toChars(countryCode[1].uppercaseChar().code + base))
    }

    private fun buildRawVoiceDisplayName(voice: Voice): String {
        val nameLower = voice.name.lowercase()

        // Gender: check the #gender_N segment common in Google TTS voice ids.
        val afterHash = nameLower.substringAfter('#', "")
        val genderSegment = if (afterHash.isNotEmpty()) afterHash.substringBefore('-') else ""
        val gender: String? = when {
            genderSegment.startsWith("female") -> "Female"
            genderSegment.startsWith("male")   -> "Male"
            nameLower.contains("female")        -> "Female"
            nameLower.contains("male")          -> "Male"
            else                                -> null
        }

        val quality = when {
            voice.quality >= Voice.QUALITY_VERY_HIGH -> "Enhanced"
            voice.quality >= Voice.QUALITY_HIGH      -> "High Quality"
            else                                     -> "Standard"
        }

        return if (gender != null) "$gender · $quality" else quality
    }

    private fun initTts() {
        tts = TextToSpeech(reactApplicationContext) { status ->
            if (status == TextToSpeech.SUCCESS) {
                tts?.language = Locale.US
                tts?.setOnUtteranceProgressListener(utteranceProgressListener)
                ttsReady = true
            }
        }
    }

    private val utteranceProgressListener = object : UtteranceProgressListener() {
        override fun onStart(utteranceId: String) = Unit
        override fun onDone(utteranceId: String) {
            // When the queue is fully drained, release audio focus and notify JS.
            if (tts?.isSpeaking == false) {
                abandonAudioFocus()
                emitOnTTSFinished(Arguments.createMap().apply { putString("status", "done") })
            }
        }
        @Deprecated("Deprecated in API 21", ReplaceWith("onError(utteranceId, errorCode)"))
        override fun onError(utteranceId: String) = abandonAudioFocus()
    }

    /**
     * Appends [chunk] to the sentence buffer.
     * When a sentence boundary (. ! ?) is detected, the complete sentence is spoken
     * immediately so TTS starts before inference is fully complete.
     */
    private fun accumulateAndSpeak(chunk: String) {
        sentenceBuffer.append(chunk)
        val text = sentenceBuffer.toString()
        val boundary = text.indexOfFirst { it == '.' || it == '!' || it == '?' }
        if (boundary >= 0) {
            val sentence = text.substring(0, boundary + 1).trim()
            sentenceBuffer.delete(0, boundary + 1)
            if (sentence.isNotEmpty()) speak(sentence)
        }
    }

    /** Speaks any remaining partial sentence after streaming is complete. */
    private fun flushRemainingBuffer() {
        val remaining = sentenceBuffer.toString().trim()
        if (remaining.isNotEmpty()) {
            speak(remaining)
            sentenceBuffer.clear()
        }
    }

    // ──────────────────────────────────────────────────── Audio focus ──

    /**
     * Requests transient audio focus with ducking.
     * Other apps (music, podcasts) lower their volume while the assistant speaks.
     * Uses the modern AudioFocusRequest API on API 26+, falls back on older devices.
     */
    private fun requestAudioFocus() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            if (audioFocusRequest == null) {
                audioFocusRequest = buildAudioFocusRequest()
            }
            audioFocusRequest?.let { audioManager.requestAudioFocus(it) }
        } else {
            @Suppress("DEPRECATION")
            audioManager.requestAudioFocus(
                null,
                AudioManager.STREAM_MUSIC,
                AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK,
            )
        }
    }

    private fun abandonAudioFocus() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            audioFocusRequest?.let { audioManager.abandonAudioFocusRequest(it) }
            audioFocusRequest = null
        } else {
            @Suppress("DEPRECATION")
            audioManager.abandonAudioFocus(null)
        }
    }

    @RequiresApi(Build.VERSION_CODES.O)
    private fun buildAudioFocusRequest(): AudioFocusRequest =
        AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK)
            .setAudioAttributes(
                AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_ASSISTANT)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                    .build()
            )
            .setOnAudioFocusChangeListener { /* ducking handled automatically by Android */ }
            .build()

    // ──────────────────────────────────────────────────────── Statics ──

    companion object {
        const val NAME = "VoiceAssistant"
        private const val UTTERANCE_ID = "va_utterance"
    }
}
