package com.lux.lnlrules.embedder

import android.util.Log
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.google.mediapipe.tasks.core.BaseOptions
import com.google.mediapipe.tasks.text.textembedder.TextEmbedder
import com.google.mediapipe.tasks.text.textembedder.TextEmbedder.TextEmbedderOptions
import com.lux.lnlrules.NativeEmbedderSpec

/**
 * TurboModule that wraps MediaPipe TextEmbedder for on-device semantic
 * text embedding. Used by the JS RAG layer to convert text chunks and
 * user queries into float vectors for cosine-similarity retrieval.
 *
 * The Universal Sentence Encoder model (~5.8 MB) is bundled in assets as
 * universal_sentence_encoder.tflite.
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
            Log.e(TAG, "warmUp failed", e)
            promise.reject("EMBEDDER_WARMUP_ERROR", e.message, e)
        }
    }

    /**
     * Embeds [text] and resolves with a JS number array (float32 values).
     * Returns an empty array if the embedder is unavailable.
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
            Log.e(TAG, "embedText failed", e)
            promise.reject("EMBEDDER_ERROR", e.message, e)
        }
    }

    // ── Private helpers ──────────────────────────────────────────────────────

    private fun ensureEmbedder(): TextEmbedder {
        embedder?.let { return it }
        val options = TextEmbedderOptions.builder()
            .setBaseOptions(
                BaseOptions.builder()
                    .setModelAssetPath(MODEL_ASSET)
                    .build()
            )
            .setL2Normalize(true)  // Normalise so cosine similarity = dot product.
            .build()
        return TextEmbedder.createFromOptions(reactApplicationContext, options)
            .also { embedder = it }
    }
}
