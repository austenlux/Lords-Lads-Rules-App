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
        // Suppress the Android 12+ mandatory system splash (which would show the
        // app's adaptive icon in a circle). installSplashScreen replaces it with
        // our theme's windowSplashScreenAnimatedIcon (invisible dark shape).
        // setOnExitAnimationListener removes it instantly after the first frame so
        // postSplashScreenTheme (Theme.App.Main) takes effect: its windowBackground
        // is splashscreen.xml (the logo), visible while React Native finishes loading.
        val splashScreen = installSplashScreen()
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
