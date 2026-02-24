import { StateManager } from './stateManager.js';

function toBase64(buffer) {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const slice = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode.apply(null, slice);
  }
  return btoa(binary);
}

export class UIController {
  constructor(options = {}) {
    this.stateManager = options.stateManager instanceof StateManager ? options.stateManager : null;
    this.gridEngine = options.gridEngine || null;
    this.authManager = options.authManager;
    this.apiManager = options.apiManager;
    this.controls = options.controls || null;
    this.statusElement = options.statusElement || null;
    this.pendingUploads = new Map();
    this.selectedItem = null;

    this.initControls();
    this.initSelectionHandling();
  }

  initControls() {
    if (!this.controls) return;
    this.imageInput = this.controls.querySelector('input[type="file"][name="add-image"]');
    this.addImage = this.controls.querySelector('[data-action="add-image"]');
    this.addText = this.controls.querySelector('[data-action="add-text"]');
    this.deleteButton = this.controls.querySelector('[data-action="delete-item"]');
    this.publishButton = this.controls.querySelector('[data-action="publish"]');
    this.bgPicker = this.controls.querySelector('input[name="bg-color"]');
    this.textPicker = this.controls.querySelector('input[name="text-color"]');
    this.fontSize = this.controls.querySelector('input[name="font-size"]');

    this.addImage?.addEventListener('click', () => this.imageInput?.click());
    this.imageInput?.addEventListener('change', (event) => this.handleImageUpload(event.target.files));
    this.addText?.addEventListener('click', () => this.handleAddText());
    this.deleteButton?.addEventListener('click', () => this.handleDeleteSelected());
    this.publishButton?.addEventListener('click', () => this.handlePublish());

    this.bgPicker?.addEventListener('input', () => this.applySelectedStyle());
    this.textPicker?.addEventListener('input', () => this.applySelectedStyle());
    this.fontSize?.addEventListener('input', () => this.applySelectedStyle());
  }

  initSelectionHandling() {
    if (!this.gridEngine) return;
    this.gridEngine.onItemSelected((item) => {
      this.selectedItem = item;
      this.syncControls();
    });
    if (this.stateManager) {
      this.stateManager.subscribe(() => this.syncControls());
    }
  }

  syncControls() {
    const hasSelection = Boolean(this.selectedItem);
    this.deleteButton?.toggleAttribute('disabled', !hasSelection);
    if (!hasSelection) return;
    this.bgPicker?.setAttribute('value', this.selectedItem.bgColor || '#ffffff');
    this.textPicker?.setAttribute('value', this.selectedItem.textColor || '#000000');
    this.fontSize?.value = this.selectedItem.fontSize || 16;
    this.bgPicker?.dispatchEvent(new Event('input'));
  }

  applySelectedStyle() {
    if (!this.selectedItem || !this.stateManager) return;
    this.stateManager.updateItem(this.selectedItem.id, {
      bgColor: this.bgPicker?.value || '#ffffff',
      textColor: this.textPicker?.value || '#000000',
      fontSize: Number(this.fontSize?.value) || 16
    });
  }

  handleImageUpload(files) {
    if (!files?.length || !this.stateManager) return;
    Array.from(files).forEach((file) => {
      const id = `item-${Date.now()}-${Math.round(Math.random() * 1e5)}`;
      const item = this.stateManager.addItem({
        id,
        type: 'image',
        path: '',
        src: '',
        caption: file.name,
        x: 0,
        y: 0,
        w: 2,
        h: 2
      });
      item.pendingFile = file;
      this.pendingUploads.set(item.id, file);
      this.stateManager.updateItem(item.id, { pendingFile: file });
    });
    if (this.imageInput) this.imageInput.value = '';
  }

  handleAddText() {
    if (!this.stateManager) return;
    const content = window.prompt('Enter text content', 'New note');
    if (!content) return;
    this.stateManager.addItem({
      type: 'text',
      content,
      caption: content,
      x: 0,
      y: 0,
      w: 2,
      h: 1,
      bgColor: '#ffffff',
      textColor: '#000000',
      fontSize: 16
    });
  }

  handleDeleteSelected() {
    if (!this.selectedItem || !this.stateManager) return;
    this.pendingUploads.delete(this.selectedItem.id);
    this.stateManager.deleteItem(this.selectedItem.id);
    this.selectedItem = null;
    this.syncControls();
  }

  async handlePublish() {
    if (!this.authManager?.isAuthenticated()) {
      this.setStatus('Login first', 'error');
      return;
    }

    if (!this.apiManager) return;
    const items = this.stateManager.getItems();
    this.setStatus('Publishing…', 'info');

    try {
      for (const item of items) {
        if (item.pendingFile) {
          const targetPath = `assets/uploads/${item.id}-${item.pendingFile.name}`.replace(/\s+/g, '-');
          const arrayBuffer = await item.pendingFile.arrayBuffer();
          const base64 = toBase64(arrayBuffer);
          await this.apiManager.uploadImage(targetPath, base64);
          this.stateManager.updateItem(item.id, {
            path: targetPath,
            src: targetPath,
            pendingFile: null
          });
        }
      }

      const serialized = {
        items: this.stateManager.getItems().map((item) => ({
          id: item.id,
          type: item.type,
          path: item.path,
          src: item.src,
          caption: item.caption,
          content: item.content,
          x: item.x,
          y: item.y,
          w: item.w,
          h: item.h,
          bgColor: item.bgColor,
          textColor: item.textColor,
          fontSize: item.fontSize
        }))
      };

      const payload = btoa(JSON.stringify(serialized, null, 2));
      const message = `CMS publish – ${new Date().toISOString()}`;
      await this.apiManager.updateFile('assets/pictures-of/gallery.json', payload, message);
      this.setStatus('Published to GitHub', 'success');
    } catch (error) {
      console.error(error);
      this.setStatus('Publish failed', 'error');
    }
  }

  setStatus(message, variant = 'info') {
    if (!this.statusElement) return;
    this.statusElement.textContent = message;
    this.statusElement.dataset.status = variant;
  }
}
