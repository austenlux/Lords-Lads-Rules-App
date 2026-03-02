#!/usr/bin/env node
const { execSync } = require('child_process');
const { writeFileSync, readFileSync } = require('fs');
const path = require('path');

const rootDir = path.join(__dirname, '..');

const commit       = execSync('git rev-parse --short HEAD').toString().trim();
const commitFull   = execSync('git rev-parse HEAD').toString().trim();
const commitMessage = execSync('git log -1 --format=%s').toString().trim();
const pkg       = JSON.parse(readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
const gradle    = readFileSync(path.join(rootDir, 'android', 'app', 'build.gradle'), 'utf8');
const versionCode = gradle.match(/versionCode\s+(\d+)/)?.[1] ?? 'unknown';
const timestamp = new Date().toISOString();

const output = `// Auto-generated at build time — do not edit.
export const BUILD_COMMIT         = '${commit}';
export const BUILD_COMMIT_FULL    = '${commitFull}';
export const BUILD_COMMIT_MESSAGE = '${commitMessage.replace(/'/g, "\\'")}';
export const BUILD_VERSION_NAME   = '${pkg.version}';
export const BUILD_VERSION_CODE   = '${versionCode}';
export const BUILD_TIMESTAMP      = '${timestamp}';
`;

writeFileSync(path.join(rootDir, 'src', 'buildInfo.js'), output);
console.log(`Build info written: ${commit} v${pkg.version} (${versionCode}) @ ${timestamp}`);
