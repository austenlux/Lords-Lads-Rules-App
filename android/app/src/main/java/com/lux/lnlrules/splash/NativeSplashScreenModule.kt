package com.lux.lnlrules.splash

import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import java.util.concurrent.atomic.AtomicBoolean

/**
 * JS calls NativeModules.NativeSplashScreen.dismiss() on first render.
 * This sets splashReady=true, releasing the setKeepOnScreenCondition in
 * MainActivity so the system splash exits instantly via setOnExitAnimationListener.
 * At that point the JS Animated.View overlay (already at opacity=1) is visible.
 */
class NativeSplashScreenModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = NAME

    @ReactMethod
    fun dismiss() {
        splashReady.set(true)
    }

    companion object {
        const val NAME = "NativeSplashScreen"
        val splashReady = AtomicBoolean(false)
    }
}
