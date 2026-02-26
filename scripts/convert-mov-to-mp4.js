#!/usr/bin/env node
/**
 * Convert all .mov files in assets/pictures-of to .mp4 (H.264/AAC) and remove .mov after success.
 * Usage: node scripts/convert-mov-to-mp4.js
 * Requires: ffmpeg on PATH
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const dir = path.join(__dirname, '..', 'assets', 'pictures-of');
const files = fs.readdirSync(dir).filter((f) => f.toLowerCase().endsWith('.mov'));

if (!files.length) {
  console.log('No .mov files in assets/pictures-of');
  process.exit(0);
}

console.log(`Converting ${files.length} .mov file(s) to .mp4...\n`);

for (const file of files) {
  const movPath = path.join(dir, file);
  const mp4Path = path.join(dir, file.replace(/\.mov$/i, '.mp4'));
  console.log(`  ${file} -> ${path.basename(mp4Path)}`);
  try {
    execFileSync(
      'ffmpeg',
      [
        '-y',
        '-i', movPath,
        '-c:v', 'libx264',
        '-preset', 'medium',
        '-crf', '23',
        '-c:a', 'aac',
        '-b:a', '128k',
        '-movflags', '+faststart',
        mp4Path
      ],
      { stdio: 'inherit' }
    );
    fs.unlinkSync(movPath);
    console.log(`  OK (removed .mov)\n`);
  } catch (err) {
    console.error(`  FAIL: ${err.message}\n`);
    process.exit(1);
  }
}

console.log('Done. All videos are now .mp4.');
