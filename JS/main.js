/* ==========================================================================
   Global Public Helpers
   ========================================================================== */
window.toggleDescription = function toggleDescription(button) {
  if (!button) return;
  const detailColumn = button.closest('.detail-col');
  if (!detailColumn) return;

  const detailText = detailColumn.querySelector('.detail-text');
  if (!detailText) return;

  const isExpanded = !detailText.classList.contains('expanded');
  const ua = navigator.userAgent || '';
  const isSafariBrowser = /Safari/i.test(ua) && !/Chrome|CriOS|FxiOS|EdgiOS|OPiOS|Chromium|Edg|OPR/i.test(ua);
  const needsSafariTouchFallback = isSafariBrowser;
  if (detailText._expandTimer) {
    clearTimeout(detailText._expandTimer);
    detailText._expandTimer = null;
  }
  if (isExpanded) {
    detailText.classList.add('expanded');
    if (needsSafariTouchFallback) {
      // Safari-on-Apple-touch fallback: avoid max-height animation quirks and force full visibility.
      // Disable multicolumn layout in Safari fallback; `column-count: 1` still triggers
      // WebKit column fragmentation in this flow and can collapse height to ~1px.
      detailText.style.webkitColumnCount = 'auto';
      detailText.style.columnCount = 'auto';
      detailText.style.webkitColumnWidth = 'auto';
      detailText.style.columnWidth = 'auto';
      detailText.style.webkitColumnGap = 'normal';
      detailText.style.columnGap = 'normal';
      detailText.style.transition = 'none';
      detailText.style.maxHeight = 'none';
      detailText.style.overflow = 'visible';
      requestAnimationFrame(() => { detailText.style.transition = ''; });
    } else {
      detailText.style.overflow = 'hidden';
      detailText.style.maxHeight = '0px';
      requestAnimationFrame(() => {
        detailText.style.maxHeight = `${detailText.scrollHeight}px`;
      });
      detailText._expandTimer = setTimeout(() => {
        if (detailText.classList.contains('expanded')) {
          detailText.style.maxHeight = 'none';
          detailText.style.overflow = 'visible';
        }
        detailText._expandTimer = null;
      }, 360);
    }
  } else {
    if (needsSafariTouchFallback) {
      detailText.classList.remove('expanded');
      detailText.style.maxHeight = '0px';
      detailText.style.overflow = 'hidden';
    } else {
      detailText.style.maxHeight = `${detailText.scrollHeight}px`;
      requestAnimationFrame(() => {
        detailText.classList.remove('expanded');
        detailText.style.maxHeight = '0px';
      });
      detailText.style.overflow = 'hidden';
    }
  }
  button.setAttribute('aria-expanded', String(isExpanded));
  button.textContent = isExpanded ? 'Show Less -' : 'Show More +';
};

/* ==========================================================================
   Main App
   ========================================================================== */
