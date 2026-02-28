package com.lux.lnlrules.voiceassistant

import android.media.AudioAttributes
import android.media.AudioFormat
import android.media.AudioTrack
import kotlin.math.PI
import kotlin.math.sin

/**
 * Generates and streams a pulsing sine-wave tone via [AudioTrack] to give
 * the user audible feedback while the AI is processing their question.
 *
 * The sound is a carrier sine wave whose amplitude is modulated by a second
 * slower sine wave (the "pulse"), producing a soft, rhythmic breathing effect.
 *
 * All public methods are thread-safe.
 *
 * @param frequencyHz    Pitch of the tone in Hz (default 440 = A4).
 * @param amplitude      Peak amplitude as a fraction of full scale (0..1).
 * @param pulseRateHz    How many pulse cycles per second (1.0 = one breath/sec).
 */
class ThinkingSoundPlayer(
    private val frequencyHz: Float = 440f,
    private val amplitude:   Float = 0.12f,
    private val pulseRateHz: Float = 1.0f,
) {
    companion object {
        private const val SAMPLE_RATE = 44_100
    }

    @Volatile private var isPlaying = false
    private var playThread: Thread? = null

    /** Start streaming the thinking tone. No-op if already playing. */
    fun start() {
        if (isPlaying) return
        isPlaying = true

        playThread = Thread({
            val bufferSize = maxOf(
                AudioTrack.getMinBufferSize(
                    SAMPLE_RATE,
                    AudioFormat.CHANNEL_OUT_MONO,
                    AudioFormat.ENCODING_PCM_16BIT,
                ),
                // Keep the buffer small so stop() is responsive.
                SAMPLE_RATE / 20,
            )

            val track = AudioTrack.Builder()
                .setAudioAttributes(
                    AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_ASSISTANCE_SONIFICATION)
                        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                        .build()
                )
                .setAudioFormat(
                    AudioFormat.Builder()
                        .setEncoding(AudioFormat.ENCODING_PCM_16BIT)
                        .setSampleRate(SAMPLE_RATE)
                        .setChannelMask(AudioFormat.CHANNEL_OUT_MONO)
                        .build()
                )
                .setBufferSizeInBytes(bufferSize * 2)
                .setTransferMode(AudioTrack.MODE_STREAM)
                .build()

            track.play()

            val buffer = ShortArray(bufferSize)
            var carrierPhase = 0.0
            var pulsePhase   = 0.0
            val carrierInc   = 2.0 * PI * frequencyHz / SAMPLE_RATE
            val pulseInc     = 2.0 * PI * pulseRateHz / SAMPLE_RATE

            while (isPlaying) {
                for (i in buffer.indices) {
                    // Pulse envelope: (sin + 1) / 2 maps to 0..1
                    val envelope = (sin(pulsePhase) + 1.0) / 2.0
                    val sample   = sin(carrierPhase) * amplitude * envelope
                    buffer[i]    = (sample * Short.MAX_VALUE).toInt().toShort()
                    carrierPhase += carrierInc
                    pulsePhase   += pulseInc
                }
                if (isPlaying) track.write(buffer, 0, buffer.size)
            }

            track.stop()
            track.release()
        }, "ThinkingSoundPlayer")

        playThread?.isDaemon = true
        playThread?.start()
    }

    /** Stop the tone. Returns immediately; the audio thread drains within one buffer. */
    fun stop() {
        isPlaying = false
        // Do not join — caller may be on the main thread; let the thread exit naturally.
    }
}
