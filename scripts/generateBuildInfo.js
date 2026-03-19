#!/usr/bin/env node
const { execSync } = require('child_process');
const { writeFileSync, readFileSync, existsSync } = require('fs');
const path = require('path');

const rootDir = path.join(__dirname, '..');

const commit       = execSync('git rev-parse --short HEAD').toString().trim();
const commitFull   = execSync('git rev-parse HEAD').toString().trim();
const commitMessage = execSync('git log -1 --format=%s').toString().trim();
const pkg       = JSON.parse(readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
const gradle    = readFileSync(path.join(rootDir, 'android', 'app', 'build.gradle'), 'utf8');
const versionCode = gradle.match(/versionCode\s+(\d+)/)?.[1] ?? 'unknown';
const timestamp = new Date().toISOString();

// Read .env file for build-time secrets injection.
const envPath = path.join(rootDir, '.env');
const envVars = {};
if (existsSync(envPath)) {
  const envContent = readFileSync(envPath, 'utf8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx > 0) {
      envVars[trimmed.slice(0, eqIdx).trim()] = trimmed.slice(eqIdx + 1).trim();
    }
  }
}

const geminiKeyAndroid = envVars.GEMINI_API_KEY_ANDROID || '';
const geminiKeyIOS = envVars.GEMINI_API_KEY_IOS || '';

const output = `// Auto-generated at build time — do not edit.
export const BUILD_COMMIT         = '${commit}';
export const BUILD_COMMIT_FULL    = '${commitFull}';
export const BUILD_COMMIT_MESSAGE = '${commitMessage.replace(/'/g, "\\'")}';
export const BUILD_VERSION_NAME   = '${pkg.version}';
export const BUILD_VERSION_CODE   = '${versionCode}';
export const BUILD_TIMESTAMP      = '${timestamp}';
export const GEMINI_API_KEY_ANDROID = '${geminiKeyAndroid.replace(/'/g, "\\'")}';
export const GEMINI_API_KEY_IOS     = '${geminiKeyIOS.replace(/'/g, "\\'")}';
`;

writeFileSync(path.join(rootDir, 'src', 'buildInfo.js'), output);
console.log(`Build info written: ${commit} v${pkg.version} (${versionCode}) @ ${timestamp}`);
console.log(`Gemini API key (Android): ${geminiKeyAndroid ? 'configured' : 'not set'}`);
console.log(`Gemini API key (iOS):     ${geminiKeyIOS ? 'configured' : 'not set'}`);
