import { StateManager } from './stateManager.js';

const DEFAULT_COLUMNS = 10;
const GRID_BREAKPOINTS = {
  mobile: 576,
  tablet: 992
};
const UNIT_ASPECT_RATIO = 4 / 3;

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
    this.columns = options.columns || DEFAULT_COLUMNS;
    this.stateManager = options.stateManager instanceof StateManager ? options.stateManager : null;
    this.editMode = Boolean(options.editMode);
    this.breakpoints = options.breakpoints || GRID_BREAKPOINTS;
    this.aspectRatio = options.aspectRatio || UNIT_ASPECT_RATIO;
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
}

function getGridColumnsForWidth(viewportWidth = window.innerWidth, breakpoints = GRID_BREAKPOINTS) {
  if (viewportWidth <= breakpoints.mobile) return 2;
  if (viewportWidth <= breakpoints.tablet) return 5;
  return DEFAULT_COLUMNS;
}

function isAreaAvailable(occupancy, row, col, widthUnits, heightUnits, columns) {
  for (let r = row; r < row + heightUnits; r += 1) {
    for (let c = col; c < col + widthUnits; c += 1) {
      if (c >= columns) return false;
      if (occupancy[r] && occupancy[r][c]) return false;
    }
  }
  return true;
}

function markArea(occupancy, row, col, widthUnits, heightUnits, columns) {
  for (let r = row; r < row + heightUnits; r += 1) {
    if (!occupancy[r]) occupancy[r] = new Array(columns).fill(false);
    for (let c = col; c < col + widthUnits; c += 1) {
      occupancy[r][c] = true;
    }
  }
}

function getPostDataId(postElement) {
  const dataId = postElement.getAttribute('data-id');
  if (dataId) return dataId;
  const media = postElement.querySelector('img, video');
  if (media) return media.getAttribute('data-src') || media.getAttribute('src') || '';
  return (postElement.textContent || '').trim().substring(0, 30) || `item-${Date.now()}`;
}

function getPostType(postElement) {
  if (postElement.classList.contains('text-placeholder')) return 'placeholder';
  if (postElement.classList.contains('text-only') || postElement.classList.contains('text-break')) return 'text';
  if (postElement.querySelector('video')) return 'video';
  if (postElement.querySelector('img')) return 'image';
  return 'media';
}

function getPostContent(postElement) {
  const textBody = postElement.querySelector('.text-only-content');
  if (textBody && textBody.textContent.trim()) return textBody.textContent.trim();
  const placeholder = postElement.querySelector('.placeholder-body');
  if (placeholder && placeholder.textContent.trim()) return placeholder.textContent.trim();
  const caption = postElement.querySelector('.caption');
  if (caption && caption.textContent.trim()) return caption.textContent.trim();
  return '';
}

export function buildLayoutFromDom(gridElement, options = {}) {
  if (!gridElement) return [];
  const posts = Array.from(gridElement.querySelectorAll('.moodboard-post'));
  if (!posts.length) return [];

  const breakpoints = options.breakpoints || GRID_BREAKPOINTS;
  const columns = getGridColumnsForWidth(window.innerWidth, breakpoints);
  const occupancy = [];
  const seedItems = [];

  posts.forEach((postElement) => {
    const widthUnits = clamp(Number(postElement.getAttribute('data-w-units')) || 1, 1, columns);
    const heightUnits = Math.max(1, Number(postElement.getAttribute('data-h-units')) || 1);
    let row = 0;
    let col = 0;
    let placed = false;

    while (!placed) {
      if (isAreaAvailable(occupancy, row, col, widthUnits, heightUnits, columns)) {
        markArea(occupancy, row, col, widthUnits, heightUnits, columns);
        placed = true;
        const media = postElement.querySelector('img, video');
        const src = media ? (media.getAttribute('data-src') || media.getAttribute('src') || '') : '';
        const caption = postElement.querySelector('.caption')?.textContent?.trim() || '';

        seedItems.push({
          id: getPostDataId(postElement),
          type: getPostType(postElement),
          path: src,
          src,
          caption,
          content: getPostContent(postElement),
          x: col,
          y: row,
          w: widthUnits,
          h: heightUnits,
          bgColor: '#ffffff',
          textColor: '#000000',
          fontSize: 16
        });
      } else {
        col += 1;
        if (col >= columns) {
          col = 0;
          row += 1;
        }
      }
    }
  });

  return seedItems;
}
