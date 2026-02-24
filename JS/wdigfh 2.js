'use strict';

(function moodboardApp() {
  const SELECTORS = {
    grid: '#moodboard-grid',
    editControlsFooter: '.edit-controls-footer',
    editLinkFooter: '.edit-link-footer',
    headerDescription: '.moodboard-header p',
    moodboardPost: '.moodboard-post',
    placeholderBody: '.placeholder-body',
    textBody: '.text-only-content',
    caption: '.caption',
    addTextButton: '#add-text-box',
    exportButton: '#export-moodboard'
  };

  const STORAGE_KEYS = {
    itemsV2: 'moodboard-items-ordered-v2',
    headerDescription: 'moodboard-header-p'
  };

  const CONFIG = {
    manifestUrl: 'assets/pictures-of/gallery.json',
    gridStartY: 10,
    resizeDebounceMs: 100,
    breakpoints: {
      mobile: 576,
      tablet: 992
    },
    gridColumns: {
      mobile: 2,
      tablet: 5,
      desktop: 10
    },
    unitAspectRatio: 4 / 3
  };

  const state = {
    editMode: false,
    interactInitialized: false,
    moodboardGalleryReady: Promise.resolve()
  };

  const dom = {
    grid: document.querySelector(SELECTORS.grid),
    editControlsFooter: document.querySelector(SELECTORS.editControlsFooter),
    editLinkFooter: document.querySelector(SELECTORS.editLinkFooter)
  };

  function parseJson(raw, fallback) {
    if (!raw) return fallback;
    try {
      const parsed = JSON.parse(raw);
      return parsed == null ? fallback : parsed;
    } catch (_) {
      return fallback;
    }
  }

  function getStoredItems() {
    const parsed = parseJson(localStorage.getItem(STORAGE_KEYS.itemsV2), []);
    return Array.isArray(parsed) ? parsed : [];
  }

  function saveStoredItems(items) {
    localStorage.setItem(STORAGE_KEYS.itemsV2, JSON.stringify(items));
  }

  function getStoredHeaderText() {
    return localStorage.getItem(STORAGE_KEYS.headerDescription) || '';
  }

  function saveStoredHeaderText(value) {
    localStorage.setItem(STORAGE_KEYS.headerDescription, value);
  }

  function getGridColumns(viewportWidth) {
    if (viewportWidth <= CONFIG.breakpoints.mobile) return CONFIG.gridColumns.mobile;
    if (viewportWidth <= CONFIG.breakpoints.tablet) return CONFIG.gridColumns.tablet;
    return CONFIG.gridColumns.desktop;
  }

  function getGridMetrics(gridElement) {
    const columns = getGridColumns(window.innerWidth);
    const unitWidth = gridElement.clientWidth / columns;
    const unitHeight = unitWidth * CONFIG.unitAspectRatio;

    return {
      columns,
      unitWidth,
      unitHeight,
      startY: CONFIG.gridStartY
    };
  }

  function getPostDataId(postElement) {
    const media = postElement.querySelector('img, video');
    const fallbackText = (postElement.textContent || '').trim().substring(0, 30);

    return postElement.getAttribute('data-id') ||
      (media && (media.getAttribute('data-src') || media.getAttribute('src'))) ||
      fallbackText;
  }

  function getPostType(postElement) {
    if (postElement.classList.contains('text-placeholder')) return 'placeholder';
    if (postElement.classList.contains('text-only')) return 'text';
    return 'media';
  }

  function getPostContent(postElement) {
    const textBody = postElement.querySelector(SELECTORS.textBody);
    if (textBody) return textBody.textContent;

    const placeholderBody = postElement.querySelector(SELECTORS.placeholderBody);
    if (placeholderBody) return placeholderBody.textContent;

    const caption = postElement.querySelector(SELECTORS.caption);
    return caption ? caption.textContent : null;
  }

  function updateGridHeight() {
    if (!dom.grid) return;

    let maxBottom = 0;
    dom.grid.querySelectorAll(SELECTORS.moodboardPost).forEach((postElement) => {
      const y = Number(postElement.getAttribute('data-y')) || 0;
      const height = postElement.offsetHeight || 0;
      maxBottom = Math.max(maxBottom, y + height);
    });

    dom.grid.style.minHeight = `${maxBottom + 20}px`;
  }

  function applyLayout() {
    if (!dom.grid) return;

    dom.grid.classList.add('edit-freeform');

    const posts = Array.from(dom.grid.querySelectorAll(SELECTORS.moodboardPost));
    const { columns, unitWidth, unitHeight, startY } = getGridMetrics(dom.grid);

    const occupancyGrid = [];

    function isAreaClear(row, col, widthUnits, heightUnits) {
      for (let r = row; r < row + heightUnits; r += 1) {
        for (let c = col; c < col + widthUnits; c += 1) {
          if (c >= columns) return false;
          if (occupancyGrid[r] && occupancyGrid[r][c]) return false;
        }
      }
      return true;
    }

    function markArea(row, col, widthUnits, heightUnits) {
      for (let r = row; r < row + heightUnits; r += 1) {
        if (!occupancyGrid[r]) occupancyGrid[r] = new Array(columns).fill(false);
        for (let c = col; c < col + widthUnits; c += 1) {
          occupancyGrid[r][c] = true;
        }
      }
    }

    posts.forEach((postElement) => {
      const widthUnits = Math.min(columns, Number(postElement.getAttribute('data-w-units')) || 1);
      const heightUnits = Number(postElement.getAttribute('data-h-units')) || 1;

      let row = 0;
      let col = 0;
      let positioned = false;

      while (!positioned) {
        if (isAreaClear(row, col, widthUnits, heightUnits)) {
          const x = col * unitWidth;
          const y = startY + (row * unitHeight);

          if (!postElement.classList.contains('dragging')) {
            postElement.style.transform = `translate(${x}px, ${y}px)`;
            postElement.setAttribute('data-x', String(x));
            postElement.setAttribute('data-y', String(y));
          }

          postElement.style.width = `${widthUnits * (100 / columns)}%`;
          postElement.style.height = `${heightUnits * unitHeight}px`;

          markArea(row, col, widthUnits, heightUnits);
          positioned = true;
        } else {
          col += 1;
          if (col >= columns) {
            col = 0;
            row += 1;
          }
        }
      }
    });

    updateGridHeight();
  }

  function saveLayout() {
    if (!dom.grid) return;

    const items = Array.from(dom.grid.querySelectorAll(SELECTORS.moodboardPost)).map((postElement) => ({
      id: getPostDataId(postElement),
      type: getPostType(postElement),
      content: getPostContent(postElement),
      wUnits: Number(postElement.getAttribute('data-w-units')) || 1,
      hUnits: Number(postElement.getAttribute('data-h-units')) || 1
    }));

    saveStoredItems(items);

    const headerDescription = document.querySelector(SELECTORS.headerDescription);
    if (headerDescription) {
      saveStoredHeaderText(headerDescription.textContent || '');
    }
  }

  function updateEditableTextBlocks(isEditable) {
    if (!dom.grid) return;

    dom.grid.querySelectorAll(SELECTORS.placeholderBody).forEach((element) => {
      element.contentEditable = isEditable;
      if (!isEditable && !element.textContent.trim()) {
        element.textContent = element.dataset.defaultText || 'Available soon';
      }
    });

    dom.grid.querySelectorAll(`${SELECTORS.textBody}, ${SELECTORS.caption}`).forEach((element) => {
      element.contentEditable = isEditable;
    });
  }

  function createTextBox(initialText = 'Type something...', customId = null) {
    const postElement = document.createElement('div');
    postElement.className = 'moodboard-post text-only user-text';

    const textId = customId || `text-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    postElement.setAttribute('data-id', textId);

    const body = document.createElement('div');
    body.className = 'text-only-content';
    body.textContent = initialText;
    body.contentEditable = state.editMode;

    postElement.appendChild(body);
    return postElement;
  }

  function addTextBox() {
    if (!dom.grid) return;

    const newBox = createTextBox();
    dom.grid.appendChild(newBox);

    const editable = newBox.querySelector(SELECTORS.textBody);
    if (editable) editable.focus();
  }

  function setEditMode(active) {
    state.editMode = Boolean(active);
    if (!dom.grid) return;

    dom.grid.classList.add('edit-freeform');
    dom.grid.classList.toggle('edit-mode', state.editMode);

    if (dom.editControlsFooter) {
      dom.editControlsFooter.style.display = state.editMode ? 'inline-block' : 'none';
    }
    if (dom.editLinkFooter) {
      dom.editLinkFooter.style.display = state.editMode ? 'none' : 'inline-block';
    }

    updateEditableTextBlocks(state.editMode);

    const headerDescription = document.querySelector(SELECTORS.headerDescription);
    if (headerDescription) {
      headerDescription.contentEditable = state.editMode;
      if (!headerDescription.dataset.autosaveBound) {
        headerDescription.addEventListener('input', saveLayout);
        headerDescription.dataset.autosaveBound = 'true';
      }

      const savedHeader = getStoredHeaderText();
      if (savedHeader) headerDescription.textContent = savedHeader;
    }

    if (state.editMode) {
      initInteract();
    } else if (typeof interact !== 'undefined') {
      interact(SELECTORS.moodboardPost).unset();
      state.interactInitialized = false;
    }
  }

  function initInteract() {
    if (!dom.grid || typeof interact === 'undefined') return;
    if (state.interactInitialized) return;

    state.interactInitialized = true;

    interact(SELECTORS.moodboardPost)
      .draggable({
        ignoreFrom: '.caption, .text-only-content, .placeholder-body',
        inertia: true,
        modifiers: [
          interact.modifiers.restrictRect({
            restriction: 'parent',
            endOnly: false
          })
        ],
        autoScroll: true,
        listeners: {
          start(event) {
            event.target.classList.add('dragging');
            event.target.style.zIndex = '1000';
          },
          move(event) {
            if (!dom.grid) return;

            const target = event.target;
            const x = (Number(target.getAttribute('data-x')) || 0) + event.dx;
            const y = (Number(target.getAttribute('data-y')) || 0) + event.dy;

            target.style.transform = `translate(${x}px, ${y}px)`;
            target.setAttribute('data-x', String(x));
            target.setAttribute('data-y', String(y));

            const { columns, unitWidth, unitHeight, startY } = getGridMetrics(dom.grid);
            const centerX = x + (unitWidth / 2);
            const centerY = y + (unitHeight / 2);
            const col = Math.floor(centerX / unitWidth);
            const row = Math.floor((centerY - startY) / unitHeight);

            const children = Array.from(dom.grid.querySelectorAll(SELECTORS.moodboardPost));
            let nextIndex = col + (row * columns);
            nextIndex = Math.max(0, Math.min(children.length - 1, nextIndex));

            const currentIndex = children.indexOf(target);
            if (nextIndex === currentIndex || col < 0 || col >= columns) return;

            if (nextIndex > currentIndex) {
              dom.grid.insertBefore(target, children[nextIndex].nextSibling);
            } else {
              dom.grid.insertBefore(target, children[nextIndex]);
            }
            applyLayout();
          },
          end(event) {
            const target = event.target;
            target.classList.remove('dragging');
            target.style.zIndex = '';
            applyLayout();
            saveLayout();
          }
        }
      })
      .resizable({
        ignoreFrom: '.caption, .text-only-content, .placeholder-body',
        edges: { right: true, bottom: true },
        margin: 15,
        listeners: {
          start(event) {
            event.target.classList.add('resizing');
          },
          move(event) {
            if (!dom.grid) return;

            const { unitWidth, unitHeight } = getGridMetrics(dom.grid);
            const target = event.target;

            const widthUnits = Math.max(1, Math.round(event.rect.width / unitWidth));
            const heightUnits = Math.max(1, Math.round(event.rect.height / unitHeight));

            target.setAttribute('data-w-units', String(widthUnits));
            target.setAttribute('data-h-units', String(heightUnits));

            applyLayout();
          },
          end(event) {
            event.target.classList.remove('resizing');
            saveLayout();
          }
        }
      });
  }

  function createMediaPost(item) {
    const post = document.createElement('div');
    post.className = 'moodboard-post photo-only auto-generated lazy';

    const path = typeof item.path === 'string' ? item.path.trim() : '';
    if (!path) return null;

    post.setAttribute('data-id', path);

    const isVideo = item.type === 'video';
    const media = document.createElement(isVideo ? 'video' : 'img');
    media.dataset.src = path;
    media.classList.add('lazy');

    if (isVideo) {
      media.autoplay = true;
      media.muted = true;
      media.loop = true;
      media.playsInline = true;
      media.setAttribute('playsinline', '');
    }

    post.appendChild(media);

    if (item.caption) {
      const caption = document.createElement('div');
      caption.className = 'caption';
      caption.textContent = item.caption;
      post.appendChild(caption);
    }

    return post;
  }

  function findMatchingPost(item, posts, matchedNodes) {
    return posts.find((post) => {
      if (matchedNodes.has(post)) return false;

      const media = post.querySelector('img, video');
      const isPlaceholder = post.classList.contains('text-placeholder');
      const isText = post.classList.contains('text-only');
      const postId = post.getAttribute('data-id') || '';
      const postTextKey = (post.textContent || '').trim().substring(0, 30);

      if (item.type === 'placeholder' && isPlaceholder) {
        return postId === item.id || postTextKey === item.id;
      }
      if (item.type === 'text' && isText) {
        return postId === item.id || postTextKey === item.id;
      }
      if (item.type === 'media' && media) {
        if (postId === item.id) return true;
        const mediaSrc = media.getAttribute('data-src') || media.getAttribute('src') || '';
        return mediaSrc === item.id || mediaSrc.includes(item.id) || item.id.includes(mediaSrc);
      }

      return false;
    });
  }

  function applySavedOrder() {
    if (!dom.grid) return;

    const orderedItems = getStoredItems();
    if (!orderedItems.length) return;

    const currentPosts = Array.from(dom.grid.querySelectorAll(SELECTORS.moodboardPost));
    const fragment = document.createDocumentFragment();
    const matchedNodes = new Set();

    orderedItems.forEach((item) => {
      let post = findMatchingPost(item, currentPosts, matchedNodes);

      if (!post && item.type === 'text') {
        post = createTextBox(item.content || '', item.id);
      }

      if (!post) return;

      if (item.wUnits) post.setAttribute('data-w-units', String(item.wUnits));
      if (item.hUnits) post.setAttribute('data-h-units', String(item.hUnits));

      if (item.content !== null) {
        const target = post.querySelector(`${SELECTORS.textBody}, ${SELECTORS.placeholderBody}, ${SELECTORS.caption}`);
        if (target) target.textContent = item.content;
      }

      fragment.appendChild(post);
      matchedNodes.add(post);
    });

    currentPosts.forEach((post) => {
      if (!matchedNodes.has(post)) fragment.appendChild(post);
    });

    dom.grid.innerHTML = '';
    dom.grid.appendChild(fragment);
  }

  async function loadMoodboardGallery() {
    if (!dom.grid) return;

    try {
      const response = await fetch(CONFIG.manifestUrl, { cache: 'no-store' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const payload = await response.json();
      const items = Array.isArray(payload && payload.items) ? payload.items : [];
      const anchor = dom.grid.querySelector('.moodboard-post.text-only, .moodboard-post.wide-text');

      dom.grid.querySelectorAll('.moodboard-post.auto-generated').forEach((node) => node.remove());

      items.forEach((item) => {
        const post = createMediaPost(item);
        if (!post) return;

        if (anchor) dom.grid.insertBefore(post, anchor);
        else dom.grid.appendChild(post);
      });

      if (typeof window.activateLazyLoad === 'function') {
        window.activateLazyLoad(dom.grid);
      }

      applySavedOrder();
      applyLayout();
    } catch (error) {
      console.warn('Failed to load moodboard gallery manifest', error);
      if (window.location.protocol === 'file:' && dom.grid) {
        const errorMsg = document.createElement('div');
        errorMsg.style.cssText = 'grid-column: 1/-1; padding: 40px; text-align: center; color: var(--accent); background: rgba(0,0,0,0.05); border-radius: 8px; margin: 20px;';
        errorMsg.innerHTML = '<h3>Local Testing Note</h3><p>To view the gallery images, this page needs to be served via a local web server (CORS requirement).</p><p style="font-size: 0.9em; opacity: 0.8;">Run <strong>python -m http.server</strong> in your project folder and visit <strong>localhost:8000/wdigfh.html</strong></p>';
        dom.grid.appendChild(errorMsg);
      }
    }
  }

  function hydrateMoodboardPosts() {
    document.querySelectorAll('.moodboard-post img').forEach((img) => {
      const src = img.dataset.src || img.src;
      if (!src) return;

      img.src = src;
      img.onload = () => {
        img.classList.add('loaded');
        if (img.parentElement) img.parentElement.classList.add('loaded');
      };
    });

    document.querySelectorAll('.moodboard-post video').forEach((video) => {
      const src = video.dataset.src || video.src;
      if (!src) return;

      video.src = src;
      video.load();
      if (video.parentElement) video.parentElement.classList.add('loaded');
    });

    document.querySelectorAll('.moodboard-post').forEach((post) => {
      if (post.classList.contains('text-placeholder')) return;
      post.classList.add('lazy');
    });
  }

  function buildExportHtmlSnippet() {
    if (!dom.grid) return '';

    return Array.from(dom.grid.querySelectorAll(SELECTORS.moodboardPost)).map((post) => {
      const media = post.querySelector('img, video');
      const x = Math.round(Number(post.getAttribute('data-x')) || 0);
      const y = Math.round(Number(post.getAttribute('data-y')) || 0);
      const width = post.style.width || 'auto';
      const height = post.style.height || 'auto';
      const widthUnits = post.getAttribute('data-w-units') || '1';
      const heightUnits = post.getAttribute('data-h-units') || '1';
      const id = post.getAttribute('data-id') || '';

      if (media) {
        const tag = media.tagName.toLowerCase();
        const src = media.dataset.src || media.src;
        const captionEl = post.querySelector(SELECTORS.caption);
        const captionHtml = captionEl ? `\n  <div class="caption">${captionEl.textContent}</div>` : '';

        return `<div class="moodboard-post photo-only" style="width: ${width}; height: ${height};" data-x="${x}" data-y="${y}" data-w-units="${widthUnits}" data-h-units="${heightUnits}" data-id="${id}">\n  <${tag} src="${src}" class="loaded">${captionHtml}\n</div>`;
      }

      if (post.classList.contains('text-only')) {
        const text = (post.querySelector(SELECTORS.textBody) || {}).textContent || '';
        return `<div class="moodboard-post text-only" style="width: ${width}; height: ${height};" data-x="${x}" data-y="${y}" data-w-units="${widthUnits}" data-h-units="${heightUnits}" data-id="${id}">\n  <div class="text-only-content">${text}</div>\n</div>`;
      }

      if (post.classList.contains('text-placeholder')) {
        const text = (post.querySelector(SELECTORS.placeholderBody) || {}).textContent || '';
        return `<div class="moodboard-post text-placeholder" style="width: ${width}; height: ${height};" data-x="${x}" data-y="${y}" data-w-units="${widthUnits}" data-h-units="${heightUnits}" data-id="${id}">\n  <span class="placeholder-body">${text}</span>\n</div>`;
      }

      return '';
    }).filter(Boolean).join('\n');
  }

  function showExportModal(text) {
    const modal = document.createElement('div');
    Object.assign(modal.style, {
      position: 'fixed',
      top: '0',
      left: '0',
      width: '100%',
      height: '100%',
      background: 'rgba(0,0,0,0.8)',
      zIndex: 100001,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    });

    const textarea = document.createElement('textarea');
    textarea.value = text;
    Object.assign(textarea.style, {
      width: '80%',
      height: '80%',
      fontFamily: 'monospace',
      fontSize: '12px',
      padding: '10px'
    });

    const closeButton = document.createElement('button');
    closeButton.textContent = 'CLOSE';
    Object.assign(closeButton.style, {
      position: 'absolute',
      top: '20px',
      right: '20px',
      padding: '10px',
      background: 'white',
      border: 'none',
      cursor: 'pointer'
    });
    closeButton.onclick = () => modal.remove();

    modal.appendChild(textarea);
    modal.appendChild(closeButton);
    document.body.appendChild(modal);
  }

  function debounce(fn, delayMs) {
    let timeoutId = null;
    return function debounced(...args) {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => fn(...args), delayMs);
    };
  }

  function bindStaticEvents() {
    const addTextButton = document.querySelector(SELECTORS.addTextButton);
    if (addTextButton) addTextButton.addEventListener('click', addTextBox);

    const exportButton = document.querySelector(SELECTORS.exportButton);
    if (exportButton) {
      exportButton.addEventListener('click', () => {
        showExportModal(buildExportHtmlSnippet());
      });
    }

    if (dom.grid) {
      dom.grid.addEventListener('input', (event) => {
        const target = event.target;
        if (!target) return;

        if (target.classList.contains('text-only-content') ||
          target.classList.contains('placeholder-body') ||
          target.classList.contains('caption')) {
          saveLayout();
        }
      });
    }

    window.addEventListener('resize', debounce(() => {
      applyLayout();
    }, CONFIG.resizeDebounceMs));
  }

  function init() {
    state.moodboardGalleryReady = loadMoodboardGallery().catch((error) => {
      console.warn('Moodboard gallery initialization failed', error);
    });

    state.moodboardGalleryReady.finally(() => {
      hydrateMoodboardPosts();
      const params = new URLSearchParams(window.location.search);
      const isEditing = params.has('edit');
      setEditMode(isEditing);
    });

    bindStaticEvents();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
