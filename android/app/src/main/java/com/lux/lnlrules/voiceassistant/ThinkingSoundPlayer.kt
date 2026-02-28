package com.lux.lnlrules.voiceassistant

import android.content.Context
import android.media.AudioAttributes
import android.media.MediaPlayer

/**
 * Plays a randomly selected one-shot thinking sound from the bundled
 * assets/audio/thinking_sounds/ folder while the AI is processing.
 *
 * A different file is chosen on every call to [play], keeping the
 * experience fresh across repeated interactions.
 *
 * All public methods are safe to call from any thread.
 */
class ThinkingSoundPlayer(private val context: Context) {

    companion object {
        private const val SOUNDS_DIR = "audio/thinking_sounds"
    }

    @Volatile private var mediaPlayer: MediaPlayer? = null

    /** Play a randomly chosen thinking sound. No-op if already playing. */
    fun play() {
        if (mediaPlayer != null) return

        val files = try {
            context.assets.list(SOUNDS_DIR)?.filter { it.endsWith(".mp3") } ?: emptyList()
        } catch (_: Exception) {
            emptyList()
        }

        if (files.isEmpty()) return

        val chosen = files.random()

        try {
            val afd = context.assets.openFd("$SOUNDS_DIR/$chosen")
            val player = MediaPlayer().apply {
                setAudioAttributes(
                    AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_MEDIA)
                        .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC)
                        .build()
                )
                setDataSource(afd.fileDescriptor, afd.startOffset, afd.length)
                afd.close()
                setOnCompletionListener { release(); mediaPlayer = null }
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
        mediaPlayer?.let {
            try { if (it.isPlaying) it.stop() } catch (_: Exception) {}
            try { it.release() } catch (_: Exception) {}
        }
        mediaPlayer = null
    }
}
