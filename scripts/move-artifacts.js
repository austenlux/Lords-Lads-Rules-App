const fs = require('fs');
const path = require('path');

const artifactsDir = path.join(__dirname, '..', 'artifacts');
const androidDir = path.join(artifactsDir, 'android');
const iosDir = path.join(artifactsDir, 'ios');

// Create directories if they don't exist
[artifactsDir, androidDir, iosDir].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Move Android APK
const androidBuildDir = path.join(__dirname, '..', 'android', 'app', 'build', 'outputs', 'apk', 'release');
if (fs.existsSync(androidBuildDir)) {
  const apkFiles = fs.readdirSync(androidBuildDir).filter(f => f.endsWith('.apk'));
  apkFiles.forEach(apk => {
    fs.copyFileSync(
      path.join(androidBuildDir, apk),
      path.join(androidDir, 'lords-and-lads-rules.apk')
    );
  });
}

// Move iOS IPA
const iosBuildDir = path.join(__dirname, '..', 'ios', 'build');
if (fs.existsSync(iosBuildDir)) {
  const ipaFiles = fs.readdirSync(iosBuildDir).filter(f => f.endsWith('.ipa'));
  ipaFiles.forEach(ipa => {
    fs.copyFileSync(
      path.join(iosBuildDir, ipa),
      path.join(iosDir, 'lords-and-lads-rules.ipa')
    );
  });
} 