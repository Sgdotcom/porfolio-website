import { StateManager } from './stateManager.js';
import { initTextEditor, setEditorContent } from './textTileEditor.js';

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
    this.isMoving = false;
    this.breakpoints = options.breakpoints || GRID_BREAKPOINTS;
    this.selectionCallback = () => { };
    this.selectedId = null;

    if (this.stateManager) {
      this.stateManager.subscribe(() => {
        this.render(this.stateManager.getItems());
      });
    }
  }

  onItemSelected(callback) {
    if (typeof callback === 'function') {
      this.selectionCallback = callback;
    }
  }

  setEditMode(flag) {
    this.editMode = Boolean(flag);
    this.render(this.stateManager?.getItems() || []);
  }

  getRowHeight(fallbackWidth = null) {
    if (!this.gridElement) return 0;
    const computed = window.getComputedStyle(this.gridElement);
    const cssRowHeight = parseFloat(computed.getPropertyValue('--grid-row-height'));

    // Always prioritize a calculated 4:5 Portrait CSS ratio if possible
    const width = fallbackWidth || this.gridElement.getBoundingClientRect().width;
    const columnWidth = width / Math.max(1, this.columns);

    // We explicitly want 4:5 portrait aspect ratio blocks, so Height = Width * 1.25.
    // Round to whole pixels to avoid sub-pixel anti-alias seams between grid rows.
    return Math.max(1, Math.round(columnWidth * 1.25));
  }

  render(items = []) {
    if (!this.gridElement) return;

    // Apply the strict portrait row height dynamically based on current client width
    this.gridElement.style.gridAutoRows = `${this.getRowHeight()}px`;

    // Remove obsolete posts, but LEAVE the dragging one alone
    Array.from(this.gridElement.children).forEach((child) => {
      const id = child.dataset.itemId;
      if (!items.find((item) => item.id === id) && id !== this.selectedId) {
        const img = child.querySelector('img');
        if (img?._objectURL) URL.revokeObjectURL(img._objectURL);
        child.remove();
      }
    });

    if (!items.length) {
      this.gridElement.innerHTML = '<div class="moodboard-post text-only moodboard-post-placeholder"><p>No gallery items yet.</p></div>';
      return;
    }

    items.forEach((item) => {
      let post = this.gridElement.querySelector(`[data-item-id="${item.id}"]`);

      // If the post exists but its editMode state doesn't match our current Engine state, destroy it so it rebuilds!
      if (post && post.classList.contains('editable') !== this.editMode) {
        post.remove();
        post = null;
      }

      if (post) {
        // Skip modifying grid coords if it's the item currently being dragged smoothly by pointer
        if (post.classList.contains('dragging') || post.classList.contains('resizing')) return;

        post.style.gridColumn = `${item.x + 1} / span ${Math.max(1, item.w)}`;
        post.style.gridRow = `${item.y + 1} / span ${Math.max(1, item.h)}`;

        const isVideo = (it) => (it.type || '').toLowerCase() === 'video';
        if (item.type === 'image' && !isVideo(item)) {
          const img = post.querySelector('img');
          if (img) {
            if (item.pendingFile) {
              if (img._objectURL) URL.revokeObjectURL(img._objectURL);
              img._objectURL = URL.createObjectURL(item.pendingFile);
              img.src = img._objectURL;
            } else {
              const src = (item.src || item.path || '').trim();
              if (src) {
                img.classList.remove('moodboard-img-error');
                img.src = src;
                img.onerror = () => img.classList.add('moodboard-img-error');
              }
              // Never set img.src to empty; leave existing src to avoid white tiles
            }
          }
        }
        if (isVideo(item)) {
          const video = post.querySelector('video');
          if (video) {
            const source = video.querySelector('source') || video;
            const src = (item.src || item.path || '').trim();
            if (item.pendingFile) {
              if (video._objectURL) URL.revokeObjectURL(video._objectURL);
              video._objectURL = URL.createObjectURL(item.pendingFile);
              source.src = video._objectURL;
              video.classList.remove('moodboard-video-placeholder');
              video.load();
            } else if (src) {
              const currentSrc = source.getAttribute('src') || source.src || '';
              if (currentSrc !== src) {
                video.classList.remove('moodboard-video-placeholder', 'moodboard-video-error');
                const oldMsg = post.querySelector('.moodboard-video-error-msg');
                if (oldMsg) oldMsg.remove();
                source.src = src;
                video.load();
                video.play().catch(() => {});
              } else if (video.paused && video.readyState >= 2) {
                video.play().catch(() => {});
              }
            }
            // Never set video source to empty; leave existing to avoid white tiles
          }
        }
        if (item.type === 'text') {
          post.style.backgroundColor = item.bgColor;
          const textBody = post.querySelector('.text-only-content');
          if (textBody) {
            textBody.style.color = item.textColor;
            textBody.style.fontSize = `${item.fontSize}px`;
            /* Alignment is per-line via execCommand; no whole-tile override. */
            if (document.activeElement !== textBody) setEditorContent(textBody, item.content || item.caption || '');
          }
        }
      } else {
        // Only create new DOM elements if they don't exist yet (or were just destroyed above)
        post = this.createPost(item);
        this.gridElement.appendChild(post);
      }
    });
  }

  createPost(item) {
    const post = document.createElement('article');
    const typeClass = (item.type || 'image').toLowerCase();
    post.className = `moodboard-post moodboard-post-${typeClass}`;
    if (this.editMode) {
      post.classList.add('editable');
    }

    post.dataset.itemId = item.id;
    post.style.gridColumn = `${item.x + 1} / span ${Math.max(1, item.w)}`;
    post.style.gridRow = `${item.y + 1} / span ${Math.max(1, item.h)}`;

    const isVideo = (it) => (it.type || '').toLowerCase() === 'video';
    if (item.type === 'image' || item.type === 'video' || isVideo(item)) {
      if (isVideo(item)) {
        const video = document.createElement('video');
        video.autoplay = true;
        video.controls = false;
        video.loop = true;
        video.muted = true;
        video.playsInline = true;
        video.style.width = '100%';
        video.style.height = '100%';
        const source = document.createElement('source');
        const src = (item.src || item.path || '').trim();
        if (item.pendingFile) {
          video._objectURL = URL.createObjectURL(item.pendingFile);
          source.src = video._objectURL;
          video.appendChild(source);
          video.load();
        } else if (src) {
          source.src = src;
          source.type = /\.mov$/i.test(src) ? 'video/quicktime' : 'video/mp4';
          video.appendChild(source);
          video.addEventListener('error', () => {
            video.classList.add('moodboard-video-error');
            if (!post.querySelector('.moodboard-video-error-msg')) {
              const msg = document.createElement('span');
              msg.className = 'moodboard-video-error-msg';
              msg.setAttribute('aria-live', 'polite');
              msg.textContent = 'Format not supported. Use MP4 for web.';
              post.appendChild(msg);
            }
          });
          video.load();
          video.play().catch(() => {});
        } else {
          video.classList.add('moodboard-video-placeholder');
          video.appendChild(source);
        }
        post.appendChild(video);
      } else {
        const img = document.createElement('img');
        if (item.pendingFile) {
          img._objectURL = URL.createObjectURL(item.pendingFile);
          img.src = img._objectURL;
        } else {
          const src = (item.src || item.path || '').trim();
          if (src) {
            img.src = src;
            img.onerror = () => img.classList.add('moodboard-img-error');
          } else {
            img.classList.add('moodboard-img-placeholder');
            // Avoid empty src so the tile isn't a broken white image; use subtle fill
            img.src = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"><rect width="1" height="1" fill="#f0f0f0"/></svg>');
          }
        }
        img.alt = item.caption || '';
        img.loading = 'lazy';
        post.appendChild(img);
      }
    } else {
      post.style.backgroundColor = item.bgColor;
      initTextEditor(post, item, this.editMode, (html) => {
        this.stateManager?.updateItem(item.id, { content: html, caption: html });
      });
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
        if (event.target.closest?.('.text-only-content') || event.target.closest?.('.text-tile-toolbar-wrap')) return;
        this.beginInteraction(event, item, 'move', post);
      });

      resizeHandle.addEventListener('pointerdown', (event) => {
        this.beginInteraction(event, item, 'resize', post);
      });
    }

    post.addEventListener('click', () => this.selectItem(item.id));
    if (this.selectedId === item.id) {
      post.classList.add('selected');
    }

    return post;
  }

  focusTextItem(id) {
    const post = this.gridElement?.querySelector(`[data-item-id="${id}"]`);
    const textBody = post?.querySelector('.text-only-content[contenteditable="true"]');
    if (textBody) {
      textBody.focus();
    }
  }

  /** Run execCommand on the selected text tile's contenteditable (alignment, lists). Restores saved selection so commands apply per-line. */
  execCommandOnSelectedTextTile(command, value = null) {
    if (!this.selectedId) return;
    const item = this.stateManager?.findItem(this.selectedId);
    if (!item || item.type !== 'text') return;
    const post = this.gridElement?.querySelector(`[data-item-id="${this.selectedId}"]`);
    const textBody = post?.querySelector('.text-only-content[contenteditable="true"]');
    if (!textBody) return;
    textBody.focus();
    const sel = window.getSelection();
    if (sel && textBody._savedRange) {
      try {
        sel.removeAllRanges();
        sel.addRange(textBody._savedRange);
      } catch (_) {
        /* Range may be invalid if DOM changed; proceed without restoring. */
      }
    }
    try {
      if (value != null) document.execCommand(command, false, value);
      else document.execCommand(command, false);
    } catch (_) {}
    textBody.dispatchEvent(new Event('input', { bubbles: true }));
  }

  /** Apply font size (px) to the current selection only in the selected text tile. Wraps selection in a span. */
  applyFontSizeToSelection(pixelSize) {
    if (!this.selectedId || !Number.isFinite(pixelSize) || pixelSize < 8 || pixelSize > 96) return;
    const item = this.stateManager?.findItem(this.selectedId);
    if (!item || item.type !== 'text') return;
    const post = this.gridElement?.querySelector(`[data-item-id="${this.selectedId}"]`);
    const textBody = post?.querySelector('.text-only-content[contenteditable="true"]');
    if (!textBody) return;
    textBody.focus();
    const sel = window.getSelection();
    if (sel && textBody._savedRange) {
      try {
        sel.removeAllRanges();
        sel.addRange(textBody._savedRange);
      } catch (_) {}
    }
    if (!sel || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    if (!textBody.contains(range.commonAncestorContainer)) return;
    if (range.collapsed) return; /* no selection */
    try {
      const fragment = range.extractContents();
      const span = document.createElement('span');
      span.style.fontSize = `${pixelSize}px`;
      span.appendChild(fragment);
      range.insertNode(span);
      range.setStartAfter(span);
      range.collapse(true);
      sel.removeAllRanges();
      sel.addRange(range);
    } catch (_) {}
    textBody.dispatchEvent(new Event('input', { bubbles: true }));
  }

  selectItem(id) {
    this.selectedId = id;
    const selected = id ? this.stateManager.getItems().find((item) => item.id === id) : null;
    this.selectionCallback(selected || null);

    // Add/remove selected class visually without requiring a full render
    Array.from(this.gridElement?.children || []).forEach(child => {
      if (child.dataset.itemId === id) child.classList.add('selected');
      else child.classList.remove('selected');
    });
  }

  beginInteraction(event, initialItem, mode, postElement = null) {
    if (!this.editMode || !this.stateManager) return;

    // CRITICAL FIX: The DOM event listener closures retain the original `initialItem` from when the HTML was generated.
    // If we've resized or moved this item recently, those dimensions are stale. We MUST pull the live item.
    const item = this.stateManager.findItem(initialItem.id) || initialItem;

    event.preventDefault();
    event.stopPropagation();
    const { clientX: startX, clientY: startY } = event;
    const startData = { ...item };
    const gridRect = this.gridElement.getBoundingClientRect();
    const cellWidth = gridRect.width / this.columns;
    const rowHeight = this.getRowHeight(gridRect.width);
    const targetPost = postElement || this.gridElement?.querySelector(`[data-item-id="${item.id}"]`);

    // Create candidate for finalized drop coordinates
    let dropCandidate = { ...startData };
    let didMove = false;

    if (targetPost) {
      targetPost.style.zIndex = '100'; // elevate visually
      targetPost.classList.add(mode === 'resize' ? 'resizing' : 'dragging');
      // Fix visual jump: compute exact current translation origin if moving
      if (mode === 'move') {
        const rect = targetPost.getBoundingClientRect();
        targetPost.dataset.snapStartX = rect.left;
        targetPost.dataset.snapStartY = rect.top;
      }
    }

    const pointerTarget = event.currentTarget;
    if (event.pointerId && pointerTarget?.setPointerCapture) {
      pointerTarget.setPointerCapture(event.pointerId);
    }

    const getGridPosition = (moveEvent) => {
      const rect = this.gridElement.getBoundingClientRect();
      const relativeX = moveEvent.clientX - rect.left;
      const relativeY = moveEvent.clientY - rect.top;
      const columnWidth = rect.width / this.columns;
      const rowHeightValue = this.getRowHeight(rect.width);
      const targetColumn = clamp(Math.floor(relativeX / columnWidth), 0, this.columns - Math.max(1, startData.w));
      const targetRow = Math.max(0, Math.floor(relativeY / rowHeightValue));
      return { x: targetColumn, y: targetRow };
    };

    if (mode === 'move') {
      this.isMoving = true;
      this.selectItem(item.id);
    }

    let pushThrottle = null;

    const onPointerMove = (moveEvent) => {
      didMove = true;
      const deltaX = moveEvent.clientX - startX;
      const deltaY = moveEvent.clientY - startY;

      if (mode === 'move') {
        // Visually translate the element smoothly tracking the pointer
        if (targetPost) {
          targetPost.style.transform = `scale(1.05) translate(${deltaX}px, ${deltaY}px)`;
        }

        // Calculate the theoretical drop candidate
        const { x: targetX, y: targetY } = getGridPosition(moveEvent);
        if (dropCandidate.x === targetX && dropCandidate.y === targetY) return;

        // CRITICAL FIX: To prevent resized items from reverting to their original size
        // when dragged, we MUST pull the most recent w/h from the authoritative stateManager,
        // rather than the startData which was cached when the pointer went down.
        const liveItem = this.stateManager.findItem(item.id) || startData;
        dropCandidate = { ...startData, x: targetX, y: targetY, w: liveItem.w, h: liveItem.h };

        // iPhone Feature: Push other items out of the way while dragging!
        // We throttle it slightly so it doesn't thrash the state engine
        if (!pushThrottle) {
          pushThrottle = setTimeout(() => {
            const allItems = this.stateManager.getItems();
            // Find who we are currently crushing
            const crushedItems = allItems.filter(
              (other) => other.id !== item.id && intersects(dropCandidate, other)
            );

            // Place the dragged tile and reflow the rest deterministically.
            this.stateManager.moveItem(item.id, dropCandidate);
            this.reflowGrid(dropCandidate);
            startData.x = targetX;
            startData.y = targetY;

            pushThrottle = null;
          }, 80); // 80ms delay before shifting apps feels natural
        }
        return;
      }

      // Resize mode: only visual preview here. State and resolveCollisions run once on pointerup.
      const deltaCols = Math.round(deltaX / cellWidth);
      const deltaRows = Math.round(deltaY / rowHeight);

      dropCandidate.w = clamp(startData.w + deltaCols, 1, this.columns - startData.x);
      dropCandidate.h = Math.max(1, startData.h + deltaRows);

      if (targetPost) {
        targetPost.style.gridColumn = `${dropCandidate.x + 1} / span ${Math.max(1, dropCandidate.w)}`;
        targetPost.style.gridRow = `${dropCandidate.y + 1} / span ${Math.max(1, dropCandidate.h)}`;
      }
    };

    const onPointerUp = () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);

      if (pushThrottle) {
        if (mode === 'resize') cancelAnimationFrame(pushThrottle);
        else clearTimeout(pushThrottle);
      }

      if (event.pointerId && pointerTarget?.releasePointerCapture) {
        pointerTarget.releasePointerCapture(event.pointerId);
      }

      if (targetPost) {
        targetPost.classList.remove('dragging', 'resizing');
        targetPost.style.transform = ''; // reset translate to let CSS Grid take over
        targetPost.style.zIndex = '';

        // If we dropped it, force it into its final CSS grid slot immediately
        targetPost.style.gridColumn = `${dropCandidate.x + 1} / span ${Math.max(1, dropCandidate.w)}`;
        targetPost.style.gridRow = `${dropCandidate.y + 1} / span ${Math.max(1, dropCandidate.h)}`;
      }

      if (mode === 'move') {
        this.isMoving = false;
        if (didMove) {
          this.stateManager.moveItem(item.id, dropCandidate);
          this.reflowGrid(dropCandidate);
        }
      } else if (didMove) {
        this.stateManager.updateItem(item.id, {
          x: dropCandidate.x,
          y: dropCandidate.y,
          w: dropCandidate.w,
          h: dropCandidate.h
        });
        const final = this.stateManager.findItem(item.id);
        if (final) this.reflowGrid(final);
      }
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  }

  overlaps(candidate) {
    const items = this.stateManager.getItems();
    return items.some((other) => other.id !== candidate.id && intersects(candidate, other));
  }

  // Returns the first (x, y) slot where a tile of size w×h fits; other tiles stay put.
  getFirstAvailableSlot(w = 1, h = 1) {
    if (!this.stateManager) return { x: 0, y: 0 };
    const items = this.stateManager.getItems();
    const columns = this.columns;
    const occupancy = [];
    const markOccupied = (occ, item) => {
      for (let r = item.y; r < item.y + item.h; r++) {
        if (!occ[r]) occ[r] = new Array(columns).fill(false);
        for (let c = item.x; c < item.x + item.w; c++) {
          if (c < columns) occ[r][c] = true;
        }
      }
    };
    const canFitHere = (occ, testX, testY, testW, testH) => {
      if (testX + testW > columns) return false;
      for (let r = testY; r < testY + testH; r++) {
        if (!occ[r]) continue;
        for (let c = testX; c < testX + testW; c++) {
          if (occ[r][c]) return false;
        }
      }
      return true;
    };
    items.forEach((item) => markOccupied(occupancy, item));
    for (let row = 0; row < 1000; row++) {
      for (let col = 0; col <= columns - w; col++) {
        if (canFitHere(occupancy, col, row, w, h)) return { x: col, y: row };
      }
    }
    return { x: 0, y: 0 };
  }

  // Pack all items upward so there are no empty rows (removes large gaps).
  // Optional excludeId: do not move this item (e.g. the one just dropped/resized).
  compactGrid(excludeId = null) {
    if (!this.stateManager) return;
    const items = this.stateManager.getItems().slice();
    if (!items.length) return;

    const columns = this.columns;
    const occupancy = [];

    const canFitHere = (occ, testX, testY, testW, testH) => {
      if (testX + testW > columns) return false;
      for (let r = testY; r < testY + testH; r++) {
        if (!occ[r]) continue;
        for (let c = testX; c < testX + testW; c++) {
          if (occ[r][c]) return false;
        }
      }
      return true;
    };
    const markOccupied = (occ, item) => {
      for (let r = item.y; r < item.y + item.h; r++) {
        if (!occ[r]) occ[r] = new Array(columns).fill(false);
        for (let c = item.x; c < item.x + item.w; c++) {
          if (c < columns) occ[r][c] = true;
        }
      }
    };

    // Process in top-to-bottom, left-to-right order so we don't push items that are already well-placed
    items.sort((a, b) => {
      if (a.y !== b.y) return a.y - b.y;
      return a.x - b.x;
    });

    items.forEach((item) => {
      if (excludeId && item.id === excludeId) {
        markOccupied(occupancy, item);
        return;
      }
      let bestRow = 0;
      let bestCol = 0;
      let found = false;
      for (let row = 0; row <= item.y + 1 && !found; row++) {
        for (let col = 0; col <= columns - item.w; col++) {
          if (canFitHere(occupancy, col, row, item.w, item.h)) {
            bestRow = row;
            bestCol = col;
            found = true;
            break;
          }
        }
      }
      if (!found) {
        for (let row = 0; row < 1000; row++) {
          for (let col = 0; col <= columns - item.w; col++) {
            if (canFitHere(occupancy, col, row, item.w, item.h)) {
              bestRow = row;
              bestCol = col;
              found = true;
              break;
            }
          }
          if (found) break;
        }
      }
      if (found && (item.x !== bestCol || item.y !== bestRow)) {
        item.x = bestCol;
        item.y = bestRow;
        this.stateManager.moveItem(item.id, { x: bestCol, y: bestRow });
      }
      if (found) markOccupied(occupancy, item);
    });
  }

  // Deterministic reflow: place all items in stable order with no gaps. No gravity, no crushed-item logic.
  // Optional anchor: item that was just moved/resized; place it first at (anchor.x, anchor.y), then place the rest in first-fit.
  reflowGrid(anchor = null) {
    if (!this.stateManager) return;
    const columns = this.columns;
    let items = this.stateManager.getItems().slice();
    if (!items.length) return;

    const occupancy = [];
    const w = (it) => Math.max(1, Number(it.w) || 1);
    const h = (it) => Math.max(1, Number(it.h) || 1);
    const positionUpdates = [];

    const stableOrder = (a, b) => {
      const ay = Number(a.y) || 0;
      const by = Number(b.y) || 0;
      if (ay !== by) return ay - by;
      const ax = Number(a.x) || 0;
      const bx = Number(b.x) || 0;
      if (ax !== bx) return ax - bx;
      return (a.id || '').localeCompare(b.id || '');
    };

    // 1) If anchor provided, place it first at its position and remove from list
    if (anchor && anchor.id) {
      const ax = Number(anchor.x) || 0;
      const ay = Number(anchor.y) || 0;
      const aw = w(anchor);
      const ah = h(anchor);
      if (ax >= 0 && ay >= 0 && ax + aw <= columns) {
        markArea(occupancy, ay, ax, aw, ah, columns);
        const inState = this.stateManager.findItem(anchor.id);
        if (inState && (inState.x !== ax || inState.y !== ay)) {
          positionUpdates.push({ id: anchor.id, x: ax, y: ay });
        }
        items = items.filter((it) => it.id !== anchor.id);
      }
    }

    // 2) Sort remaining by stable order (y, x, id)
    items.sort(stableOrder);

    // 3) Place each in first area that fits (scan y from 0, then x from 0 to columns - w)
    const maxRows = 10000;
    for (const item of items) {
      const iw = w(item);
      const ih = h(item);
      let placed = false;
      for (let row = 0; row < maxRows && !placed; row++) {
        for (let col = 0; col <= columns - iw; col++) {
          if (isAreaAvailable(occupancy, row, col, iw, ih, columns)) {
            const curX = Number(item.x) || 0;
            const curY = Number(item.y) || 0;
            if (col !== curX || row !== curY) {
              positionUpdates.push({ id: item.id, x: col, y: row });
            }
            markArea(occupancy, row, col, iw, ih, columns);
            placed = true;
            break;
          }
        }
      }
    }

    if (positionUpdates.length) {
      this.stateManager.applyPositionUpdates(positionUpdates);
    }
  }

  // Legacy API: delegates to deterministic reflow with this item as anchor.
  resolveCollisions(dominantItem) {
    const fromState = this.stateManager?.findItem(dominantItem?.id);
    if (fromState) this.reflowGrid(fromState);
  }

  // One-time deterministic reflow after load. No overlaps, no gaps.
  normalizeLayout() {
    this.reflowGrid();
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

function getMediaSrc(mediaElement) {
  if (!mediaElement) return '';
  if (mediaElement.tagName === 'VIDEO') {
    const source = mediaElement.querySelector('source');
    return source ? (source.getAttribute('data-src') || source.getAttribute('src') || '') : (mediaElement.getAttribute('src') || '');
  }
  return mediaElement.getAttribute('data-src') || mediaElement.getAttribute('src') || '';
}

function getPostDataId(postElement) {
  const dataId = postElement.getAttribute('data-id');
  if (dataId) return dataId;
  const media = postElement.querySelector('img, video');
  if (media) return getMediaSrc(media);
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
  const forceSingleUnit = Boolean(options.forceSingleUnit);

  posts.forEach((postElement) => {
    const widthUnits = forceSingleUnit
      ? 1
      : clamp(Number(postElement.getAttribute('data-w-units')) || 1, 1, columns);
    const heightUnits = forceSingleUnit
      ? 1
      : Math.max(1, Number(postElement.getAttribute('data-h-units')) || 1);
    let row = 0;
    let col = 0;
    let placed = false;

    while (!placed) {
      if (isAreaAvailable(occupancy, row, col, widthUnits, heightUnits, columns)) {
        markArea(occupancy, row, col, widthUnits, heightUnits, columns);
        placed = true;
        const media = postElement.querySelector('img, video');
        const src = media ? getMediaSrc(media) : '';
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
