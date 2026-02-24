import { StateManager } from './modules/stateManager.js';
import { GridEngine } from './modules/gridEngine.js';
import { AuthManager } from './modules/authManager.js';
import { GitHubApiManager } from './modules/githubApiManager.js';
import { UIController } from './modules/uiController.js';

const editMode = new URLSearchParams(window.location.search).get('edit') === '1';

const gridElement = document.querySelector('.moodboard-grid');
const controlsElement = document.getElementById('moodboard-controls');
const statusElement = controlsElement?.querySelector('[data-status]');
const loginOverlay = document.getElementById('edit-login-overlay');

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

authManager.setOnAuthenticated(() => {
  if (!editMode) return;
  controlsElement?.classList.remove('hidden');
  uiController.setStatus('Edit mode');
});

authManager.init();

fetch('assets/pictures-of/gallery.json')
  .then((response) => {
    if (!response.ok) {
      throw new Error('Unable to load gallery');
    }
    return response.json();
  })
  .then((data) => stateManager.loadState(data))
  .catch(() => stateManager.loadState({ items: [] }));
