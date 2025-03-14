const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

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

  // Create MainActivity.java with the correct component name
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
  }
}`;
  fs.writeFileSync(path.join(javaDir, 'MainApplication.java'), mainApplicationContent);

  // Create ReactNativeFlipper.java
  const reactNativeFlipperContent = `package com.lux.lnlrules;

public class ReactNativeFlipper {
  public static void initializeFlipper() {
    // No-op, we don't need Flipper functionality
  }
}`;
  fs.writeFileSync(path.join(debugDir, 'ReactNativeFlipper.java'), reactNativeFlipperContent);
}

async function checkDevBuild() {
  try {
    // Clean everything at startup
    cleanAll();

    // Create development build with auto-confirmation
    console.log('📦 Creating development build...');
    await runCommandWithInput('npx', ['expo', 'prebuild', '--clean', '--no-install'], 'y\n');

    // Ensure Android resources exist AFTER prebuild
    console.log('🎨 Setting up Android resources...');
    ensureAndroidResources();

    // Start Expo development server
    console.log('🚀 Starting Expo development server...');
    execSync('npx expo start --dev-client --clear', { stdio: 'inherit' });
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

function runCommandWithInput(command, args, input) {
  return new Promise((resolve, reject) => {
    const proc = spawn(command, args, { stdio: ['pipe', 'inherit', 'inherit'] });
    
    proc.stdin.write(input);
    proc.stdin.end();

    proc.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Command failed with code ${code}`));
      }
    });

    proc.on('error', (err) => {
      reject(err);
    });
  });
}

// Run the build process
checkDevBuild().catch(error => {
  console.error('❌ Error:', error.message);
  process.exit(1);
}); 