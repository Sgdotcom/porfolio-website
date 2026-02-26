const DEFAULT_COLUMNS = 10;
const TEXT_DEFAULTS = {
  bgColor: '#ffffff',
  textColor: '#000000',
  fontSize: 16,
  textAlign: 'left'
};

function clamp(value, min, max) {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

function isAreaAvailable(occupancy, row, col, width, height, columns) {
  for (let r = row; r < row + height; r += 1) {
    if (!occupancy[r]) occupancy[r] = new Array(columns).fill(false);
    for (let c = col; c < col + width; c += 1) {
      if (c >= columns) return false;
      if (occupancy[r][c]) return false;
    }
  }
  return true;
}

function markArea(occupancy, row, col, width, height, columns) {
  for (let r = row; r < row + height; r += 1) {
    if (!occupancy[r]) occupancy[r] = new Array(columns).fill(false);
    for (let c = col; c < col + width; c += 1) {
      occupancy[r][c] = true;
    }
  }
}

function findAvailableSlot(occupancy, width, height, columns, startRow = 0) {
  let row = Math.max(0, startRow);
  while (row < 1000) {
    for (let col = 0; col <= columns - width; col += 1) {
      if (isAreaAvailable(occupancy, row, col, width, height, columns)) {
        return { row, col };
      }
    }
    row += 1;
  }
  return { row: 0, col: 0 };
}

export class StateManager {
  constructor() {
    this.state = { items: [] };
    this.listeners = [];
    this.idCounter = 0;
  }

  subscribe(callback) {
    if (typeof callback !== 'function') return;
    this.listeners.push(callback);
    callback(this.state.items);
  }

  notify() {
    this.listeners.forEach((cb) => cb(this.state.items));
  }

  normalizeItem(item, index) {
    const width = typeof item.w === 'number' ? item.w : (item.type === 'text' ? 2 : 1);
    const height = typeof item.h === 'number' ? item.h : (item.type === 'text' ? 1 : 1);
    const x = typeof item.x === 'number'
      ? item.x
      : index % DEFAULT_COLUMNS;
    const y = typeof item.y === 'number'
      ? item.y
      : Math.floor(index / DEFAULT_COLUMNS);

    const rawType = (item.type || 'image').toLowerCase();
    return {
      id: item.id || `item-${this.idCounter++}`,
      type: rawType === 'video' ? 'video' : (rawType === 'text' ? 'text' : 'image'),
      path: item.path || item.src || '',
      src: item.src || item.path || '',
      caption: item.caption || '',
      content: item.content || item.caption || '',
      x: clamp(x, 0, DEFAULT_COLUMNS - width),
      y: Math.max(0, y),
      w: clamp(width, 1, DEFAULT_COLUMNS),
      h: Math.max(1, height),
      bgColor: item.bgColor || TEXT_DEFAULTS.bgColor,
      textColor: item.textColor || TEXT_DEFAULTS.textColor,
      fontSize: Number(item.fontSize) || TEXT_DEFAULTS.fontSize,
      textAlign: item.textAlign || TEXT_DEFAULTS.textAlign,
      pendingFile: null
    };
  }

  loadState(data = { items: [] }) {
    const raw = data.items || [];
    const path = (item) => (item.path || item.src || '').trim();
    const type = (item) => (item.type || 'image').toLowerCase();
    // Keep all videos; drop only image/media without path so we never render white image tiles
    const filtered = raw.filter((item) => {
      if (type(item) === 'video') return true;
      if (type(item) === 'image') return path(item).length > 0;
      return true;
    });
    const items = filtered.map((item, index) => this.normalizeItem(item, index));
    this.state.items = items;
    this.notify();
  }

  getItems() {
    return this.state.items.map((item) => ({ ...item }));
  }

  findItem(id) {
    return this.state.items.find((item) => item.id === id);
  }

  updateItem(id, newData) {
    const idx = this.state.items.findIndex((item) => item.id === id);
    if (idx === -1) return false;
    this.state.items[idx] = {
      ...this.state.items[idx],
      ...newData
    };
    this.notify();
    return true;
  }

  replaceItems(items) {
    this.state.items = items.map((item, index) => ({
      id: item.id || `item-${this.idCounter++}`,
      type: item.type || 'image',
      path: item.path || '',
      src: item.src || item.path || '',
      caption: item.caption || '',
      content: item.content || item.caption || '',
      x: typeof item.x === 'number' ? item.x : index % DEFAULT_COLUMNS,
      y: typeof item.y === 'number' ? item.y : Math.floor(index / DEFAULT_COLUMNS),
      w: 1,
      h: 1,
      bgColor: item.bgColor || TEXT_DEFAULTS.bgColor,
      textColor: item.textColor || TEXT_DEFAULTS.textColor,
      fontSize: item.fontSize || TEXT_DEFAULTS.fontSize,
      textAlign: item.textAlign || TEXT_DEFAULTS.textAlign,
      pendingFile: item.pendingFile || null
    }));
    this.notify();
  }

  addItem(item) {
    const normalized = this.normalizeItem(item, this.state.items.length);
    this.state.items.push(normalized);
    this.notify();
    return normalized;
  }

  moveItem(id, coords = {}) {
    const { x, y } = coords;
    if (!Number.isFinite(x) && !Number.isFinite(y)) return false;

    // Construct updates dynamically to prevent `undefined` from overwriting valid existing values
    const updates = {};
    if (Number.isFinite(x)) updates.x = Math.max(0, x);
    if (Number.isFinite(y)) updates.y = Math.max(0, y);
    if (Number.isFinite(coords.w)) updates.w = coords.w;
    if (Number.isFinite(coords.h)) updates.h = coords.h;

    return this.updateItem(id, updates);
  }

  /** Apply many position updates in one go; notifies once. Used by reflowGrid to avoid N renders. */
  applyPositionUpdates(updates) {
    if (!Array.isArray(updates) || !updates.length) return;
    let changed = false;
    for (const { id, x, y } of updates) {
      if (id == null || (!Number.isFinite(x) && !Number.isFinite(y))) continue;
      const idx = this.state.items.findIndex((item) => item.id === id);
      if (idx === -1) continue;
      const item = this.state.items[idx];
      const newX = Number.isFinite(x) ? Math.max(0, x) : item.x;
      const newY = Number.isFinite(y) ? Math.max(0, y) : item.y;
      if (item.x !== newX || item.y !== newY) {
        item.x = newX;
        item.y = newY;
        changed = true;
      }
    }
    if (changed) this.notify();
  }

  // Shift every item down by `offset` rows so (0,0) is free for a new tile. Notifies once.
  shiftAllRowsDown(offset = 1) {
    if (offset <= 0) return;
    this.state.items.forEach((item) => {
      item.y += offset;
    });
    this.notify();
  }

  deleteItem(id) {
    const prevLength = this.state.items.length;
    this.state.items = this.state.items.filter((item) => item.id !== id);
    if (this.state.items.length === prevLength) return false;
    this.notify();
    return true;
  }
}
