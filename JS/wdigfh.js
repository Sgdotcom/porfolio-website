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

const fallbackLayout = buildLayoutFromDom(gridElement);

const stateManager = new StateManager();

const gridEngine = new GridEngine({
  gridElement,
  columns: 10,
  stateManager,
  editMode
});

function hasLayoutCoordinates(item) {
  return Number.isFinite(item?.x) && Number.isFinite(item?.y) && Number.isFinite(item?.w) && Number.isFinite(item?.h);
}

function mergeLayout(items, fallback) {
  const fallbackMap = new Map(fallback.map((entry) => [entry.id, entry]));
  const merged = items.map((item, index) => {
    const layout = fallbackMap.get(item.id) || fallback[index] || {};
    return {
      ...layout,
      ...item,
      x: Number.isFinite(item?.x) ? item.x : layout.x ?? 0,
      y: Number.isFinite(item?.y) ? item.y : layout.y ?? 0,
      w: Number.isFinite(item?.w) ? item.w : layout.w ?? 1,
      h: Number.isFinite(item?.h) ? item.h : layout.h ?? 1
    };
  });

  const usedIds = new Set(merged.map((item) => item.id));
  fallback.forEach((entry) => {
    if (!usedIds.has(entry.id)) merged.push(entry);
  });

  return merged;
}

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

authManager.setOnAuthenticated(() => {
  if (!editMode) return;
  controlsElement?.classList.remove('hidden');
  uiController.setStatus('Edit mode');
});

authManager.init();

fetch('assets/pictures-of/gallery.json')
  .then((response) => {
    if (!response.ok) throw new Error('Unable to load gallery');
    return response.json();
  })
  .then((data) => {
    const items = Array.isArray(data.items) ? data.items : [];
    const needsLayout = !items.length || items.some((item) => !hasLayoutCoordinates(item));
    const payload = needsLayout ? mergeLayout(items, fallbackLayout) : items;
    stateManager.loadState({ items: payload });
  })
  .catch(() => stateManager.loadState({ items: fallbackLayout }));
