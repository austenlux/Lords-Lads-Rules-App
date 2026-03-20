package com.lux.lnlrules

import android.content.Context
import android.content.res.Configuration
import android.os.Bundle
import android.graphics.Color
import android.view.Gravity
import android.view.ViewGroup
import android.widget.FrameLayout
import android.widget.ImageView
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
        // No setKeepOnScreenCondition — the native overlay below bridges the gap
        // between activity start and JS first render.
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

        // Add a native overlay showing the splash logo at the same size as the JS
        // Animated.View overlay (90% of screen width, centered) so the logo is
        // visible from the very first frame — before JS initializes.
        // JS calls NativeSplashScreen.dismiss() on its first render to remove it;
        // at that point the JS overlay (already at opacity=1) seamlessly takes over.
        val metrics = resources.displayMetrics
        val logoSize = (minOf(metrics.widthPixels, metrics.heightPixels) * 0.9f).toInt()

        val overlay = FrameLayout(this)
        overlay.setBackgroundColor(Color.parseColor("#121212"))

        val imageView = ImageView(this)
        imageView.setImageResource(R.drawable.splash_logo)
        imageView.scaleType = ImageView.ScaleType.FIT_CENTER

        val params = FrameLayout.LayoutParams(logoSize, logoSize)
        params.gravity = Gravity.CENTER
        overlay.addView(imageView, params)

        window.addContentView(
            overlay,
            ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT)
        )
        NativeSplashScreenModule.overlayView = overlay
    }
}
