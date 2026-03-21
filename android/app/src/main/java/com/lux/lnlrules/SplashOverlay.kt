package com.lux.lnlrules

import android.animation.Animator
import android.animation.AnimatorListenerAdapter
import android.animation.ObjectAnimator
import android.app.Activity
import android.graphics.Color
import android.graphics.drawable.ColorDrawable
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.widget.FrameLayout
import android.widget.ImageView
import kotlin.math.roundToInt

object SplashOverlay {
    private var overlayRef: View? = null

    fun show(activity: Activity) {
        val dm = activity.resources.displayMetrics
        val widthDp = dm.widthPixels / dm.density
        val heightDp = dm.heightPixels / dm.density
        val logoSizePx = (minOf(widthDp, heightDp) * 0.905f * dm.density).roundToInt()

        val imageView = ImageView(activity).apply {
            setImageResource(R.drawable.splash_logo)
            scaleType = ImageView.ScaleType.FIT_CENTER
        }

        val frame = FrameLayout(activity).apply {
            background = ColorDrawable(Color.parseColor("#121212"))
            val lp = FrameLayout.LayoutParams(logoSizePx, logoSizePx).apply {
                gravity = Gravity.CENTER
            }
            addView(imageView, lp)
        }

        val matchParent = ViewGroup.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.MATCH_PARENT
        )
        activity.addContentView(frame, matchParent)
        overlayRef = frame
    }

    fun hide(activity: Activity) {
        val overlay = overlayRef ?: return
        ObjectAnimator.ofFloat(overlay, "alpha", 1f, 0f).apply {
            duration = 400
            addListener(object : AnimatorListenerAdapter() {
                override fun onAnimationEnd(animation: Animator) {
                    (overlay.parent as? ViewGroup)?.removeView(overlay)
                    overlayRef = null
                    // Clean up the window background logo so it doesn't
                    // show through the transparent ReactRootView after fade.
                    activity.window.setBackgroundDrawable(
                        ColorDrawable(Color.parseColor("#121212"))
                    )
                }
            })
            start()
        }
    }
}
