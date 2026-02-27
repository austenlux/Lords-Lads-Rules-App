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
import androidx.annotation.RequiresApi
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.google.mlkit.genai.prompt.DownloadStatus
import com.google.mlkit.genai.prompt.FeatureStatus
import com.google.mlkit.genai.prompt.Generation
import com.google.mlkit.genai.prompt.GenerativeModel
import com.lux.lnlrules.NativeVoiceAssistantSpec
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
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
        moduleScope.launch {
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
            }
        }
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
            // Release audio focus once TTS finishes all queued utterances.
            if (tts?.isSpeaking == false) abandonAudioFocus()
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
