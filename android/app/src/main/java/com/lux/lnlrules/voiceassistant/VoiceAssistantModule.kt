package com.lux.lnlrules.voiceassistant

import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.lux.lnlrules.NativeVoiceAssistantSpec

/**
 * TurboModule implementing the VoiceAssistant native interface.
 *
 * Extends the codegen-generated [NativeVoiceAssistantSpec], which is produced
 * from src/specs/NativeVoiceAssistant.ts during the Android build.
 *
 * Phase 1: skeleton only — no AI logic yet.
 * Phase 2 will add AICore / Gemini Nano inference, speech recognition, and TTS.
 */
class VoiceAssistantModule(reactContext: ReactApplicationContext) :
    NativeVoiceAssistantSpec(reactContext) {

    override fun getName(): String = NAME

    /**
     * Placeholder: will query AICore to determine Gemini Nano download status.
     * Expected return values: 'available' | 'downloading' | 'unavailable'
     */
    override fun checkModelStatus(promise: Promise) {
        promise.resolve("not_implemented")
    }

    companion object {
        const val NAME = "VoiceAssistant"
    }
}
