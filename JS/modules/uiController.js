import { StateManager } from './stateManager.js';

// Safely encode large binary files (images) to Base64 without call stack overflow
async function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      // The result looks like "data:image/jpeg;base64,/9j/4AAQSkZJRg..."
      // We only want the base64 part
      const base64String = reader.result.split(',')[1];
      resolve(base64String);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Safely encode Unicode text (like emojis, Å, Ä, Ö) to Base64
function unicodeToBase64(str) {
  // First encode as UTF-8, then to Base64. btoa() normally fails on Unicode.
  return btoa(unescape(encodeURIComponent(str)));
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
    this.isEditMode = false;
    this.isSyncingControls = false;

    this.initControls();
    this.initSelectionHandling();
    this.bindGridInteractions();
    this.bindKeyboardShortcuts();
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
    this.fontSize = this.controls.querySelector('select[name="font-size"], input[name="font-size"]');
    this.textAlignSelect = this.controls.querySelector('select[name="text-align"]');
    this.listBullet = this.controls.querySelector('[data-action="list-bullet"]');
    this.listNumbered = this.controls.querySelector('[data-action="list-numbered"]');

    this.addImage?.addEventListener('click', () => this.imageInput?.click());
    this.imageInput?.addEventListener('change', (event) => this.handleImageUpload(event.target.files));
    this.addText?.addEventListener('click', () => this.handleAddText());
    this.deleteButton?.addEventListener('click', () => this.handleDeleteSelected());
    this.publishButton?.addEventListener('click', () => this.handlePublish());

    this.bgPicker?.addEventListener('input', () => this.applySelectedStyle());
    this.textPicker?.addEventListener('input', () => this.applySelectedStyle());
    this.fontSize?.addEventListener('change', () => this.applyFontSizeToSelection());
    this.textAlignSelect?.addEventListener('change', () => this.applyAlignmentToSelection());
    this.listBullet?.addEventListener('click', () => this.gridEngine?.execCommandOnSelectedTextTile?.('insertUnorderedList'));
    this.listNumbered?.addEventListener('click', () => this.gridEngine?.execCommandOnSelectedTextTile?.('insertOrderedList'));
  }

  bindGridInteractions() {
    const grid = document.querySelector('.moodboard-grid');
    if (!grid) return;
    grid.addEventListener('pointerdown', (event) => {
      if (event.target.closest('.moodboard-post')) return;
      this.clearSelection();
    });
  }

  bindKeyboardShortcuts() {
    window.addEventListener('keydown', (event) => {
      if (!this.isEditMode) return;
      const target = document.activeElement;
      const inEditable = target?.isContentEditable || target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA';
      if (event.key === 'Delete' || event.key === 'Backspace') {
        if (inEditable) return;
        event.preventDefault();
        this.handleDeleteSelected();
      } else if (event.key === 'Escape') {
        if (inEditable) target?.blur?.();
        this.clearSelection();
      }
    });
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
    if (this.selectedItem && this.stateManager && !this.stateManager.findItem(this.selectedItem.id)) {
      this.clearSelection();
      return;
    }
    const hasSelection = Boolean(this.selectedItem);
    const isTextItem = hasSelection && this.selectedItem?.type === 'text';
    this.deleteButton?.toggleAttribute('disabled', !hasSelection);
    if (this.bgPicker) {
      this.bgPicker.disabled = !isTextItem;
      if (this.bgPicker.closest('.control-picker')) {
        this.bgPicker.closest('.control-picker').style.opacity = isTextItem ? '' : '0.5';
      }
    }
    if (this.textPicker) {
      this.textPicker.disabled = !isTextItem;
      if (this.textPicker.closest('.control-picker')) {
        this.textPicker.closest('.control-picker').style.opacity = isTextItem ? '' : '0.5';
      }
    }
    if (this.fontSize) {
      this.fontSize.disabled = !isTextItem;
      if (this.fontSize.closest('.control-picker')) {
        this.fontSize.closest('.control-picker').style.opacity = isTextItem ? '' : '0.5';
      }
    }
    if (this.textAlignSelect) {
      this.textAlignSelect.disabled = !isTextItem;
      if (this.textAlignSelect.closest('.control-picker')) {
        this.textAlignSelect.closest('.control-picker').style.opacity = isTextItem ? '' : '0.5';
      }
    }
    if (this.listBullet) {
      this.listBullet.disabled = !isTextItem;
      if (this.listBullet.closest('.control-picker')) {
        this.listBullet.closest('.control-picker').style.opacity = isTextItem ? '' : '0.5';
      }
    }
    if (this.listNumbered) {
      this.listNumbered.disabled = !isTextItem;
      if (this.listNumbered.closest('.control-picker')) {
        this.listNumbered.closest('.control-picker').style.opacity = isTextItem ? '' : '0.5';
      }
    }
    if (!hasSelection) return;
    this.isSyncingControls = true;
    if (this.bgPicker) {
      this.bgPicker.setAttribute('value', this.selectedItem.bgColor || '#ffffff');
    }
    if (this.textPicker) {
      this.textPicker.setAttribute('value', this.selectedItem.textColor || '#000000');
    }
    if (this.fontSize) {
      this.fontSize.value = this.selectedItem.fontSize || 16;
    }
    if (this.textAlignSelect) {
      this.textAlignSelect.value = this.selectedItem.textAlign || 'left';
    }
    this.isSyncingControls = false;
  }

  clearSelection() {
    this.selectedItem = null;
    this.gridEngine?.selectItem?.(null);
    this.syncControls();
  }

  setEditMode(enabled) {
    this.isEditMode = Boolean(enabled);
    document.body.classList.toggle('cms-edit-mode', this.isEditMode);
    if (this.controls) {
      this.controls.classList.toggle('hidden', !this.isEditMode);
    }
    this.gridEngine?.setEditMode?.(this.isEditMode);
  }

  applySelectedStyle() {
    if (!this.selectedItem || !this.stateManager || this.isSyncingControls) return;
    if (this.selectedItem.type !== 'text') return;
    if (!this.stateManager.findItem(this.selectedItem.id)) return;
    this.stateManager.updateItem(this.selectedItem.id, {
      bgColor: this.bgPicker?.value || '#ffffff',
      textColor: this.textPicker?.value || '#000000'
    });
  }

  /** Apply font size to current selection only (not whole tile). */
  applyFontSizeToSelection() {
    if (!this.selectedItem || this.selectedItem.type !== 'text' || !this.gridEngine) return;
    const size = Number(this.fontSize?.value) || 16;
    this.gridEngine.applyFontSizeToSelection(size);
  }

  /** Apply alignment to current selection/line in the selected text tile (per-line, not whole tile). */
  applyAlignmentToSelection() {
    if (!this.selectedItem || this.selectedItem.type !== 'text' || !this.gridEngine) return;
    const alignToCommand = { left: 'justifyLeft', center: 'justifyCenter', right: 'justifyRight' };
    const value = this.textAlignSelect?.value || 'left';
    this.gridEngine.execCommandOnSelectedTextTile(alignToCommand[value] || 'justifyLeft');
  }

  handleImageUpload(files) {
    if (!files?.length || !this.stateManager || !this.gridEngine) return;
    Array.from(files).forEach((file) => {
      this.stateManager.shiftAllRowsDown(1);
      const id = `item-${Date.now()}-${Math.round(Math.random() * 1e5)}`;
      const item = this.stateManager.addItem({
        id,
        type: 'image',
        path: '',
        src: '',
        caption: file.name,
        x: 0,
        y: 0,
        w: 1,
        h: 1
      });
      item.pendingFile = file;
      this.pendingUploads.set(item.id, file);
      this.stateManager.updateItem(item.id, { pendingFile: file });
    });
    if (this.imageInput) this.imageInput.value = '';
  }

  handleAddText() {
    if (!this.stateManager || !this.gridEngine) return;
    this.stateManager.shiftAllRowsDown(1);
    const id = `item-text-${Date.now()}-${Math.round(Math.random() * 1e5)}`;
    this.stateManager.addItem({
      id,
      type: 'text',
      content: '',
      caption: '',
      x: 0,
      y: 0,
      w: 1,
      h: 1,
      bgColor: '#ffffff',
      textColor: '#666',
      fontSize: 12
    });
    this.gridEngine.selectItem(id);
    requestAnimationFrame(() => {
      this.gridEngine.focusTextItem?.(id);
    });
  }

  handleDeleteSelected() {
    if (!this.selectedItem || !this.stateManager) return;
    const id = this.selectedItem.id;
    this.gridEngine?.selectItem?.(null);
    this.selectedItem = null;
    this.pendingUploads.delete(id);
    this.stateManager.deleteItem(id);
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
          const targetPath = `assets/uploads/${item.id.replace(/[^a-zA-Z0-9_-]/g, '')}-${item.pendingFile.name}`.replace(/\s+/g, '-');
          // Use safe async base64 encoding
          const base64 = await fileToBase64(item.pendingFile);
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
          fontSize: item.fontSize,
          textAlign: item.textAlign
        }))
      };

      // Use safe Unicode-to-Base64 encoding rather than standard btoa()
      const payload = unicodeToBase64(JSON.stringify(serialized, null, 2));
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
