package com.lux.lnlrules.embedder

import android.util.Log
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.google.mediapipe.tasks.core.BaseOptions
import com.google.mediapipe.tasks.text.textembedder.TextEmbedder
import com.google.mediapipe.tasks.text.textembedder.TextEmbedder.TextEmbedderOptions
import com.lux.lnlrules.NativeEmbedderSpec
import java.io.File
import java.nio.ByteBuffer

/**
 * TurboModule that wraps MediaPipe TextEmbedder for on-device semantic
 * text embedding. Used by the JS RAG layer to convert text chunks and
 * user queries into float vectors for cosine-similarity retrieval.
 *
 * The Universal Sentence Encoder model (~5.8 MB) is bundled in assets as
 * universal_sentence_encoder.tflite.
 *
 * Loading strategy: copy the model from assets to the app cache directory
 * on first use, then pass an absolute file path to MediaPipe.  This is
 * more reliable than setModelAssetPath() in release builds because the
 * file system path bypasses any APK-level asset compression checks.
 */
class EmbedderModule(reactContext: ReactApplicationContext) :
    NativeEmbedderSpec(reactContext) {

    companion object {
        const val NAME = "Embedder"
        private const val TAG = "EmbedderModule"
        private const val MODEL_ASSET = "universal_sentence_encoder.tflite"
    }

    private var embedder: TextEmbedder? = null

    // ── Lifecycle ────────────────────────────────────────────────────────────

    override fun getName(): String = NAME

    override fun invalidate() {
        embedder?.close()
        embedder = null
        super.invalidate()
    }

    // ── Public API ───────────────────────────────────────────────────────────

    /**
     * Initialises the embedder if not already loaded.
     * Safe to call multiple times — subsequent calls are instant no-ops.
     */
    override fun warmUp(promise: Promise) {
        try {
            ensureEmbedder()
            promise.resolve(null)
        } catch (e: Exception) {
            Log.e(TAG, "warmUp failed: ${e.javaClass.simpleName} — ${e.message}", e)
            promise.reject("EMBEDDER_WARMUP_ERROR", "${e.javaClass.simpleName}: ${e.message}", e)
        }
    }

    /**
     * Embeds [text] and resolves with a JS number array (float32 values).
     */
    override fun embedText(text: String, promise: Promise) {
        try {
            val emb = ensureEmbedder()
            val result = emb.embed(text)
            val floats = result.embeddingResult().embeddings().firstOrNull()
                ?.floatEmbedding()
                ?: run {
                    promise.resolve(Arguments.createArray())
                    return
                }

            val arr = Arguments.createArray()
            floats.forEach { arr.pushDouble(it.toDouble()) }
            promise.resolve(arr)
        } catch (e: Exception) {
            Log.e(TAG, "embedText failed: ${e.javaClass.simpleName} — ${e.message}", e)
            promise.reject("EMBEDDER_ERROR", "${e.javaClass.simpleName}: ${e.message}", e)
        }
    }

    // ── Private helpers ──────────────────────────────────────────────────────

    /**
     * Ensures the TextEmbedder is initialised, creating it if needed.
     *
     * Uses an absolute file path rather than an asset path so that MediaPipe
     * can open the model with normal file I/O — no memory-mapping of APK
     * assets required.  The model is copied from assets to the cache dir on
     * first use and reused on subsequent calls.
     */
    private fun ensureEmbedder(): TextEmbedder {
        embedder?.let { return it }

        val modelBuffer = loadModelBuffer()
        Log.d(TAG, "Loaded model buffer: ${modelBuffer.capacity()} bytes")

        val options = TextEmbedderOptions.builder()
            .setBaseOptions(
                BaseOptions.builder()
                    .setModelAssetBuffer(modelBuffer)
                    .build()
            )
            .setL2Normalize(true)
            .build()

        return TextEmbedder.createFromOptions(reactApplicationContext, options)
            .also { embedder = it }
    }

    /**
     * Reads [MODEL_ASSET] from the APK assets into a direct ByteBuffer.
     * Using a ByteBuffer (setModelAssetBuffer) bypasses APK asset compression
     * entirely — we read the bytes ourselves and hand them to MediaPipe.
     *
     * The buffer is cached on disk (app cache dir) after first extraction so
     * subsequent launches avoid re-reading from the APK.
     */
    private fun loadModelBuffer(): ByteBuffer {
        val dest = File(reactApplicationContext.cacheDir, MODEL_ASSET)

        // Copy from assets to cache if not already done.
        if (!dest.exists() || dest.length() == 0L) {
            reactApplicationContext.assets.open(MODEL_ASSET).use { input ->
                dest.outputStream().use { output -> input.copyTo(output) }
            }
            Log.d(TAG, "Extracted model to: ${dest.absolutePath} (${dest.length()} bytes)")
        }

        // Read the cached file into a direct ByteBuffer for MediaPipe.
        val bytes = dest.readBytes()
        val buffer = ByteBuffer.allocateDirect(bytes.size)
        buffer.put(bytes)
        buffer.rewind()
        return buffer
    }
}
