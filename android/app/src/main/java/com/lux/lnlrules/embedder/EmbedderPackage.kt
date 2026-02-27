package com.lux.lnlrules.embedder

import com.facebook.react.TurboReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.model.ReactModuleInfo
import com.facebook.react.module.model.ReactModuleInfoProvider
import com.lux.lnlrules.BuildConfig

/**
 * Registers [EmbedderModule] with the React Native runtime as a TurboModule.
 */
class EmbedderPackage : TurboReactPackage() {

    override fun getModule(name: String, reactContext: ReactApplicationContext): NativeModule? =
        if (name == EmbedderModule.NAME) EmbedderModule(reactContext) else null

    override fun getReactModuleInfoProvider(): ReactModuleInfoProvider =
        ReactModuleInfoProvider {
            mapOf(
                EmbedderModule.NAME to ReactModuleInfo(
                    EmbedderModule.NAME,
                    EmbedderModule.NAME,
                    false,
                    false,
                    false,
                    BuildConfig.IS_NEW_ARCHITECTURE_ENABLED,
                )
            )
        }
}
