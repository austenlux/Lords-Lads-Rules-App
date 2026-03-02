#!/usr/bin/env node
const { execSync } = require('child_process');
const { writeFileSync } = require('fs');
const path = require('path');

const commit = execSync('git rev-parse --short HEAD').toString().trim();
const output = `// Auto-generated at build time — do not edit.\nexport const BUILD_COMMIT = '${commit}';\n`;
writeFileSync(path.join(__dirname, '..', 'src', 'buildInfo.js'), output);
console.log(`Build info written: ${commit}`);
