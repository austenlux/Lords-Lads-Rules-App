package com.lux.lnlrules

import android.content.Context
import android.content.res.Configuration
import android.os.Bundle
import android.view.WindowManager
import android.graphics.Color
import android.view.View
import android.os.Build
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
        super.onCreate(savedInstanceState)
        
        // For API 21+ (Lollipop and higher) - use truly transparent status bar
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            // Set status bar color to transparent
            window.statusBarColor = Color.TRANSPARENT
            
            // Make sure navigation bar stays dark
            window.navigationBarColor = Color.parseColor("#121212")
            
            // Allow layout to extend into the status bar area
            window.decorView.systemUiVisibility = (View.SYSTEM_UI_FLAG_LAYOUT_STABLE 
                or View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN)
            
            // Clear any translucent flags that might add a darkening effect
            window.clearFlags(WindowManager.LayoutParams.FLAG_TRANSLUCENT_STATUS)
            
            // Make sure content appears behind the status bar
            window.addFlags(WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS)
        }
    }
} 