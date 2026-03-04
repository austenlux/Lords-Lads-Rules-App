package com.lux.lnlrules.voiceassistant

import android.content.Context
import android.media.AudioAttributes
import android.media.MediaPlayer

/**
 * Shuffles all MP3 files in assets/audio/thinking_sounds/ and plays
 * through them sequentially. Stops after one full pass or when [stop]
 * is called (whichever comes first).
 *
 * A fresh shuffle is created on every call to [play].
 *
 * All public methods are safe to call from any thread.
 */
class ThinkingSoundPlayer(private val context: Context) {

    companion object {
        private const val SOUNDS_DIR = "audio/thinking_sounds"
    }

    @Volatile private var mediaPlayer: MediaPlayer? = null
    @Volatile private var playlist: List<String> = emptyList()
    @Volatile private var playIndex = 0
    @Volatile private var stopped = false

    private val audioAttributes = AudioAttributes.Builder()
        .setUsage(AudioAttributes.USAGE_MEDIA)
        .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC)
        .build()

    /** Shuffle all thinking sounds and begin playing through them sequentially. No-op if already playing. */
    fun play() {
        if (mediaPlayer != null) return

        val files = try {
            context.assets.list(SOUNDS_DIR)?.filter { it.endsWith(".mp3") } ?: emptyList()
        } catch (_: Exception) {
            emptyList()
        }

        if (files.isEmpty()) return

        playlist = files.shuffled()
        playIndex = 0
        stopped = false
        playCurrentTrack()
    }

    private fun playCurrentTrack() {
        if (stopped || playIndex >= playlist.size) {
            releasePlayer()
            return
        }

        try {
            val afd = context.assets.openFd("$SOUNDS_DIR/${playlist[playIndex]}")
            val player = MediaPlayer().apply {
                setAudioAttributes(audioAttributes)
                setDataSource(afd.fileDescriptor, afd.startOffset, afd.length)
                afd.close()
                setOnCompletionListener {
                    releasePlayer()
                    playIndex++
                    playCurrentTrack()
                }
                setOnErrorListener { mp, _, _ -> mp.release(); mediaPlayer = null; false }
                prepare()
                start()
            }
            mediaPlayer = player
        } catch (_: Exception) {
            mediaPlayer = null
        }
    }

    /** Stop playback immediately (e.g. when TTS begins or user cancels). */
    fun stop() {
        stopped = true
        releasePlayer()
    }

    private fun releasePlayer() {
        mediaPlayer?.let {
            try { if (it.isPlaying) it.stop() } catch (_: Exception) {}
            try { it.release() } catch (_: Exception) {}
        }
        mediaPlayer = null
    }
}
