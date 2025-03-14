const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Simple transparent PNG for adaptive icon
const ADAPTIVE_ICON = 'iVBORw0KGgoAAAANSUhEUgAAAQAAAAEAAQMAAABmvDolAAAAA1BMVEUAAACnej3aAAAAAXRSTlMAQObYZgAAADpJREFUaN7twTEBAAAAwiD7p14MH2AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAwFOMYwAB/Q2tfwAAAABJRU5ErkJggg==';

function cleanAll() {
  console.log('🧹 Cleaning all build artifacts...');
  const dirsToClean = ['android', 'ios', 'assets'];
  
  dirsToClean.forEach(dir => {
    const dirPath = path.join(process.cwd(), dir);
    if (fs.existsSync(dirPath)) {
      fs.rmSync(dirPath, { recursive: true, force: true });
    }
  });
}

function ensureAssets() {
  const assetsDir = path.join(process.cwd(), 'assets');
  const adaptiveIconPath = path.join(assetsDir, 'adaptive-icon.png');

  if (!fs.existsSync(assetsDir)) {
    fs.mkdirSync(assetsDir);
  }

  // Create adaptive icon if it doesn't exist
  if (!fs.existsSync(adaptiveIconPath)) {
    console.log('📱 Creating adaptive icon...');
    fs.writeFileSync(adaptiveIconPath, Buffer.from(ADAPTIVE_ICON, 'base64'));
  }
}

function ensureAndroidResources() {
  const valuesDir = path.join(process.cwd(), 'android/app/src/main/res/values');
  const drawableDir = path.join(process.cwd(), 'android/app/src/main/res/drawable');
  const javaDir = path.join(process.cwd(), 'android/app/src/main/java/com/lux/lnlrules');
  const debugDir = path.join(process.cwd(), 'android/app/src/debug/java/com/lux/lnlrules');
  
  // Create directories if they don't exist
  fs.mkdirSync(valuesDir, { recursive: true });
  fs.mkdirSync(drawableDir, { recursive: true });
  fs.mkdirSync(javaDir, { recursive: true });
  fs.mkdirSync(debugDir, { recursive: true });

  // Create colors.xml with all required colors
  const colorsContent = `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="splashscreen_background">#FF5722</color>
    <color name="colorPrimary">#FF5722</color>
    <color name="colorPrimaryDark">#E64A19</color>
    <color name="colorAccent">#FF5722</color>
</resources>`;
  fs.writeFileSync(path.join(valuesDir, 'colors.xml'), colorsContent);

  // Create splashscreen.xml
  const splashscreenContent = `<?xml version="1.0" encoding="utf-8"?>
<layer-list xmlns:android="http://schemas.android.com/apk/res/android">
    <item android:drawable="@color/splashscreen_background"/>
</layer-list>`;
  fs.writeFileSync(path.join(drawableDir, 'splashscreen.xml'), splashscreenContent);

  // Create MainActivity.java
  const mainActivityContent = `package com.lux.lnlrules;

import android.os.Bundle;
import com.facebook.react.ReactActivity;
import com.facebook.react.ReactActivityDelegate;
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint;
import com.facebook.react.defaults.DefaultReactActivityDelegate;

public class MainActivity extends ReactActivity {
  @Override
  protected String getMainComponentName() {
    return "lords-and-lads-rules";
  }

  @Override
  protected ReactActivityDelegate createReactActivityDelegate() {
    return new DefaultReactActivityDelegate(
      this,
      getMainComponentName(),
      DefaultNewArchitectureEntryPoint.getFabricEnabled()
    );
  }

  @Override
  protected void onCreate(Bundle savedInstanceState) {
    super.onCreate(null);
  }
}`;
  fs.writeFileSync(path.join(javaDir, 'MainActivity.java'), mainActivityContent);

  // Create MainApplication.java
  const mainApplicationContent = `package com.lux.lnlrules;

import android.app.Application;
import com.facebook.react.PackageList;
import com.facebook.react.ReactApplication;
import com.facebook.react.ReactNativeHost;
import com.facebook.react.ReactPackage;
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint;
import com.facebook.react.defaults.DefaultReactNativeHost;
import com.facebook.soloader.SoLoader;
import java.util.List;

public class MainApplication extends Application implements ReactApplication {
  private final ReactNativeHost mReactNativeHost = new DefaultReactNativeHost(this) {
    @Override
    public boolean getUseDeveloperSupport() {
      return BuildConfig.DEBUG;
    }

    @Override
    protected List<ReactPackage> getPackages() {
      List<ReactPackage> packages = new PackageList(this).getPackages();
      return packages;
    }

    @Override
    protected String getJSMainModuleName() {
      return "index";
    }

    @Override
    protected boolean isNewArchEnabled() {
      return BuildConfig.IS_NEW_ARCHITECTURE_ENABLED;
    }

    @Override
    protected Boolean isHermesEnabled() {
      return BuildConfig.IS_HERMES_ENABLED;
    }
  };

  @Override
  public ReactNativeHost getReactNativeHost() {
    return mReactNativeHost;
  }

  @Override
  public void onCreate() {
    super.onCreate();
    SoLoader.init(this, false);
    if (BuildConfig.IS_NEW_ARCHITECTURE_ENABLED) {
      DefaultNewArchitectureEntryPoint.load();
    }
    if (BuildConfig.DEBUG) {
      try {
        Class<?> flipperClass = Class.forName("com.lux.lnlrules.ReactNativeFlipper");
        flipperClass.getMethod("initializeFlipper", Application.class, ReactNativeHost.class)
          .invoke(null, this, getReactNativeHost());
      } catch (Exception e) {
        // Flipper initialization failed
      }
    }
  }
}`;
  fs.writeFileSync(path.join(javaDir, 'MainApplication.java'), mainApplicationContent);

  // Create ReactNativeFlipper.java
  const reactNativeFlipperContent = `package com.lux.lnlrules;

import android.content.Context;
import com.facebook.react.ReactInstanceManager;

/**
 * Class responsible for loading Flipper inside your React Native application. This is the debug
 * flavor of it. Here you can add your own plugins and customize the Flipper setup.
 */
public class ReactNativeFlipper {
  public static void initializeFlipper(Context context, ReactInstanceManager reactInstanceManager) {
    // Do nothing as we don't need Flipper in this app
  }
}`;
  fs.writeFileSync(path.join(debugDir, 'ReactNativeFlipper.java'), reactNativeFlipperContent);
}

function checkDevBuild() {
  try {
    // Clean everything at startup
    cleanAll();

    // Ensure assets exist
    console.log('🎨 Setting up assets...');
    ensureAssets();

    // Create development build
    console.log('📦 Creating development build...');
    execSync('npx expo prebuild --clean', { stdio: 'inherit' });

    // Ensure Android resources exist
    console.log('🎨 Setting up Android resources...');
    ensureAndroidResources();

    // Build and install
    console.log('🔍 Building Android app...');
    execSync('cd android && ./gradlew installDebug', { stdio: 'inherit' });

    console.log('✅ Development build ready!');
  } catch (error) {
    console.error('❌ Error setting up development build:', error.message);
    process.exit(1);
  }
}

checkDevBuild(); 