package com.lux.lnlrules.voiceassistant

import com.facebook.react.TurboReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.model.ReactModuleInfo
import com.facebook.react.module.model.ReactModuleInfoProvider
import com.lux.lnlrules.BuildConfig

/**
 * Registers [VoiceAssistantModule] with the React Native runtime.
 *
 * Extends [TurboReactPackage] so the module is exposed as a TurboModule
 * when New Architecture is enabled, and falls back gracefully to the
 * legacy bridge on older builds.
 */
class VoiceAssistantPackage : TurboReactPackage() {

    override fun getModule(name: String, reactContext: ReactApplicationContext): NativeModule? =
        if (name == VoiceAssistantModule.NAME) VoiceAssistantModule(reactContext) else null

    override fun getReactModuleInfoProvider(): ReactModuleInfoProvider =
        ReactModuleInfoProvider {
            mapOf(
                VoiceAssistantModule.NAME to ReactModuleInfo(
                    VoiceAssistantModule.NAME,
                    VoiceAssistantModule.NAME,
                    false,  // canOverrideExistingModule
                    false,  // needsEagerInit
                    false,  // isCxxModule
                    BuildConfig.IS_NEW_ARCHITECTURE_ENABLED,  // isTurboModule
                )
            )
        }
}
