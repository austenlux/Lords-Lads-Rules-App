package com.lux.lnlrules

import android.content.Context
import android.content.res.Configuration
import android.os.Bundle
import android.graphics.Color
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import androidx.core.view.ViewCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsControllerCompat
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate
import com.lux.lnlrules.splash.NativeSplashScreenModule

class MainActivity : ReactActivity() {

    override fun attachBaseContext(newBase: Context) {
        val config = Configuration(newBase.resources.configuration)
        config.fontScale = 1.0f
        applyOverrideConfiguration(config)
        super.attachBaseContext(newBase)
    }

    override fun getMainComponentName(): String = "LordsandLadsRules"

    override fun createReactActivityDelegate(): ReactActivityDelegate =
        DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled)

    override fun onCreate(savedInstanceState: Bundle?) {
        // installSplashScreen MUST be called before super.onCreate().
        // Hold the system splash (which shows the splash logo via windowSplashScreenAnimatedIcon)
        // until JS calls NativeSplashScreen.dismiss() on its first render.
        // At that point the JS Animated.View overlay (opacity=1, same logo) is already committed
        // to the native view hierarchy, so the instant removal is seamless.
        val splashScreen = installSplashScreen()
        splashScreen.setKeepOnScreenCondition { !NativeSplashScreenModule.splashReady.get() }
        splashScreen.setOnExitAnimationListener { it.remove() }
        super.onCreate(savedInstanceState)

        WindowCompat.setDecorFitsSystemWindows(window, false)
        window.statusBarColor = Color.TRANSPARENT
        window.navigationBarColor = Color.TRANSPARENT

        ViewCompat.getWindowInsetsController(window.decorView)?.let {
            it.isAppearanceLightStatusBars = false
            it.isAppearanceLightNavigationBars = true
        }
    }
}
