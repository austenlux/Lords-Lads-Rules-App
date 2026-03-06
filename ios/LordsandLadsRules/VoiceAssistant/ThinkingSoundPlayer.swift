import AVFoundation

/// Shuffles all MP3 files in the ThinkingSounds bundle directory and plays
/// through them sequentially. Stops after one full pass or when `stop()`
/// is called (whichever comes first).
///
/// A fresh shuffle is created on every call to `play()`.
/// All public methods are safe to call from any thread.
class ThinkingSoundPlayer: NSObject {

    private static let subdirectory = "ThinkingSounds"

    private var audioPlayer: AVAudioPlayer?
    private var playlist: [URL] = []
    private var playIndex = 0
    private var stopped = false
    private let lock = NSLock()

    /// Shuffle all thinking sounds and begin playing. No-op if already playing.
    func play() {
        lock.lock()
        defer { lock.unlock() }

        guard audioPlayer == nil else { return }

        let files = Bundle.main.urls(
            forResourcesWithExtension: "mp3",
            subdirectory: Self.subdirectory
        ) ?? []

        guard !files.isEmpty else { return }

        playlist = files.shuffled()
        playIndex = 0
        stopped = false
        playCurrentTrack()
    }

    /// Stop playback immediately (e.g. when TTS begins or user cancels).
    func stop() {
        lock.lock()
        stopped = true
        lock.unlock()
        releasePlayer()
    }

    // MARK: - Private

    private func playCurrentTrack() {
        if stopped || playIndex >= playlist.count {
            releasePlayer()
            return
        }

        do {
            let player = try AVAudioPlayer(contentsOf: playlist[playIndex])
            player.delegate = self
            player.prepareToPlay()
            player.play()
            audioPlayer = player
        } catch {
            audioPlayer = nil
        }
    }

    private func releasePlayer() {
        audioPlayer?.stop()
        audioPlayer = nil
    }
}

// MARK: - AVAudioPlayerDelegate

extension ThinkingSoundPlayer: AVAudioPlayerDelegate {
    func audioPlayerDidFinishPlaying(_ player: AVAudioPlayer, successfully flag: Bool) {
        releasePlayer()
        lock.lock()
        playIndex += 1
        let shouldContinue = !stopped && playIndex < playlist.count
        lock.unlock()
        if shouldContinue {
            playCurrentTrack()
        }
    }

    func audioPlayerDecodeErrorDidOccur(_ player: AVAudioPlayer, error: Error?) {
        releasePlayer()
    }
}
