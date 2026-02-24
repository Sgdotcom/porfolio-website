import { StateManager } from './stateManager.js';

function clamp(value, min, max) {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

function intersects(a, b) {
  if (!a || !b) return false;
  const aLeft = a.x;
  const aRight = a.x + a.w;
  const aTop = a.y;
  const aBottom = a.y + a.h;
  const bLeft = b.x;
  const bRight = b.x + b.w;
  const bTop = b.y;
  const bBottom = b.y + b.h;
  return aLeft < bRight && aRight > bLeft && aTop < bBottom && aBottom > bTop;
}

export class GridEngine {
  constructor(options = {}) {
    this.gridElement = options.gridElement || null;
    this.columns = options.columns || 10;
    this.stateManager = options.stateManager instanceof StateManager ? options.stateManager : null;
    this.editMode = Boolean(options.editMode);
    this.selectionCallback = () => {};
    this.selectedId = null;

    if (this.stateManager) {
      this.stateManager.subscribe((items) => this.render(items));
    }
  }

  onItemSelected(callback) {
    if (typeof callback === 'function') {
      this.selectionCallback = callback;
    }
  }

  render(items = []) {
    if (!this.gridElement) return;
    this.gridElement.innerHTML = '';

    const fragment = document.createDocumentFragment();

    if (!items.length) {
      const placeholder = document.createElement('div');
      placeholder.className = 'moodboard-post text-only moodboard-post-placeholder';
      placeholder.innerHTML = '<p>No gallery items yet.</p>';
      fragment.appendChild(placeholder);
    }

    items.forEach((item) => {
      const post = this.createPost(item);
      fragment.appendChild(post);
    });

    this.gridElement.appendChild(fragment);
  }

  createPost(item) {
    const post = document.createElement('article');
    post.className = `moodboard-post moodboard-post-${item.type}`;
    if (this.editMode) {
      post.classList.add('editable');
    }

    post.dataset.itemId = item.id;
    post.style.gridColumn = `${item.x + 1} / span ${Math.max(1, item.w)}`;
    post.style.gridRow = `${item.y + 1} / span ${Math.max(1, item.h)}`;

    if (item.type === 'image' || item.type === 'video') {
      if (item.type === 'video') {
        const video = document.createElement('video');
        video.autoplay = true;
        video.controls = false;
        video.loop = true;
        video.muted = true;
        video.playsInline = true;
        video.style.width = '100%';
        video.style.height = '100%';
        const source = document.createElement('source');
        source.src = item.pendingFile ? URL.createObjectURL(item.pendingFile) : item.src || item.path;
        video.appendChild(source);
        post.appendChild(video);
      } else {
        const img = document.createElement('img');
        img.src = item.pendingFile ? URL.createObjectURL(item.pendingFile) : item.src || item.path;
        img.alt = item.caption || '';
        img.loading = 'lazy';
        post.appendChild(img);
      }
    } else {
      const textBody = document.createElement('div');
      textBody.className = 'text-only-content';
      textBody.style.backgroundColor = item.bgColor;
      textBody.style.color = item.textColor;
      textBody.style.fontSize = `${item.fontSize}px`;
      textBody.textContent = item.content || item.caption || 'Text Block';
      post.appendChild(textBody);
    }

    if (this.editMode) {
      const dragHandle = document.createElement('span');
      dragHandle.className = 'drag-handle';
      dragHandle.textContent = '↕↔';
      post.appendChild(dragHandle);

      const resizeHandle = document.createElement('span');
      resizeHandle.className = 'resize-handle';
      post.appendChild(resizeHandle);

      post.addEventListener('pointerdown', (event) => {
        if (event.target === resizeHandle) return;
        this.beginInteraction(event, item, 'move');
      });

      resizeHandle.addEventListener('pointerdown', (event) => {
        this.beginInteraction(event, item, 'resize');
      });
    }

    post.addEventListener('click', () => this.selectItem(item.id));
    if (this.selectedId === item.id) {
      post.classList.add('selected');
    }

    return post;
  }

  selectItem(id) {
    this.selectedId = id;
    this.selectionCallback(this.stateManager.getItems().find((item) => item.id === id) || null);
    this.render(this.stateManager.getItems());
  }

  beginInteraction(event, item, mode) {
    if (!this.editMode || !this.stateManager) return;
    event.preventDefault();
    const { clientX: startX, clientY: startY } = event;
    const startData = { ...item };
    const gridRect = this.gridElement.getBoundingClientRect();
    const cellWidth = gridRect.width / this.columns;
    const rowHeight = cellWidth * 1.2;

    const onPointerMove = (moveEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const deltaY = moveEvent.clientY - startY;
      const deltaCols = Math.round(deltaX / cellWidth);
      const deltaRows = Math.round(deltaY / rowHeight);
      const candidate = { ...startData };

      if (mode === 'resize') {
        candidate.w = clamp(startData.w + deltaCols, 1, this.columns - startData.x);
        candidate.h = Math.max(1, startData.h + deltaRows);
      } else {
        candidate.x = clamp(startData.x + deltaCols, 0, this.columns - candidate.w);
        candidate.y = Math.max(0, startData.y + deltaRows);
      }

      if (!this.overlaps(candidate)) {
        this.stateManager.updateItem(item.id, candidate);
      }
    };

    const onPointerUp = () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  }

  overlaps(candidate) {
    const items = this.stateManager.getItems();
    return items.some((other) => other.id !== candidate.id && intersects(candidate, other));
  }
}
