#!/usr/bin/env node
/**
 * E2E test for the moodboard grid: load edit mode, optionally simulate drag/resize, run layout assertions.
 *
 * Usage:
 *   node tests/e2e-grid.js                    # headless, base URL http://127.0.0.1:8765
 *   node tests/e2e-grid.js --headed           # show browser + visible test cursor + slow motion
 *   node tests/e2e-grid.js --headed --fast   # headed but no slowdown/cursor
 *   node tests/e2e-grid.js --url http://localhost:3000/wdigfh.html
 *
 * Requires the app to be served (e.g. python3 -m http.server 8765) and ?edit=1&test=1 for edit mode without login.
 */

const puppeteer = require('puppeteer');
const path = require('path');

const args = process.argv.slice(2);
const headed = args.includes('--headed');
const fastHeaded = args.includes('--fast');
const showCursor = headed && !fastHeaded;
const slowMo = headed && !fastHeaded ? 80 : 0;
const urlArg = args.find((a) => a.startsWith('--url='));
const baseUrl = urlArg ? urlArg.replace('--url=', '') : 'http://127.0.0.1:8765/wdigfh.html';
const testUrl = `${baseUrl.replace(/\/$/, '')}${baseUrl.includes('?') ? '&' : '?'}edit=1&test=1`;

