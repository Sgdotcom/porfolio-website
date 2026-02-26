import { StateManager } from './modules/stateManager.js';
import { GridEngine, buildLayoutFromDom } from './modules/gridEngine.js';
import { AuthManager } from './modules/authManager.js';
import { GitHubApiManager } from './modules/githubApiManager.js';
import { UIController } from './modules/uiController.js';

const editMode = new URLSearchParams(window.location.search).get('edit') === '1';

const gridElement = document.querySelector('.moodboard-grid');
const controlsElement = document.getElementById('moodboard-controls');
const statusElement = controlsElement?.querySelector('[data-status]');
const loginOverlay = document.getElementById('edit-login-overlay');

const fallbackLayout = buildLayoutFromDom(gridElement, { forceSingleUnit: true });
const layoutMap = fallbackLayout.reduce((acc, item) => {
  const key = (item.path || item.src || '').trim();
  if (key) acc[key] = acc[key] || item;
  return acc;
}, {});

const COLUMNS = 10;
function attachLayoutHints(items) {
  const used = new Set();
  const mark = (x, y, w, h) => {
    for (let r = y; r < y + h; r++) for (let c = x; c < x + w; c++) used.add(`${c},${r}`);
  };
  const canFit = (x, y, w, h) => {
    for (let r = y; r < y + h; r++) for (let c = x; c < x + w; c++) if (used.has(`${c},${r}`)) return false;
    return true;
  };
  const nextSlot = (w, h) => {
    for (let row = 0; row < 1000; row++) {
      for (let col = 0; col <= COLUMNS - w; col++) {
        if (canFit(col, row, w, h)) return { x: col, y: row };
      }
    }
    return { x: 0, y: 0 };
  };
  return items.map((item, index) => {
    const key = (item.path || item.src || '').trim();
    const layout = key ? layoutMap[key] : null;
    let x, y, w, h;
    w = typeof item.w === 'number' ? item.w : (layout?.w ?? 1);
    h = typeof item.h === 'number' ? item.h : (layout?.h ?? 1);
    if (typeof item.x === 'number' && typeof item.y === 'number') {
      x = item.x;
      y = item.y;
    } else {
      const layoutSlot = layout && typeof layout.x === 'number' && typeof layout.y === 'number'
        ? { x: layout.x, y: layout.y }
        : null;
      const slotAvailable = layoutSlot && canFit(layoutSlot.x, layoutSlot.y, w, h);
      if (slotAvailable) {
        x = layoutSlot.x;
        y = layoutSlot.y;
      } else {
        const slot = nextSlot(w, h);
        x = slot.x;
        y = slot.y;
      }
    }
    mark(x, y, w, h);
    return {
      ...item,
      id: item.id || layout?.id,
      x,
      y,
      w,
      h
    };
  });
}

const stateManager = new StateManager();

const gridEngine = new GridEngine({
  gridElement,
  columns: 10,
  stateManager,
  editMode
});
const githubOwner = document.querySelector('meta[name="github-owner"]')?.content || window.location.hostname;
const githubRepo = document.querySelector('meta[name="github-repo"]')?.content || 'porfolio-website';
const githubBranch = document.querySelector('meta[name="github-branch"]')?.content || 'main';

const authManager = new AuthManager({
  editMode,
  overlay: loginOverlay
});

const apiManager = new GitHubApiManager({
  owner: githubOwner,
  repo: githubRepo,
  branch: githubBranch,
  tokenProvider: () => authManager.getToken()
});

const uiController = new UIController({
  stateManager,
  gridEngine,
  authManager,
  apiManager,
  controls: controlsElement,
  statusElement
});

uiController.setStatus(editMode ? 'Edit mode' : 'View mode');

const setUiEditMode = typeof uiController.setEditMode === 'function'
  ? uiController.setEditMode.bind(uiController)
  : () => {};

authManager.setOnAuthenticated(() => {
  if (!editMode) return;
  setUiEditMode(true);
  uiController.setStatus('Edit mode');
});

// Test mode: ?edit=1&test=1 bypasses login (must run before init so overlay never shows)
const testMode = new URLSearchParams(window.location.search).get('test') === '1';
if (editMode && testMode) {
  authManager.authenticate('test');
}

authManager.init();
setUiEditMode(editMode && authManager.isAuthenticated());

if (testMode) {
  window.__gridState = () => stateManager.getItems();
  window.__gridStateManager = stateManager;
  window.__gridEngine = gridEngine;
  window.__gridCompact = () => gridEngine.compactGrid();
  window.__gridAssert = () => {
    const items = stateManager.getItems();
    const overlaps = [];
    for (let i = 0; i < items.length; i++) {
      for (let j = i + 1; j < items.length; j++) {
        const a = items[i], b = items[j];
        const xOver = a.x < b.x + b.w && b.x < a.x + a.w;
        const yOver = a.y < b.y + b.h && b.y < a.y + a.h;
        if (xOver && yOver) overlaps.push({ a: a.id, b: b.id });
      }
    }
    const maxY = Math.max(...items.map((it) => it.y + it.h), 0);
    const minY = Math.min(...items.map((it) => it.y), 0);
    const rowSpan = maxY - minY;
    const totalCells = items.reduce((s, it) => s + it.w * it.h, 0);
    const cols = 10;
    const expectedRows = Math.ceil(totalCells / cols);
    const hasGap = rowSpan > expectedRows + 5;
    const ok = overlaps.length === 0 && !hasGap;
    console.log('[gridAssert]', ok ? 'OK' : 'FAIL', { overlaps: overlaps.length, rowSpan, expectedRows, hasGap });
    return { ok, overlaps, rowSpan, expectedRows, hasGap };
  };
}

// Dedupe by path/src so we never load the same image twice (avoids item-N vs path id duplicates)
function dedupeItemsByPath(items) {
  const byPath = new Map();
  const noPath = [];
  for (const it of items) {
    const key = (it.path || it.src || '').trim();
    if (!key) {
      noPath.push(it);
      continue;
    }
    if (!byPath.has(key)) {
      byPath.set(key, { ...it, id: it.id || key });
    }
  }
  return [...byPath.values(), ...noPath];
}

fetch('assets/pictures-of/gallery.json')
  .then((response) => {
    if (!response.ok) throw new Error('Unable to load gallery');
    return response.json();
  })
  .then((data) => {
    const raw = Array.isArray(data.items) ? data.items : [];
    const items = dedupeItemsByPath(raw);
    // Drop image/video items with no path so we never render white/empty tiles
    const withPath = items.filter((it) => (it.path || it.src || '').trim().length > 0);
    // Preserve videos from HTML (fallbackLayout) so they are never lost when loading gallery
    const pathSet = new Set(withPath.map((it) => (it.path || it.src || '').trim()));
    const fallbackVideos = fallbackLayout.filter(
      (it) => it.type === 'video'
        && (it.path || it.src || '').trim().length > 0
        && !pathSet.has((it.path || it.src || '').trim())
    );
    const combined = fallbackVideos.length ? [...withPath, ...fallbackVideos] : withPath;
    const payload = combined.length ? attachLayoutHints(combined) : fallbackLayout;
    stateManager.loadState({ items: payload });
    gridEngine.normalizeLayout();
  })
  .catch(() => {
    // Strip placeholder text tiles (no path) so we don't show white "THE"/"DUMP" tiles
    const fallback = fallbackLayout.filter((it) => (it.path || it.src || '').trim().length > 0);
    stateManager.loadState({ items: fallback });
    gridEngine.normalizeLayout();
  });
