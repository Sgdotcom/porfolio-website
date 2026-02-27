#!/usr/bin/env node
/**
 * Demo: open moodboard in edit mode, resize one image, leave browser open so you can verify
 * - Other images do NOT move to the bottom
 * - Other images do NOT turn white
 * Run: node tests/demo-resize-fix.js (after: npm run serve)
 */
const puppeteer = require('puppeteer');

const BASE = 'http://127.0.0.1:8765';
const URL = `${BASE}/wdigfh.html?edit=1&test=1`;

async function main() {
  const browser = await puppeteer.launch({
    headless: false,
    slowMo: 50,
    args: ['--window-size=1280,900']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });
  await page.goto(URL, { waitUntil: 'networkidle0', timeout: 15000 });

  await page.waitForSelector('.moodboard-grid', { timeout: 5000 });
  await page.waitForFunction(
    () => document.querySelector('.moodboard-post.editable') != null,
    { timeout: 5000 }
  );

  const count = await page.$$eval('.moodboard-post', (els) => els.length);
  console.log('Posts loaded:', count);

  const resizeHandle = await page.$('.moodboard-post .resize-handle');
  if (resizeHandle) {
    const box = await resizeHandle.boundingBox();
    if (box) {
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
      await page.mouse.move(box.x + 120, box.y + 80, { steps: 10 });
      await page.mouse.up();
      console.log('Resized one tile. Check: other images should still be in place and not white.');
    }
  }

  await new Promise((r) => setTimeout(r, 3000));
  await page.screenshot({ path: 'tests/demo-after-resize.png' });
  console.log('Screenshot saved to tests/demo-after-resize.png');
  await new Promise((r) => setTimeout(r, 8000));
  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