async function run() {
  const browser = await puppeteer.launch({
    headless: headed ? false : 'new',
    slowMo,
    args: headed ? ['--window-size=1200,800'] : []
  });
  const page = await browser.newPage();
  const jsErrors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      const t = msg.text();
      if (!t.includes('Failed to load resource')) jsErrors.push(t);
    }
  });

  await page.setViewport({ width: 1200, height: 800 });
  await page.goto(testUrl, { waitUntil: 'networkidle0', timeout: 15000 });

  if (showCursor) {
    await page.evaluate(() => {
      const el = document.createElement('div');
      el.id = 'e2e-test-cursor';
      el.setAttribute('aria-hidden', 'true');
      el.style.cssText = 'position:fixed;width:24px;height:24px;margin-left:-12px;margin-top:-12px;border:3px solid #e11;border-radius:50%;pointer-events:none;z-index:99999;box-shadow:0 0 0 2px #fff;display:none;';
      document.body.appendChild(el);
      window.__e2eCursorEl = el;
    });
  }

  await page.waitForSelector('.moodboard-grid', { timeout: 5000 });
  await page.waitForFunction(
    () => document.querySelector('.moodboard-post.editable') != null,
    { timeout: 5000 }
  );

  let postCount = await page.$$eval('.moodboard-post', (els) => els.length);
  console.log('Grid loaded in edit+test mode, posts:', postCount);

  const baseline = await page.evaluate(() => {
    if (typeof window.__gridAssert !== 'function') return { ok: false, error: 'no __gridAssert', overlaps: [], hasGap: false };
    return window.__gridAssert();
  });
  console.log('Initial layout (baseline):', baseline.ok ? 'OK' : 'WARN', { overlaps: baseline.overlaps?.length ?? 0, hasGap: baseline.hasGap });

  let afterMove = null;
  if (postCount >= 2) {
    const dragOk = await page.evaluate(() => {
      const post = document.querySelector('.moodboard-post.editable[data-item-id]');
      if (!post) return false;
      const rect = post.getBoundingClientRect();
      window.__e2eFirstPostRect = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
      return true;
    });
    if (dragOk) {
      const rect = await page.evaluate(() => window.__e2eFirstPostRect);
      const moveCursor = async (x, y) => {
        if (showCursor) await page.evaluate((a, b) => { const e = window.__e2eCursorEl; if (e) { e.style.left = a + 'px'; e.style.top = b + 'px'; e.style.display = 'block'; } }, x, y);
        await page.mouse.move(x, y, { steps: showCursor ? 15 : 1 });
      };
      if (showCursor) await page.evaluate(() => { const e = window.__e2eCursorEl; if (e) e.style.display = 'block'; });
      await moveCursor(rect.x, rect.y);
      await new Promise((r) => setTimeout(r, showCursor ? 300 : 0));
      await page.mouse.down();
      await new Promise((r) => setTimeout(r, showCursor ? 200 : 0));
      const steps = showCursor ? 12 : 8;
      for (let i = 1; i <= steps; i++) {
        const x = rect.x + (120 * i) / steps;
        const y = rect.y + (80 * i) / steps;
        await moveCursor(x, y);
      }
      await page.mouse.up();
      await new Promise((r) => setTimeout(r, showCursor ? 500 : 400));
      afterMove = await page.evaluate(() => (window.__gridAssert ? window.__gridAssert() : null));
      console.log('After drag:', afterMove?.ok ? 'OK' : 'FAIL', { overlaps: afterMove?.overlaps?.length ?? 0, hasGap: afterMove?.hasGap });
    }
  }

  // Add Image: trigger file chooser, select test image, verify new image tile shows the image
  const addImageBtn = await page.$('[data-action="add-image"]');
  const testImagePath = path.join(__dirname, 'fixtures', 'test-image.png');
  if (addImageBtn) {
    const countBeforeImg = await page.$$eval('.moodboard-post', (els) => els.length);
    const [fileChooser] = await Promise.all([
      page.waitForFileChooser({ timeout: 3000 }),
      addImageBtn.click()
    ]).catch(() => [null]);
    if (fileChooser) {
      await fileChooser.accept([testImagePath]);
      await page.waitForFunction(
        (n) => document.querySelectorAll('.moodboard-post').length >= n + 1,
        { timeout: 3000 },
        countBeforeImg
      );
      await new Promise((r) => setTimeout(r, 400));
      const imageTileWithSrc = await page.evaluate(() => {
        const posts = document.querySelectorAll('.moodboard-post.moodboard-post-image');
        for (const p of posts) {
          const img = p.querySelector('img');
          if (img && img.src && img.src.startsWith('blob:')) return true;
        }
        return false;
      });
      if (!imageTileWithSrc) {
        console.error('Add Image: no image tile with blob src found (pendingFile preview)');
        await browser.close();
        process.exit(1);
      }
      console.log('Add Image: OK (new tile, image preview visible)');
    }
  }

  // Add Text: click button, new tile appears, type in it and verify
  const addTextBtn = await page.$('[data-action="add-text"]');
  if (addTextBtn) {
    const countBefore = await page.$$eval('.moodboard-post', (els) => els.length);
    await addTextBtn.click();
    await page.waitForFunction(
      (n) => document.querySelectorAll('.moodboard-post').length >= n + 1,
      { timeout: 3000 },
      countBefore
    );
    const countAfter = await page.$$eval('.moodboard-post', (els) => els.length);
    const textPost = await page.$('.moodboard-post.moodboard-post-text .text-only-content[contenteditable="true"]');
    if (!textPost) {
      console.error('Add Text: no contenteditable text tile found');
      await browser.close();
      process.exit(1);
    }
    await textPost.click();
    await new Promise((r) => setTimeout(r, 100));
    await page.keyboard.type('E2E test note', { delay: 30 });
    await new Promise((r) => setTimeout(r, 200));
    const hasText = await page.evaluate(() => {
      const el = document.querySelector('.moodboard-post-text .text-only-content');
      return el && el.textContent.includes('E2E test note');
    });
    if (!hasText) {
      console.error('Add Text: typed text not found in tile');
      await browser.close();
      process.exit(1);
    }
    console.log('Add Text: OK (new tile, editable, content persisted)', { postsBefore: countBefore, postsAfter: countAfter });
  }

  if (jsErrors.length) {
    console.error('JS errors:', jsErrors);
    await browser.close();
    process.exit(1);
  }

  // Fail only if drag made things worse: more overlaps than baseline, or new gap
  const baselineOverlaps = baseline.overlaps?.length ?? 0;
  const afterOverlaps = afterMove?.overlaps?.length ?? 0;
  const worseOverlaps = afterMove != null && afterOverlaps > baselineOverlaps;
  const newGap = afterMove != null && afterMove.hasGap && !baseline.hasGap;
  const failed = worseOverlaps || newGap;

  if (showCursor) await page.evaluate(() => { const e = window.__e2eCursorEl; if (e) e.style.display = 'none'; });
  await browser.close();
  if (failed) {
    console.log('FAIL: layout got worse after drag (more overlaps or new gap).');
  } else {
    console.log('PASS.');
  }
  process.exit(failed ? 1 : 0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
