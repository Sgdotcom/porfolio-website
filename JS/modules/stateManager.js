const DEFAULT_COLUMNS = 10;
const TEXT_DEFAULTS = {
  bgColor: '#ffffff',
  textColor: '#000000',
  fontSize: 16
};

function clamp(value, min, max) {
  if (value < min) return min;
  if (value > max) return max;
  return value;
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
    const width = item.w || (item.type === 'text' ? 2 : 3);
    const height = item.h || (item.type === 'text' ? 1 : 2);
    const x = typeof item.x === 'number'
      ? item.x
      : (index * 2) % DEFAULT_COLUMNS;
    const y = typeof item.y === 'number'
      ? item.y
      : Math.floor(((index * 2) / DEFAULT_COLUMNS)) * 2;

    return {
      id: item.id || `item-${this.idCounter++}`,
      type: item.type || 'image',
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
      pendingFile: null
    };
  }

  loadState(data = { items: [] }) {
    const items = (data.items || []).map((item, index) => this.normalizeItem(item, index));
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
      x: item.x,
      y: item.y,
      w: item.w,
      h: item.h,
      bgColor: item.bgColor || TEXT_DEFAULTS.bgColor,
      textColor: item.textColor || TEXT_DEFAULTS.textColor,
      fontSize: item.fontSize || TEXT_DEFAULTS.fontSize,
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

  deleteItem(id) {
    const prevLength = this.state.items.length;
    this.state.items = this.state.items.filter((item) => item.id !== id);
    if (this.state.items.length === prevLength) return false;
    this.notify();
    return true;
  }
}
