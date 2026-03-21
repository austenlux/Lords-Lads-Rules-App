package com.lux.lnlrules

import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.UiThreadUtil

class SplashScreenModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "NativeSplashScreen"

    @ReactMethod
    fun hide() {
        val activity = currentActivity ?: return
        UiThreadUtil.runOnUiThread {
            SplashOverlay.hide(activity)
        }
    }
}
