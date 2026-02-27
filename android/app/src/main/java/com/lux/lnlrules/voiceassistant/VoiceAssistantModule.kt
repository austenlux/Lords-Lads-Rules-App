package com.lux.lnlrules.voiceassistant

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

/**
 * TurboModule implementing the VoiceAssistant native interface.
 *
 * Extends the codegen-generated [NativeVoiceAssistantSpec], produced from
 * src/specs/NativeVoiceAssistant.ts during the Android build.
 *
 * Uses Kotlin Coroutines to call the ML Kit GenAI Prompt API's suspend
 * functions and Flow-based download stream without blocking the bridge thread.
 */
class VoiceAssistantModule(reactContext: ReactApplicationContext) :
    NativeVoiceAssistantSpec(reactContext) {

    // Initialized lazily so it's created on first use, not at module construction time.
    private val generativeModel: GenerativeModel by lazy { Generation.getClient() }

    // SupervisorJob ensures one failed child coroutine doesn't cancel the others.
    private val moduleScope = CoroutineScope(SupervisorJob() + Dispatchers.Main)

    override fun getName(): String = NAME

    /**
     * Queries AICore for the current Gemini Nano download status.
     *
     * Resolves with one of: 'available' | 'downloadable' | 'downloading' | 'unavailable'
     */
    override fun checkModelStatus(promise: Promise) {
        moduleScope.launch {
            try {
                val statusString = when (generativeModel.checkStatus()) {
                    FeatureStatus.AVAILABLE     -> "available"
                    FeatureStatus.DOWNLOADABLE  -> "downloadable"
                    FeatureStatus.DOWNLOADING   -> "downloading"
                    FeatureStatus.UNAVAILABLE   -> "unavailable"
                    else                        -> "unavailable"
                }
                promise.resolve(statusString)
            } catch (e: Exception) {
                promise.reject("CHECK_STATUS_ERROR", e.message ?: "Unknown error", e)
            }
        }
    }

    /**
     * Initiates a Gemini Nano model download and resolves when complete.
     *
     * Collects the [DownloadStatus] Flow emitted by [GenerativeModel.download].
     * The promise resolves with 'completed' on success and rejects on failure.
     *
     * Note: intermediate progress events (bytes downloaded) are logged here and
     * will be forwarded to JS via DeviceEventEmitter in a later phase.
     */
    override fun downloadModel(promise: Promise) {
        moduleScope.launch {
            try {
                // Track settlement to guard against multiple resolve/reject calls
                // if the Flow emits unexpectedly after a terminal event.
                var settled = false

                generativeModel.download().collect { downloadStatus ->
                    if (settled) return@collect

                    when (downloadStatus) {
                        is DownloadStatus.DownloadStarted -> {
                            // Phase 3: emit progress event to JS
                        }
                        is DownloadStatus.DownloadProgress -> {
                            // Phase 3: emit bytes downloaded to JS
                            // downloadStatus.totalBytesDownloaded available here
                        }
                        DownloadStatus.DownloadCompleted -> {
                            settled = true
                            promise.resolve("completed")
                        }
                        is DownloadStatus.DownloadFailed -> {
                            settled = true
                            promise.reject(
                                "DOWNLOAD_FAILED",
                                downloadStatus.e.message ?: "Download failed",
                                downloadStatus.e,
                            )
                        }
                    }
                }
            } catch (e: Exception) {
                promise.reject("DOWNLOAD_ERROR", e.message ?: "Unknown error", e)
            }
        }
    }

    /**
     * Called by the React Native runtime when the module is torn down.
     * Cancels all in-flight coroutines to prevent leaks.
     */
    override fun invalidate() {
        moduleScope.cancel()
        super.invalidate()
    }

    companion object {
        const val NAME = "VoiceAssistant"
    }
}
