# Testing the moodboard grid

## Live testing in the browser

1. **Start the app** (from project root):
   ```bash
   npm run serve
   ```
   Or: `python3 -m http.server 8765`

2. **Open in your browser with test mode** (edit mode without login + console helpers):
   ```
   http://127.0.0.1:8765/wdigfh.html?edit=1&test=1
   ```

3. **Use the grid** – resize tiles, move them around.

4. **Check layout in the console** – open DevTools (F12 or Cmd+Option+I), then run:
   - `__gridState()` – current items (id, x, y, w, h, …)
   - `__gridAssert()` – checks for overlaps and large gaps; returns `{ ok, overlaps, rowSpan, expectedRows, hasGap }`
   - `__gridCompact()` – run compaction manually (same as after move/resize)

   If `__gridAssert()` reports `ok: false`, you have overlaps and/or gaps to fix.

## Automated E2E (Puppeteer)

Run the E2E script (server must be running on port 8765):

```bash
npm run test:e2e          # headless
npm run test:e2e:headed    # open browser so you can watch
```

Custom URL:

```bash
node tests/e2e-grid.js --url=http://localhost:3000/wdigfh.html
node tests/e2e-grid.js --headed --url=http://localhost:3000/wdigfh.html
```

The test loads the page in edit+test mode, runs a layout assertion, then simulates one drag and asserts again. Use `--headed` to see the browser and debug failures.
