package com.lux.lnlrules.splash

import android.os.Handler
import android.os.Looper
import android.view.View
import android.view.ViewGroup
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import java.util.concurrent.atomic.AtomicBoolean

/**
 * JS calls NativeModules.NativeSplashScreen.dismiss() on its first render.
 * This removes the native overlay that MainActivity added during onCreate(),
 * revealing the JS Animated.View overlay underneath (already at opacity=1).
 * The JS overlay then handles its own timed fade-out via SPLASH_MIN_MS.
 */
class NativeSplashScreenModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = NAME

    @ReactMethod
    fun dismiss() {
        splashReady.set(true)
        val view = overlayView ?: return
        overlayView = null
        Handler(Looper.getMainLooper()).post {
            (view.parent as? ViewGroup)?.removeView(view)
        }
    }

    companion object {
        const val NAME = "NativeSplashScreen"
        val splashReady = AtomicBoolean(false)

        /** Set by MainActivity; cleared on dismiss(). */
        var overlayView: View? = null
    }
}
