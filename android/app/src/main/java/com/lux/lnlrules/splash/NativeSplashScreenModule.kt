package com.lux.lnlrules.splash

import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import java.util.concurrent.atomic.AtomicBoolean

/**
 * Lets JS signal that it is ready to take over the screen, so the system
 * SplashScreen (held open via setKeepOnScreenCondition in MainActivity)
 * can be dismissed.  Call NativeModules.NativeSplashScreen.dismiss() as
 * early as possible in App.js — the RN overlay is already opaque at that
 * point, so the hand-off is seamless.
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

        /** Watched by MainActivity.setKeepOnScreenCondition. */
        val splashReady = AtomicBoolean(false)
    }
}
