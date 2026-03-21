package com.lux.lnlrules

import android.content.Context
import android.content.res.Configuration
import android.os.Bundle
import android.graphics.Color
import android.graphics.drawable.ColorDrawable
import android.graphics.drawable.LayerDrawable
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import androidx.core.view.ViewCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsControllerCompat
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.ReactRootView
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate
import kotlin.math.roundToInt

class MainActivity : ReactActivity() {

    override fun attachBaseContext(newBase: Context) {
        val config = Configuration(newBase.resources.configuration)
        config.fontScale = 1.0f
        applyOverrideConfiguration(config)
        super.attachBaseContext(newBase)
    }

    override fun getMainComponentName(): String = "LordsandLadsRules"

    override fun createReactActivityDelegate(): ReactActivityDelegate =
        object : DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled) {
            // Transparent background so the window background logo shows through
            // until the JS overlay paints — keeps the logo visible continuously
            // with no gap or flicker during the native→JS transition.
            override fun createRootView(): ReactRootView =
                ReactRootView(this@MainActivity).also {
                    it.setBackgroundColor(Color.TRANSPARENT)
                }
        }

    override fun onCreate(savedInstanceState: Bundle?) {
        // Set correct-sized window background BEFORE super.onCreate() so it takes
        // effect as early as possible — visible through the transparent system splash.
        val dm = resources.displayMetrics
        val widthDp = dm.widthPixels / dm.density
        val heightDp = dm.heightPixels / dm.density
        val logoSizePx = (minOf(widthDp, heightDp) * 0.9f * dm.density).roundToInt()
        val insetH = ((dm.widthPixels - logoSizePx) / 2).coerceAtLeast(0)
        val insetV = ((dm.heightPixels - logoSizePx) / 2).coerceAtLeast(0)
        @Suppress("DEPRECATION")
        val layers = LayerDrawable(arrayOf(
            ColorDrawable(Color.parseColor("#121212")),
            resources.getDrawable(R.drawable.splash_logo, theme),
        ))
        layers.setLayerInset(1, insetH, insetV, insetH, insetV)
        window.setBackgroundDrawable(layers)

        val splashScreen = installSplashScreen()
        splashScreen.setOnExitAnimationListener { it.remove() }
        super.onCreate(savedInstanceState)

        SplashOverlay.show(this)

        WindowCompat.setDecorFitsSystemWindows(window, false)
        window.statusBarColor = Color.TRANSPARENT
        window.navigationBarColor = Color.TRANSPARENT

        ViewCompat.getWindowInsetsController(window.decorView)?.let {
            it.isAppearanceLightStatusBars = false
            it.isAppearanceLightNavigationBars = true
        }
    }
}