document.addEventListener('DOMContentLoaded', () => {
  const CONFIG = {
    mobileBreakpoint: 850,
    popoutOffset: -10,
    lazyRootMargin: '400px',
    homepageHydrationRootMargin: '900px 0px',
    homepageMarkerY: 140,
    detailExpandedMarginTopPx: 5,
    motion: {
      revealDelayMs: 10,
      lightboxSwitchMs: 150,
      mobileCloseMs: 300,
      contactToggleDelayMs: 10,
      copiedResetMs: 1400
    }
  };

  const storage = {
    readJson(key, fallback) {
      try {
        const raw = localStorage.getItem(key);
        if (!raw) return fallback;
        const parsed = JSON.parse(raw);
        return parsed == null ? fallback : parsed;
      } catch (_) {
        return fallback;
      }
    },

    writeJson(key, value) {
      try {
        localStorage.setItem(key, JSON.stringify(value));
      } catch (_) {
        // Ignore storage failures.
      }
    },

    remove(key) {
      try {
        localStorage.removeItem(key);
      } catch (_) {
        // Ignore storage failures.
      }
    }
  };

  const math = {
    clamp(value, min, max) {
      return Math.min(max, Math.max(min, value));
    },

    mod(index, length) {
      if (length <= 0) return 0;
      return ((index % length) + length) % length;
    }
  };

  const mediaUtils = {
    getMediaKey(element) {
      if (!element) return '';
      return element.getAttribute('data-src') || element.getAttribute('src') || '';
    },

    sanitizeWidthPercent(value, fallback = 100) {
      const numericValue = Number(value);
      if (!Number.isFinite(numericValue)) return fallback;
      return math.clamp(numericValue, 35, 100);
    },

    normalizeMediaWidth(element) {
      const widthPercent = mediaUtils.sanitizeWidthPercent(element.dataset.width || 100);
      element.dataset.width = String(widthPercent);
      element.style.width = `${widthPercent}%`;
    },

    getMediaList(container) {
      return Array.from(container.querySelectorAll('img, video'));
    }
  };

  const motion = {
    onNextFrame(callback) {
      requestAnimationFrame(callback);
    },

    afterDelay(ms, callback) {
      return window.setTimeout(callback, ms);
    },

    revealWithClass(element, className, delayMs) {
      motion.afterDelay(delayMs, () => element.classList.add(className));
    }
  };

  const env = {
    isMobileViewport() {
      return window.innerWidth <= CONFIG.mobileBreakpoint;
    },

    isDesktopViewport() {
      return !env.isMobileViewport();
    }
  };

  const dom = {
    query(selector, root = document) {
      return root.querySelector(selector);
    },

    queryAll(selector, root = document) {
      return Array.from(root.querySelectorAll(selector));
    },

    clear(element) {
      if (element) element.innerHTML = '';
    }
  };

  function bindToggleButtons(container = document) {
    dom.queryAll('.toggle-btn', container).forEach((button) => {
      if (!(button instanceof HTMLButtonElement)) return;
      if (button.dataset.toggleBound === 'true') return;
      button.dataset.toggleBound = 'true';
      button.type = 'button';
      // Avoid duplicate toggles from inline handlers in cloned template content.
      button.removeAttribute('onclick');
      const handleToggle = (event) => {
        event.preventDefault();
        event.stopPropagation();
        window.toggleDescription(button);
      };
      button.addEventListener('click', handleToggle);
      button.addEventListener('touchend', handleToggle, { passive: false });
      button.addEventListener('pointerup', handleToggle);
    });
  }

  const appState = {
    reorderEnabled: (() => {
      const params = new URLSearchParams(window.location.search);
      const localHost = window.location.hostname === 'localhost' ||
        window.location.hostname === '127.0.0.1' ||
        window.location.protocol === 'file:';
      return localHost && params.get('edit') === '1';
    })(),
    homepageObserver: null,
    homepageTicking: false,
    lightboxImages: [],
    lightboxIndex: 0
  };

  function resetDescriptionToggles(container) {
    if (!container) return;
    dom.queryAll('.detail-col', container).forEach((detailCol) => {
      const detailText = dom.query('.detail-text', detailCol);
      const toggleButton = dom.query('.toggle-btn', detailCol);
      if (!detailText || !toggleButton) return;
      detailText.classList.remove('expanded');
      detailText.style.maxHeight = '0px';
      detailText.style.overflow = 'hidden';
      toggleButton.setAttribute('aria-expanded', 'false');
      toggleButton.textContent = 'Show More +';
    });
  }

  /* ----------------------------------------------------------------------
     Lazy Media Loader
     ---------------------------------------------------------------------- */

  const mediaObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;

      const mediaElement = entry.target;
      if (mediaElement.dataset.width) mediaUtils.normalizeMediaWidth(mediaElement);

      if (mediaElement.tagName === 'IMG') {
        mediaElement.onload = () => mediaElement.classList.add('loaded');
        mediaElement.onerror = () => mediaElement.classList.add('loaded');
        mediaElement.src = mediaElement.dataset.src;
        if (mediaElement.complete && mediaElement.naturalHeight !== 0) {
          mediaElement.classList.add('loaded');
        }
      }

      if (mediaElement.tagName === 'VIDEO') {
        mediaElement.src = mediaElement.dataset.src;
        mediaElement.load();
        mediaElement.classList.add('loaded');
      }

      observer.unobserve(mediaElement);
    });
  }, { root: null, rootMargin: CONFIG.lazyRootMargin, threshold: 0.1 });

  function activateLazyLoad(container) {
    if (!container) return;

    dom.queryAll('img[data-width], video[data-width]', container)
      .forEach(mediaUtils.normalizeMediaWidth);

    dom.queryAll('img[data-src], video[data-src]', container)
      .forEach(target => mediaObserver.observe(target));
  }

  window.activateLazyLoad = activateLazyLoad;

  /* ----------------------------------------------------------------------
     Freeform Photo Layout (Edit Mode)
     ---------------------------------------------------------------------- */

  function getSortKey(stack) {
    return stack.getAttribute('data-sort-key') || '';
  }

  function getSavedLayoutMap(stack) {
    const sortKey = getSortKey(stack);
    if (!sortKey) return {};
    const parsed = storage.readJson(`photo-layout:${sortKey}`, {});
    return parsed && typeof parsed === 'object' ? parsed : {};
  }

  function saveLayoutMap(stack) {
    const sortKey = getSortKey(stack);
    if (!sortKey) return;

    const payload = {};
    dom.queryAll('.photo-free-item', stack).forEach((wrapper) => {
      const mediaElement = dom.query('img, video', wrapper);
      const key = mediaUtils.getMediaKey(mediaElement);
      if (!key) return;

      payload[key] = {
        x: Number(wrapper.dataset.x || 0),
        y: Number(wrapper.dataset.y || 0),
        w: Number(mediaElement.dataset.width || 0),
        z: Number(wrapper.style.zIndex || 1),
        caption: wrapper.dataset.caption || ''
      };
    });

    storage.writeJson(`photo-layout:${sortKey}`, payload);
  }

  function clearSavedLayout(stack) {
    const sortKey = getSortKey(stack);
    if (!sortKey) return;
    storage.remove(`photo-layout:${sortKey}`);
  }

  function computeFreeItemLayout({ stackWidth, x, y, widthPercent }) {
    const safeWidth = math.clamp(Number.isFinite(widthPercent) ? widthPercent : 0, 0, 100);
    const pxWidth = (Math.max(1, stackWidth) * safeWidth) / 100;
    const maxX = Math.max(0, stackWidth - pxWidth);

    return {
      x: math.clamp(Number.isFinite(x) ? x : 0, 0, maxX),
      y: Math.max(0, Number.isFinite(y) ? y : 0),
      widthPercent: safeWidth
    };
  }

  function applyFreeItemLayout(stack, wrapper, mediaElement, x, y, widthPercent) {
    const nextLayout = computeFreeItemLayout({
      stackWidth: stack.clientWidth,
      x,
      y,
      widthPercent
    });

    wrapper.dataset.x = String(nextLayout.x);
    wrapper.dataset.y = String(nextLayout.y);

    mediaElement.dataset.width = String(nextLayout.widthPercent);
    mediaElement.style.width = '100%';
    mediaElement.style.transform = 'none';

    wrapper.style.left = `${nextLayout.x}px`;
    wrapper.style.top = `${nextLayout.y}px`;
    wrapper.style.width = `${nextLayout.widthPercent}%`;
  }

  function estimateItemHeight(stackWidth, widthPercent, mediaElement) {
    const safeWidth = math.clamp(widthPercent, 0, 100);
    const pixelWidth = (Math.max(1, stackWidth) * safeWidth) / 100;
    const aspectRatio = mediaElement.naturalWidth > 0
      ? (mediaElement.naturalHeight / mediaElement.naturalWidth)
      : 0.7;
    return Math.max(40, pixelWidth * aspectRatio);
  }

  function ensureFreeStackHeight(stack) {
    let maxBottom = 0;
    dom.queryAll('.photo-free-item', stack).forEach((wrapper) => {
      const y = Number(wrapper.dataset.y || 0);
      const height = wrapper.offsetHeight || 0;
      maxBottom = Math.max(maxBottom, y + height);
    });

    stack.style.minHeight = `${Math.ceil(maxBottom + 30)}px`;
  }

  function attachFreeItemInteractions(stack, wrapper, mediaElement) {
    const resizeHandle = dom.query('.photo-resize-handle', wrapper);
    if (!resizeHandle || wrapper.dataset.interactionBound === 'true') return;

    wrapper.dataset.interactionBound = 'true';

    const drag = {
      mode: '',
      startX: 0,
      startY: 0,
      baseX: 0,
      baseY: 0,
      baseW: 0
    };

    const onPointerMove = (event) => {
      if (!drag.mode) return;

      const dx = event.clientX - drag.startX;
      const dy = event.clientY - drag.startY;

      if (drag.mode === 'move') {
        applyFreeItemLayout(stack, wrapper, mediaElement, drag.baseX + dx, drag.baseY + dy, drag.baseW);
      } else if (drag.mode === 'resize') {
        const nextWidth = drag.baseW + (dx / Math.max(1, stack.clientWidth)) * 100;
        applyFreeItemLayout(stack, wrapper, mediaElement, drag.baseX, drag.baseY, nextWidth);
      }

      ensureFreeStackHeight(stack);
      event.preventDefault();
    };

    const onPointerEnd = () => {
      if (!drag.mode) return;

      drag.mode = '';
      wrapper.classList.remove('editing');
      saveLayoutMap(stack);
      ensureFreeStackHeight(stack);

      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerEnd);
      window.removeEventListener('pointercancel', onPointerEnd);
    };

    const beginInteraction = (mode, event) => {
      drag.mode = mode;
      drag.startX = event.clientX;
      drag.startY = event.clientY;
      drag.baseX = Number(wrapper.dataset.x || 0);
      drag.baseY = Number(wrapper.dataset.y || 0);
      drag.baseW = Number(mediaElement.dataset.width || 0);

      wrapper.classList.add('editing');
      wrapper.style.zIndex = String(1000 + (Date.now() % 100000));

      window.addEventListener('pointermove', onPointerMove, { passive: false });
      window.addEventListener('pointerup', onPointerEnd);
      window.addEventListener('pointercancel', onPointerEnd);

      event.preventDefault();
    };

    wrapper.addEventListener('pointerdown', (event) => {
      if (event.target === resizeHandle || event.button !== 0) return;
      beginInteraction('move', event);
    });

    resizeHandle.addEventListener('pointerdown', (event) => {
      if (event.button !== 0) return;
      beginInteraction('resize', event);
      event.stopPropagation();
    });
  }

  function createFreeItemWrapperIfNeeded(mediaElement) {
    let wrapper = mediaElement.closest('.photo-free-item') || mediaElement.closest('.moodboard-post');

    if (!wrapper) {
      wrapper = document.createElement('div');
      wrapper.className = 'photo-free-item';
      mediaElement.parentNode.insertBefore(wrapper, mediaElement);
      wrapper.appendChild(mediaElement);
    } else {
      wrapper.classList.add('photo-free-item');
    }

    if (!dom.query('.photo-resize-handle', wrapper)) {
      const handle = document.createElement('button');
      handle.type = 'button';
      handle.className = 'photo-resize-handle';
      handle.setAttribute('aria-label', 'Resize image');
      wrapper.appendChild(handle);
    }

    return wrapper;
  }

  function ensureMediaSrcForEditMode(stack) {
    dom.queryAll('img[data-src], video[data-src]', stack).forEach((mediaElement) => {
      if (!mediaElement.getAttribute('src')) {
        mediaElement.setAttribute('src', mediaElement.getAttribute('data-src') || '');
        mediaElement.classList.add('loaded');
      }
    });
  }

  function createEditControls(stack) {
    if (!stack.parentElement || dom.query('.photo-edit-controls', stack.parentElement)) return;

    const controls = document.createElement('div');
    controls.className = 'photo-edit-controls';

    const getGithubEditUrlForCurrentPage = () => {
      const path = (window.location.pathname || '/').replace(/^\//, '');
      const filePath = path || 'index.html';
      return `https://github.com/Sgdotcom/porfolio-website/edit/main/${filePath}`;
    };

    const buildExportText = () => {
      const htmlSnippet = dom.queryAll('.photo-free-item', stack)
        .map((wrapper) => {
          const mediaElement = dom.query('img, video', wrapper);
          const source = mediaUtils.getMediaKey(mediaElement);
          if (!mediaElement || !source) return '';

          const width = math.clamp(Number(mediaElement.dataset.width || 0), 0, 100);
          const x = Math.round(Number(wrapper.dataset.x || 0));
          const y = Math.round(Number(wrapper.dataset.y || 0));
          const tagName = mediaElement.tagName.toLowerCase();

          return `<${tagName} data-src="${source}" data-width="${width}" data-x="${x}" data-y="${y}">`;
        })
        .filter(Boolean)
        .join('\n');

      const sortKey = stack.getAttribute('data-sort-key') || '';
      const filePath = (window.location.pathname || '/').replace(/^\//, '') || 'index.html';

      return [
        `# Paste into ${filePath}`,
        sortKey ? `# Replace the <div class="photo-stack" data-sort-key="${sortKey}"> contents` : '# Replace the target photo-stack contents',
        htmlSnippet
      ].join('\n');
    };

    const exportButton = document.createElement('button');
    exportButton.type = 'button';
    exportButton.className = 'reorder-export-btn';
    exportButton.textContent = 'EXPORT FREEFORM HTML';

    exportButton.addEventListener('click', async () => {
      const exportText = buildExportText();

      try {
        await navigator.clipboard.writeText(exportText);
        exportButton.textContent = 'Copied';
        motion.afterDelay(CONFIG.motion.copiedResetMs, () => {
          exportButton.textContent = 'EXPORT FREEFORM HTML';
        });
      } catch (_) {
        window.prompt('Copy this HTML:', exportText);
      }
    });

    const publishButton = document.createElement('button');
    publishButton.type = 'button';
    publishButton.className = 'reorder-export-btn';
    publishButton.textContent = 'PUBLISH (GITHUB)';
    publishButton.addEventListener('click', async () => {
      const exportText = buildExportText();
      const githubUrl = getGithubEditUrlForCurrentPage();

      try {
        await navigator.clipboard.writeText(exportText);
      } catch (_) {
        // Ignore clipboard failures; user can still copy from prompt.
      }

      window.open(githubUrl, '_blank', 'noopener');
      window.prompt('Paste this into GitHub editor and commit:', exportText);
    });

    const resetButton = document.createElement('button');
    resetButton.type = 'button';
    resetButton.className = 'reorder-export-btn';
    resetButton.textContent = 'Reset Positions';
    resetButton.addEventListener('click', () => {
      clearSavedLayout(stack);
      location.reload();
    });

    controls.appendChild(exportButton);
    controls.appendChild(publishButton);
    controls.appendChild(resetButton);
    stack.parentElement.insertBefore(controls, stack);
  }

  function initFreeformStack(stack) {
    if (stack.dataset.reorderBound === 'true') return;

    stack.dataset.reorderBound = 'true';
    stack.dataset.editMode = 'freeform';
    stack.classList.add('edit-freeform');

    ensureMediaSrcForEditMode(stack);

    const savedLayout = getSavedLayoutMap(stack);
    const gap = 22;
    let yCursor = 0;

    mediaUtils.getMediaList(stack).forEach((mediaElement, index) => {
      const key = mediaUtils.getMediaKey(mediaElement);
      const saved = key ? savedLayout[key] : null;

      const wrapper = createFreeItemWrapperIfNeeded(mediaElement);

      const widthFromMedia = Number(mediaElement.dataset.width);
      const defaultWidthPattern = [38, 28, 33, 25, 40, 30][index % 6];
      const widthPercent = Number.isFinite(saved?.w)
        ? saved.w
        : (Number.isFinite(widthFromMedia) ? widthFromMedia : defaultWidthPattern);

      const x = Number.isFinite(saved?.x) ? saved.x : 0;
      const y = Number.isFinite(saved?.y) ? saved.y : yCursor;

      applyFreeItemLayout(stack, wrapper, mediaElement, x, y, widthPercent);
      wrapper.style.zIndex = String(Number.isFinite(saved?.z) ? saved.z : (index + 1));

      yCursor = Math.max(
        yCursor,
        y + estimateItemHeight(stack.clientWidth, widthPercent, mediaElement) + gap
      );

      attachFreeItemInteractions(stack, wrapper, mediaElement);
    });

    ensureFreeStackHeight(stack);
    saveLayoutMap(stack);

    const onResize = () => {
      dom.queryAll('.photo-free-item', stack).forEach((wrapper) => {
        const mediaElement = dom.query('img, video', wrapper);
        if (!mediaElement) return;

        applyFreeItemLayout(
          stack,
          wrapper,
          mediaElement,
          Number(wrapper.dataset.x || 0),
          Number(wrapper.dataset.y || 0),
          Number(mediaElement.dataset.width || 0)
        );
      });
      ensureFreeStackHeight(stack);
    };

    window.addEventListener('resize', onResize);
    createEditControls(stack);
  }

  function enablePhotoReorder(container, force = false) {
    if (!container) return;
    if (!force && !appState.reorderEnabled) return;

    dom.queryAll('.photo-stack[data-sort-key], .moodboard-grid[data-sort-key]', container)
      .forEach(initFreeformStack);
  }

  window.enablePhotoReorder = enablePhotoReorder;

  /* ----------------------------------------------------------------------
     Header + Top-Level UI
     ---------------------------------------------------------------------- */

  function initLastUpdated() {
    const lastUpdatedElement = dom.query('#last-updated');
    if (!lastUpdatedElement) return;

    const modifiedDate = new Date(document.lastModified);
    const formatted = modifiedDate.toLocaleDateString('en-GB', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });

    lastUpdatedElement.textContent = `LAST UPDATED: ${formatted}`;
  }

  function initDarkMode() {
    const toggleButton = dom.query('#dark-toggle');

    if (localStorage.getItem('theme') === 'dark') {
      document.body.classList.add('dark');
    }

    if (!toggleButton) return;

    toggleButton.addEventListener('click', () => {
      document.body.classList.toggle('dark');
      const theme = document.body.classList.contains('dark') ? 'dark' : 'light';
      localStorage.setItem('theme', theme);
    });
  }

  function initScrollToTop() {
    const scrollLink = dom.query('a[href="#top"]');
    if (!scrollLink) return;

    scrollLink.addEventListener('click', (event) => {
      event.preventDefault();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  function initContactMenu() {
    const contactWrapper = dom.query('.contact-wrapper');
    const contactOverlay = dom.query('#contact-overlay');
    const contactLink = dom.query('.contact-wrapper > a');
    if (!contactWrapper || !contactOverlay) return;

    const toggleContact = (event) => {
      if (contactOverlay.contains(event.target)) return;
      event.stopPropagation();
      event.preventDefault();
      const now = Date.now();
      const last = Number(contactWrapper.dataset.lastToggleAt || 0);
      if (now - last < 300) return;
      contactWrapper.dataset.lastToggleAt = String(now);
      motion.afterDelay(CONFIG.motion.contactToggleDelayMs, () => {
        contactWrapper.classList.toggle('active');
      });
    };
    if (contactLink) {
      contactLink.addEventListener('click', toggleContact);
      contactLink.addEventListener('touchend', toggleContact, { passive: false });
    } else {
      // Fallback if markup changes and anchor is missing.
      contactWrapper.addEventListener('click', toggleContact);
    }

    document.addEventListener('click', (event) => {
      if (contactWrapper.contains(event.target)) return;
      contactWrapper.classList.remove('active');
    });
  }

  function computeRepeatCount(containerWidth, phraseWidth) {
    if (containerWidth <= 0 || phraseWidth <= 0) return 1;
    return Math.max(1, Math.ceil(containerWidth / phraseWidth) + 1);
  }

  function fillFooterRepeatLine() {
    const repeatLine = dom.query('.wip-repeat');
    if (!repeatLine) return;

    const phrase = (repeatLine.dataset.phrase || 'where do i go from here?').trim();
    repeatLine.textContent = phrase;

    const phraseWidth = repeatLine.scrollWidth;
    const repeatCount = computeRepeatCount(repeatLine.clientWidth, phraseWidth);

    repeatLine.textContent = Array.from({ length: repeatCount }, () => phrase).join(' ');
  }

  function initHeaderUi() {
    initLastUpdated();
    initDarkMode();
    initScrollToTop();
    initContactMenu();
    fillFooterRepeatLine();
    window.addEventListener('resize', fillFooterRepeatLine);
  }

  function initHeroFallback() {
    const ua = navigator.userAgent || '';
    const isSafari = /Safari/i.test(ua) && !/Chrome|CriOS|Edg|OPR|FxiOS/i.test(ua);
    if (isSafari) {
      document.body.classList.add('hide-hero-safari');
      return;
    }

    const heroVideo = dom.query('.home-hero video');
    if (!heroVideo) return;
    heroVideo.addEventListener('loadeddata', () => {
      document.body.classList.remove('hero-video-fallback');
    });
    heroVideo.addEventListener('error', () => {
      document.body.classList.add('hero-video-fallback');
    });
  }

  /* ----------------------------------------------------------------------
     Project Navigation + Homepage Feed
     ---------------------------------------------------------------------- */

  const rightSide = dom.query('#right-side');
  const projectWrappers = dom.queryAll('.project-wrapper');

  function getProjectLinks() {
    return dom.queryAll('.project-wrapper a[data-template]');
  }

  function getTemplateClone(templateId) {
    const template = templateId ? dom.query(`#${templateId}`) : null;
    if (!template) return null;
    return template.content.cloneNode(true);
  }

  function createFallbackContent() {
    const fallback = document.createElement('div');
    fallback.innerHTML = '<div style="padding:40px;">Content coming soon...</div>';
    return fallback;
  }

  function stopHomepageFeedObserver() {
    if (!appState.homepageObserver) return;
    appState.homepageObserver.disconnect();
    appState.homepageObserver = null;
  }

  function setHomepageActiveLink(templateId) {
    dom.queryAll('.project-wrapper.homepage-active').forEach((wrapper) => {
      wrapper.classList.remove('homepage-active');
    });

    if (!templateId) return;

    const activeLink = dom.query(`.project-wrapper a[data-template="${templateId}"]`);
    const activeWrapper = activeLink ? activeLink.closest('.project-wrapper') : null;
    if (activeWrapper) activeWrapper.classList.add('homepage-active');
  }

  function getActiveTemplateIdByMarker(sections, markerY) {
    let activeSection = null;
    sections.forEach((section) => {
      const rect = section.getBoundingClientRect();
      if (rect.top <= markerY) activeSection = section;
    });
    return activeSection ? activeSection.getAttribute('data-template-id') : null;
  }

  function updateHomepageActiveFromScroll() {
    if (!rightSide) return;

    const isDesktopHome = env.isDesktopViewport() && !document.body.classList.contains('project-open');
    if (!isDesktopHome) {
      setHomepageActiveLink(null);
      return;
    }

    const sections = dom.queryAll('.home-project-section[data-template-id]', rightSide);
    if (!sections.length) {
      setHomepageActiveLink(null);
      return;
    }

    setHomepageActiveLink(getActiveTemplateIdByMarker(sections, CONFIG.homepageMarkerY));
  }

  function scheduleHomepageActiveUpdate() {
    if (appState.homepageTicking) return;

    appState.homepageTicking = true;
    motion.onNextFrame(() => {
      appState.homepageTicking = false;
      updateHomepageActiveFromScroll();
    });
  }

  function hydrateHomepageSection(section) {
    if (!section || section.dataset.hydrated === 'true') return;

    const templateId = section.getAttribute('data-template-id');
    const content = getTemplateClone(templateId);
    if (!content) return;

    section.innerHTML = '';
    section.classList.remove('home-project-shell');
    section.dataset.hydrated = 'true';
    section.appendChild(content);
    bindToggleButtons(section);
    resetDescriptionToggles(section);

    activateLazyLoad(section);
    enablePhotoReorder(section);
    enableTextEditing(section);
  }

  function startHomepageFeedObserver() {
    if (!rightSide) return;

    stopHomepageFeedObserver();
    const shells = dom.queryAll('.home-project-section', rightSide);
    if (!shells.length) return;

    appState.homepageObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        hydrateHomepageSection(entry.target);
        observer.unobserve(entry.target);
      });
    }, { root: null, rootMargin: CONFIG.homepageHydrationRootMargin, threshold: 0.01 });

    shells.forEach(shell => appState.homepageObserver.observe(shell));
  }

  function renderHomepageFeed() {
    if (!rightSide) return;

    const isDesktopHome = env.isDesktopViewport() && !document.body.classList.contains('project-open');
    if (!isDesktopHome) {
      stopHomepageFeedObserver();
      if (!document.body.classList.contains('project-open')) dom.clear(rightSide);
      setHomepageActiveLink(null);
      return;
    }

    stopHomepageFeedObserver();
    dom.clear(rightSide);

    const fragment = document.createDocumentFragment();

    getProjectLinks().forEach((link) => {
      const templateId = link.getAttribute('data-template');
      if (!templateId || templateId === 'content-about' || !dom.query(`#${templateId}`)) return;

      const label = (link.textContent || '').replace(/\s+/g, ' ').trim();
      const section = document.createElement('section');

      section.className = 'content-enter visible home-project-section home-project-shell';
      section.setAttribute('data-template-id', templateId);
      section.setAttribute('data-hydrated', 'false');
      section.innerHTML = `<p class="home-project-shell-label">${label}</p>`;

      fragment.appendChild(section);
    });

    rightSide.appendChild(fragment);
    startHomepageFeedObserver();
    scheduleHomepageActiveUpdate();
  }

  function resetProjectDetails(wrapper) {
    wrapper.classList.remove('active', 'homepage-active');

    const detailText = dom.query('.project-text', wrapper);
    if (detailText) {
      detailText.style.maxHeight = '';
      detailText.style.opacity = '';
      detailText.style.marginTop = '';
    }

    const popout = dom.query('.project-popout', wrapper);
    if (popout) popout.style.opacity = '0';

    const toggleButton = dom.query('.toggle-btn', wrapper);
    if (toggleButton) toggleButton.textContent = 'Show More +';

    const hiddenContent = dom.query('.info-collapsible', wrapper);
    if (hiddenContent) {
      hiddenContent.classList.remove('expanded');
      hiddenContent.style.display = '';
    }
  }

  function resetAllProjects(exceptWrapper = null) {
    projectWrappers.forEach((wrapper) => {
      if (wrapper === exceptWrapper) return;
      resetProjectDetails(wrapper);
    });
  }

  function alignPopoutToFirstProject() {
    const firstLink = dom.query('.project-wrapper:first-child a');
    if (!firstLink) return;

    const rect = firstLink.getBoundingClientRect();
    const top = rect.top + CONFIG.popoutOffset;
    document.documentElement.style.setProperty('--popout-top', `${top}px`);
  }

  function openDesktopProject(wrapper, link) {
    if (!rightSide) return;

    document.body.classList.add('project-open');
    setHomepageActiveLink(null);

    if (wrapper.classList.contains('active')) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    resetAllProjects(wrapper);
    wrapper.classList.add('active');

    const detailText = dom.query('.project-text', wrapper);
    if (detailText) {
      detailText.style.maxHeight = `${detailText.scrollHeight}px`;
      detailText.style.opacity = '1';
      detailText.style.marginTop = `${CONFIG.detailExpandedMarginTopPx}px`;
    }

    dom.clear(rightSide);

    const templateId = link.getAttribute('data-template');
    const contentWrapper = document.createElement('div');
    contentWrapper.className = 'content-enter';

    const content = getTemplateClone(templateId) || createFallbackContent();
    contentWrapper.appendChild(content);
    bindToggleButtons(contentWrapper);
    resetDescriptionToggles(contentWrapper);

    rightSide.appendChild(contentWrapper);

    activateLazyLoad(contentWrapper);
    enablePhotoReorder(contentWrapper);
    enableTextEditing(contentWrapper);

    window.scrollTo({ top: 0, behavior: 'smooth' });
    motion.revealWithClass(contentWrapper, 'visible', CONFIG.motion.revealDelayMs);
  }

  function ensureMobileBackButton(onBack) {
    const topBarRight = dom.query('.top-bar .right');
    if (!topBarRight) return null;

    const existing = dom.query('#mobile-back-btn');
    if (existing) existing.remove();

    const button = document.createElement('a');
    button.id = 'mobile-back-btn';
    button.href = '#';
    button.textContent = '← Back';
    button.addEventListener('click', onBack);

    topBarRight.insertBefore(button, topBarRight.firstChild);
    return button;
  }

  function createMobileProjectView(templateId) {
    const existingView = dom.query('.mobile-project-view');
    if (existingView) existingView.remove();

    const updatedLabel = dom.query('.top-bar .left .updated');
    if (updatedLabel) updatedLabel.style.display = 'none';

    const onBack = (event) => {
      event.preventDefault();

      const mobileView = dom.query('.mobile-project-view');
      if (mobileView) {
        mobileView.classList.remove('active');
        motion.afterDelay(CONFIG.motion.mobileCloseMs, () => mobileView.remove());
      }

      const backButton = dom.query('#mobile-back-btn');
      if (backButton) backButton.remove();

      if (updatedLabel) updatedLabel.style.display = '';
    };

    ensureMobileBackButton(onBack);

    const mobileView = document.createElement('div');
    mobileView.className = 'mobile-project-view';

    const content = document.createElement('div');
    content.className = 'mobile-project-content';

    const templateContent = getTemplateClone(templateId) || createFallbackContent();
    content.appendChild(templateContent);
    bindToggleButtons(content);
    resetDescriptionToggles(content);

    mobileView.appendChild(content);
    document.body.appendChild(mobileView);

    motion.onNextFrame(() => mobileView.classList.add('active'));

    activateLazyLoad(content);
    enablePhotoReorder(content);
    enableTextEditing(content);
  }

  function initProjectHoverPreview() {
    projectWrappers.forEach((wrapper) => {
      const popout = dom.query('.project-popout', wrapper);
      const mediaElement = dom.query('.project-popout img, .project-popout video', wrapper);
      const link = dom.query('a[data-template]', wrapper);
      const previewSource = link ? link.getAttribute('data-image') : null;

      if (!popout || !mediaElement || !previewSource) return;

      wrapper.addEventListener('mouseenter', () => {
        if (!env.isDesktopViewport() || wrapper.classList.contains('active')) return;

        mediaElement.src = previewSource;
        if (mediaElement.tagName === 'VIDEO') {
          mediaElement.play().catch(() => { /* Ignore autoplay errors. */ });
        }

        popout.style.opacity = '1';
      });

      wrapper.addEventListener('mouseleave', () => {
        popout.style.opacity = '0';
        if (mediaElement.tagName === 'VIDEO') mediaElement.pause();
      });
    });
  }

  function initProjectNavigationEvents() {
    if (!rightSide) return;

    rightSide.addEventListener('click', (event) => {
      const targetTitle = event.target.closest('.home-project-section .project-layout h2');
      if (!targetTitle) return;

      const section = targetTitle.closest('.home-project-section');
      const templateId = section ? section.getAttribute('data-template-id') : '';
      const projectLink = templateId
        ? dom.query(`.project-wrapper a[data-template="${templateId}"]`)
        : null;

      if (projectLink) projectLink.click();
    });

    document.addEventListener('click', (event) => {
      const projectLink = event.target.closest('.project-wrapper a[data-template]');
      if (!projectLink) return;

      event.preventDefault();
      const wrapper = projectLink.closest('.project-wrapper');
      if (!wrapper) return;

      const templateId = projectLink.getAttribute('data-template');
      if (!templateId) return;

      if (env.isMobileViewport()) {
        createMobileProjectView(templateId);
      } else {
        openDesktopProject(wrapper, projectLink);
      }
    });

    const nameElement = dom.query('.name');
    if (nameElement) {
      nameElement.addEventListener('click', () => {
        document.body.classList.remove('project-open');
        if (rightSide) dom.clear(rightSide);
        resetAllProjects();
        renderHomepageFeed();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    }
  }

  function initProjectSystem() {
    alignPopoutToFirstProject();
    renderHomepageFeed();
    initProjectHoverPreview();
    initProjectNavigationEvents();

    window.addEventListener('resize', alignPopoutToFirstProject);
    window.addEventListener('resize', renderHomepageFeed);
    window.addEventListener('resize', scheduleHomepageActiveUpdate);
    window.addEventListener('scroll', scheduleHomepageActiveUpdate, { passive: true });
  }

  /* ----------------------------------------------------------------------
     Lightbox
     ---------------------------------------------------------------------- */

  const lightboxElements = {
    container: dom.query('#lightbox'),
    image: dom.query('#lightbox-img'),
    prevButton: dom.query('.lightbox-prev'),
    nextButton: dom.query('.lightbox-next')
  };

  function collectLightboxImages(fromImage) {
    const container = fromImage.closest('.temp-grid') || fromImage.closest('.photo-stack');
    if (!container) return { images: [], activeIndex: 0 };

    const images = dom.queryAll('img', container)
      .map(img => img.src || img.dataset.src)
      .filter(Boolean);

    const source = fromImage.src || fromImage.dataset.src;
    const activeIndex = Math.max(0, images.indexOf(source));

    return { images, activeIndex };
  }

  function updateLightboxImage() {
    const { image } = lightboxElements;
    if (!image || appState.lightboxImages.length === 0) return;

    image.classList.add('lightbox-switching');

    motion.afterDelay(CONFIG.motion.lightboxSwitchMs, () => {
      image.src = appState.lightboxImages[appState.lightboxIndex];

      const nextIndex = math.mod(appState.lightboxIndex + 1, appState.lightboxImages.length);
      new Image().src = appState.lightboxImages[nextIndex];

      motion.onNextFrame(() => {
        image.classList.remove('lightbox-switching');
      });
    });
  }

  function openLightbox(imageElement) {
    const { container } = lightboxElements;
    if (!container) return;

    const lightboxData = collectLightboxImages(imageElement);
    if (!lightboxData.images.length) return;

    appState.lightboxImages = lightboxData.images;
    appState.lightboxIndex = lightboxData.activeIndex;

    updateLightboxImage();
    container.classList.add('active');
  }

  function closeLightbox() {
    const { container } = lightboxElements;
    if (container) container.classList.remove('active');
  }

  function showNextLightboxImage() {
    if (!appState.lightboxImages.length) return;
    appState.lightboxIndex = math.mod(appState.lightboxIndex + 1, appState.lightboxImages.length);
    updateLightboxImage();
  }

  function showPreviousLightboxImage() {
    if (!appState.lightboxImages.length) return;
    appState.lightboxIndex = math.mod(appState.lightboxIndex - 1, appState.lightboxImages.length);
    updateLightboxImage();
  }

  function handleCarouselClick(event) {
    const carousel = event.target.closest('.carousel');
    if (!carousel) return false;

    const rect = carousel.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const width = rect.width;

    if (x < width * 0.35) {
      carousel.scrollBy({ left: -width * 0.6, behavior: 'smooth' });
      return true;
    }

    if (x > width * 0.65) {
      carousel.scrollBy({ left: width * 0.6, behavior: 'smooth' });
      return true;
    }

    return false;
  }

  function initLightbox() {
    const { container, image, prevButton, nextButton } = lightboxElements;

    document.addEventListener('click', (event) => {
      if (appState.reorderEnabled) return;
      if (handleCarouselClick(event)) return;

      const clickedImage = event.target.closest('img');
      if (!clickedImage) return;

      openLightbox(clickedImage);
    });

    if (nextButton) {
      nextButton.addEventListener('click', (event) => {
        event.stopPropagation();
        showNextLightboxImage();
      });
    }

    if (prevButton) {
      prevButton.addEventListener('click', (event) => {
        event.stopPropagation();
        showPreviousLightboxImage();
      });
    }

    if (container) {
      container.addEventListener('click', (event) => {
        if (event.target !== image && event.target !== nextButton && event.target !== prevButton) {
          closeLightbox();
        }
      });
    }

    document.addEventListener('keydown', (event) => {
      if (!container || !container.classList.contains('active')) return;

      if (event.key === 'Escape') closeLightbox();
      if (event.key === 'ArrowRight') showNextLightboxImage();
      if (event.key === 'ArrowLeft') showPreviousLightboxImage();
    });
  }

  /* ----------------------------------------------------------------------
     Text Editing (Edit Mode)
     ---------------------------------------------------------------------- */

  function createExportModal(content) {
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
    textarea.value = content.trim();
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

    return modal;
  }

  function normalizeExportHtml(container) {
    const clone = container.cloneNode(true);

    dom.queryAll('[contenteditable]', clone).forEach((element) => {
      element.removeAttribute('contenteditable');
      element.removeAttribute('style');
    });

    dom.queryAll('.photo-edit-controls, .reorder-export-btn, .photo-resize-handle', clone)
      .forEach((element) => element.remove());

    return clone.innerHTML;
  }

  function ensureGlobalExportButton() {
    // Export button disabled
    return;
    
    if (dom.query('#global-export-btn')) return;

    const exportButton = document.createElement('button');
    exportButton.id = 'global-export-btn';
    exportButton.textContent = 'EXPORT PROJECT HTML';

    Object.assign(exportButton.style, {
      position: 'fixed',
      bottom: '20px',
      right: '20px',
      zIndex: 100000,
      padding: '10px 20px',
      background: 'blue',
      color: 'white',
      border: 'none',
      borderRadius: '4px',
      cursor: 'pointer',
      fontWeight: 'bold'
    });

    exportButton.addEventListener('click', () => {
      const activeContainer =
        dom.query('.content-enter') ||
        dom.query('.mobile-project-content') ||
        dom.query('.mobile-content-inject');
      if (!activeContainer) {
        alert('No active project found.');
        return;
      }

      const modal = createExportModal(normalizeExportHtml(activeContainer));
      document.body.appendChild(modal);
    });

    document.body.appendChild(exportButton);
  }

  function enableTextEditing(container) {
    if (!appState.reorderEnabled || !container) return;

    const selectors = 'h2, .summary-col p, .detail-text p, .detail-text, h3, h4, li, .about-text p';
    dom.queryAll(selectors, container).forEach((element) => {
      element.setAttribute('contenteditable', 'true');
      element.style.outline = '1px dashed #ccc';
      element.style.minWidth = '10px';

      element.addEventListener('focus', () => { element.style.outline = '1px solid blue'; });
      element.addEventListener('blur', () => { element.style.outline = '1px dashed #ccc'; });
    });

    ensureGlobalExportButton();
  }

  /* ----------------------------------------------------------------------
     Bootstrap
     ---------------------------------------------------------------------- */

  initHeaderUi();
  initHeroFallback();
  initProjectSystem();
  initLightbox();
  bindToggleButtons(document);

  // Initial lazy load pass for static content.
  activateLazyLoad(document);

  // Mobile-specific optimizations
  if ('ontouchstart' in window) {
    document.body.classList.add('touch-device');
    
    // Add touch feedback for moodboard posts
    document.addEventListener('touchstart', function(e) {
      if (e.target.closest('.moodboard-post')) {
        e.target.closest('.moodboard-post').classList.add('touch-active');
      }
    }, { passive: true });
    
    document.addEventListener('touchend', function(e) {
      setTimeout(() => {
        document.querySelectorAll('.touch-active').forEach(el => {
          el.classList.remove('touch-active');
        });
      }, 150);
    }, { passive: true });
  }

  // Make available for other existing integrations.
  window.enableTextEditing = enableTextEditing;
});
