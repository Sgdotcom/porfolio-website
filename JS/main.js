/* ==========================================================================
   2. GLOBAL UTILITIES
   ========================================================================== */
window.toggleDescription = function (btn) {
  const container = btn.closest('.detail-col');
  if (!container) return;
  const content = container.querySelector('.detail-text');

  if (content) {
    if (content.classList.contains('expanded')) {
      content.classList.remove('expanded');
      btn.innerHTML = "Show More +";
    } else {
      content.classList.add('expanded');
      btn.innerHTML = "Show Less -";
    }
  }
};


/* ==========================================================================
   3. MAIN INITIALIZATION
   ========================================================================== */
document.addEventListener('DOMContentLoaded', () => {
  const params = new URLSearchParams(window.location.search);
  const localHost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.protocol === 'file:';
  const reorderEnabled = localHost && params.get('edit') === '1';

  // --- LAZY LOAD SETUP ---------------------------------------------------
  const observerOptions = { root: null, rootMargin: '200px', threshold: 0.1 };

  const observer = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const media = entry.target;
        if (media.dataset.width) applyItemWidth(media);
        if (media.tagName === 'IMG') {
          media.onload = () => media.classList.add('loaded');
          media.onerror = () => media.classList.add('loaded');
          media.src = media.dataset.src;
          if (media.complete && media.naturalHeight !== 0) {
            media.classList.add('loaded');
          }
        }
        if (media.tagName === 'VIDEO') {
          media.src = media.dataset.src;
          media.load();
          media.classList.add('loaded');
        }
        observer.unobserve(media);
      }
    });
  }, observerOptions);

  window.activateLazyLoad = function (container) {
    const sized = container.querySelectorAll('img[data-width], video[data-width]');
    sized.forEach(item => applyItemWidth(item));

    const targets = container.querySelectorAll('img[data-src], video[data-src]');
    targets.forEach(target => observer.observe(target));
  };

  function getMediaKey(el) {
    if (!el) return '';
    return el.getAttribute('data-src') || el.getAttribute('src') || '';
  }

  function applyItemWidth(item) {
    const w = Number(item.dataset.width || 100);
    const clamped = Number.isFinite(w) ? Math.max(35, Math.min(100, w)) : 100;
    item.dataset.width = String(clamped);
    item.style.width = `${clamped}%`;
  }

  function applySavedSizes(stack) {
    const sortKey = stack.getAttribute('data-sort-key');
    if (!sortKey) return;

    try {
      const saved = localStorage.getItem(`photo-size:${sortKey}`);
      if (!saved) return;
      const sizes = JSON.parse(saved);
      if (!sizes || typeof sizes !== 'object') return;

      stack.querySelectorAll('img, video').forEach(item => {
        const key = getMediaKey(item);
        const w = key ? Number(sizes[key]) : NaN;
        if (Number.isFinite(w)) {
          item.dataset.width = String(w);
        }
      });
    } catch (_) {
      // Ignore invalid persisted data.
    }
  }

  function applySavedOrder(stack) {
    const sortKey = stack.getAttribute('data-sort-key');
    if (!sortKey) return;

    try {
      const saved = localStorage.getItem(`photo-order:${sortKey}`);
      if (!saved) return;

      const order = JSON.parse(saved);
      if (!Array.isArray(order) || !order.length) return;

      const items = Array.from(stack.querySelectorAll('img, video'));
      const byKey = new Map(items.map(item => [getMediaKey(item), item]));
      const placed = new Set();

      order.forEach(key => {
        const item = byKey.get(key);
        if (item) {
          stack.appendChild(item);
          placed.add(item);
        }
      });

      items.forEach(item => {
        if (!placed.has(item)) stack.appendChild(item);
      });
    } catch (_) {
      // Ignore invalid persisted data.
    }
  }

  function saveOrder(stack) {
    const sortKey = stack.getAttribute('data-sort-key');
    if (!sortKey) return;

    const keys = Array.from(stack.querySelectorAll('img, video'))
      .map(getMediaKey)
      .filter(Boolean);

    try {
      localStorage.setItem(`photo-order:${sortKey}`, JSON.stringify(keys));
    } catch (_) {
      // Ignore storage failures.
    }
  }

  function saveSizes(stack) {
    const sortKey = stack.getAttribute('data-sort-key');
    if (!sortKey) return;

    const sizes = {};
    stack.querySelectorAll('img, video').forEach(item => {
      const key = getMediaKey(item);
      const width = Number(item.dataset.width || 100);
      if (key && Number.isFinite(width)) sizes[key] = width;
    });

    try {
      localStorage.setItem(`photo-size:${sortKey}`, JSON.stringify(sizes));
    } catch (_) {
      // Ignore storage failures.
    }
  }

  function getSavedFreeLayout(stack) {
    const sortKey = stack.getAttribute('data-sort-key');
    if (!sortKey) return {};
    try {
      const raw = localStorage.getItem(`photo-layout:${sortKey}`);
      const parsed = raw ? JSON.parse(raw) : {};
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (_) {
      return {};
    }
  }

  function saveFreeLayout(stack) {
    const sortKey = stack.getAttribute('data-sort-key');
    if (!sortKey) return;

    const payload = {};
    stack.querySelectorAll('.photo-free-item').forEach(wrapper => {
      const media = wrapper.querySelector('img, video');
      const key = getMediaKey(media);
      if (!key) return;
      payload[key] = {
        x: Number(wrapper.dataset.x || 0),
        y: Number(wrapper.dataset.y || 0),
        w: Number(media.dataset.width || 0),
        z: Number(wrapper.style.zIndex || 1)
      };
    });

    try {
      localStorage.setItem(`photo-layout:${sortKey}`, JSON.stringify(payload));
    } catch (_) {
      // Ignore storage failures.
    }
  }

  function ensureFreeStackHeight(stack) {
    let maxBottom = 0;
    stack.querySelectorAll('.photo-free-item').forEach(wrapper => {
      const y = Number(wrapper.dataset.y || 0);
      const h = wrapper.offsetHeight || 0;
      maxBottom = Math.max(maxBottom, y + h);
    });
    stack.style.minHeight = `${Math.ceil(maxBottom + 30)}px`;
  }

  function clamp(num, min, max) {
    return Math.min(max, Math.max(min, num));
  }

  function applyFreeItemLayout(stack, wrapper, media, x, y, w) {
    const safeW = clamp(Number.isFinite(w) ? w : 0, 0, 100);
    const stackW = Math.max(1, stack.clientWidth);
    const itemPxW = (stackW * safeW) / 100;

    const maxX = Math.max(0, stackW - itemPxW);
    const clampedX = clamp(Number.isFinite(x) ? x : 0, 0, maxX);
    const clampedY = Math.max(0, Number.isFinite(y) ? y : 0);

    wrapper.dataset.x = String(clampedX);
    wrapper.dataset.y = String(clampedY);
    media.dataset.width = String(safeW);
    media.style.width = '100%';
    media.style.transform = 'none';

    wrapper.style.left = `${clampedX}px`;
    wrapper.style.top = `${clampedY}px`;
    wrapper.style.width = `${safeW}%`;
  }

  function attachFreeItemInteractions(stack, wrapper, media) {
    const handle = wrapper.querySelector('.photo-resize-handle');
    if (!handle || wrapper.dataset.interactionBound === 'true') return;
    wrapper.dataset.interactionBound = 'true';

    let mode = '';
    let startX = 0;
    let startY = 0;
    let baseX = 0;
    let baseY = 0;
    let baseW = 0;

    const onMove = (e) => {
      if (!mode) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;

      if (mode === 'move') {
        applyFreeItemLayout(stack, wrapper, media, baseX + dx, baseY + dy, baseW);
      } else if (mode === 'resize') {
        const nextW = baseW + (dx / Math.max(1, stack.clientWidth)) * 100;
        applyFreeItemLayout(stack, wrapper, media, baseX, baseY, nextW);
      }

      ensureFreeStackHeight(stack);
      e.preventDefault();
    };

    const onUp = () => {
      if (!mode) return;
      mode = '';
      wrapper.classList.remove('editing');
      saveFreeLayout(stack);
      ensureFreeStackHeight(stack);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };

    wrapper.addEventListener('pointerdown', (e) => {
      if (e.target === handle || e.button !== 0) return;
      mode = 'move';
      startX = e.clientX;
      startY = e.clientY;
      baseX = Number(wrapper.dataset.x || 0);
      baseY = Number(wrapper.dataset.y || 0);
      baseW = Number(media.dataset.width || 0);
      wrapper.classList.add('editing');
      wrapper.style.zIndex = String(1000 + Date.now() % 100000);
      window.addEventListener('pointermove', onMove, { passive: false });
      window.addEventListener('pointerup', onUp);
      window.addEventListener('pointercancel', onUp);
      e.preventDefault();
    });

    handle.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      mode = 'resize';
      startX = e.clientX;
      startY = e.clientY;
      baseX = Number(wrapper.dataset.x || 0);
      baseY = Number(wrapper.dataset.y || 0);
      baseW = Number(media.dataset.width || 0);
      wrapper.classList.add('editing');
      wrapper.style.zIndex = String(1000 + Date.now() % 100000);
      window.addEventListener('pointermove', onMove, { passive: false });
      window.addEventListener('pointerup', onUp);
      window.addEventListener('pointercancel', onUp);
      e.preventDefault();
      e.stopPropagation();
    });
  }

  function enablePhotoReorder(container) {
    if (!reorderEnabled) return;
    if (!container) return;

    const stacks = container.querySelectorAll('.photo-stack[data-sort-key="content-photography"]');
    stacks.forEach(stack => {
      if (stack.dataset.reorderBound === 'true') return;
      stack.dataset.reorderBound = 'true';
      stack.classList.add('edit-freeform');
      stack.dataset.editMode = 'freeform';
      stack.querySelectorAll('img[data-src], video[data-src]').forEach(media => {
        if (!media.getAttribute('src')) {
          media.setAttribute('src', media.getAttribute('data-src') || '');
          media.classList.add('loaded');
        }
      });

      const savedLayout = getSavedFreeLayout(stack);
      const medias = Array.from(stack.querySelectorAll('img, video'));
      const gap = 22;
      let yCursor = 0;

      medias.forEach((media, idx) => {
        const key = getMediaKey(media);
        const saved = key ? savedLayout[key] : null;

        let wrapper = media.closest('.photo-free-item');
        if (!wrapper) {
          wrapper = document.createElement('div');
          wrapper.className = 'photo-free-item';
          media.parentNode.insertBefore(wrapper, media);
          wrapper.appendChild(media);
        }

        if (!wrapper.querySelector('.photo-resize-handle')) {
          const handle = document.createElement('button');
          handle.type = 'button';
          handle.className = 'photo-resize-handle';
          handle.setAttribute('aria-label', 'Resize image');
          wrapper.appendChild(handle);
        }

        const widthFromMedia = Number(media.dataset.width);
        const patternDefault = [38, 28, 33, 25, 40, 30][idx % 6];
        const w = Number.isFinite(saved?.w)
          ? saved.w
          : (Number.isFinite(widthFromMedia) ? widthFromMedia : patternDefault);

        const aspect = media.naturalWidth > 0 ? (media.naturalHeight / media.naturalWidth) : 0.7;
        const pxW = (Math.max(1, stack.clientWidth) * clamp(w, 0, 100)) / 100;
        const estH = Math.max(40, pxW * aspect);

        const x = Number.isFinite(saved?.x) ? saved.x : 0;
        const y = Number.isFinite(saved?.y) ? saved.y : yCursor;

        applyFreeItemLayout(stack, wrapper, media, x, y, w);
        wrapper.style.zIndex = String(Number.isFinite(saved?.z) ? saved.z : (idx + 1));
        yCursor = Math.max(yCursor, y + estH + gap);
        attachFreeItemInteractions(stack, wrapper, media);
      });

      ensureFreeStackHeight(stack);
      saveFreeLayout(stack);

      const onResize = () => {
        stack.querySelectorAll('.photo-free-item').forEach(wrapper => {
          const media = wrapper.querySelector('img, video');
          if (!media) return;
          applyFreeItemLayout(
            stack,
            wrapper,
            media,
            Number(wrapper.dataset.x || 0),
            Number(wrapper.dataset.y || 0),
            Number(media.dataset.width || 0)
          );
        });
        ensureFreeStackHeight(stack);
      };
      window.addEventListener('resize', onResize);

      if (!stack.parentElement.querySelector('.photo-edit-controls')) {
        const controls = document.createElement('div');
        controls.className = 'photo-edit-controls';

        const exportBtn = document.createElement('button');
        exportBtn.type = 'button';
        exportBtn.className = 'reorder-export-btn';
        exportBtn.textContent = 'Export Freeform HTML';

        exportBtn.addEventListener('click', async () => {
          const nodes = Array.from(stack.querySelectorAll('.photo-free-item'));
          const htmlSnippet = nodes.map(wrapper => {
            const el = wrapper.querySelector('img, video');
            if (!el) return '';
            const src = getMediaKey(el);
            if (!src) return '';
            const w = clamp(Number(el.dataset.width || 0), 0, 100);
            const x = Math.round(Number(wrapper.dataset.x || 0));
            const y = Math.round(Number(wrapper.dataset.y || 0));
            const tag = el.tagName.toLowerCase();
            return `<${tag} data-src="${src}" data-width="${w}" data-x="${x}" data-y="${y}">`;
          }).filter(Boolean).join('\n');

          const textBlock = [
            '# HTML snippet (replace photo-stack content)',
            htmlSnippet
          ].join('\n');

          try {
            await navigator.clipboard.writeText(textBlock);
            exportBtn.textContent = 'Copied';
            setTimeout(() => { exportBtn.textContent = 'Export Freeform HTML'; }, 1400);
          } catch (_) {
            window.prompt('Copy this HTML:', textBlock);
          }
        });

        const resetBtn = document.createElement('button');
        resetBtn.type = 'button';
        resetBtn.className = 'reorder-export-btn';
        resetBtn.textContent = 'Reset Positions';
        resetBtn.addEventListener('click', () => {
          const sortKey = stack.getAttribute('data-sort-key');
          if (sortKey) localStorage.removeItem(`photo-layout:${sortKey}`);
          location.reload();
        });

        controls.appendChild(exportBtn);
        controls.appendChild(resetBtn);
        stack.parentElement.insertBefore(controls, stack);
      }
    });
  }


  // --- A. HEADER & GLOBAL SETTINGS ---------------------------------------

  // 1. Last Updated
  const modified = new Date(document.lastModified);
  const dateOptions = { year: 'numeric', month: '2-digit', day: '2-digit' };
  const lastUpdatedEl = document.getElementById('last-updated');
  if (lastUpdatedEl) {
    lastUpdatedEl.textContent = 'LAST UPDATED: ' + modified.toLocaleDateString('en-GB', dateOptions);
  }

  // 2. Dark Mode
  const toggle = document.getElementById('dark-toggle');
  if (localStorage.getItem('theme') === 'dark') {
    document.body.classList.add('dark');
  }
  if (toggle) {
    toggle.addEventListener('click', () => {
      document.body.classList.toggle('dark');
      localStorage.setItem('theme', document.body.classList.contains('dark') ? 'dark' : 'light');
    });
  }

  // 3. Scroll To Top
  const scrollLink = document.querySelector('a[href="#top"]');
  if (scrollLink) {
    scrollLink.addEventListener('click', (e) => {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  // 4. Contact Menu
  const contactWrapper = document.querySelector('.contact-wrapper');
  const contactOverlay = document.getElementById('contact-overlay');
  if (contactWrapper && contactOverlay) {
    contactWrapper.addEventListener('click', (e) => {
      if (contactOverlay.contains(e.target)) return;
      e.stopPropagation();
      e.preventDefault();
      setTimeout(() => {
        contactWrapper.classList.toggle('active');
      }, 10);
    });
    document.addEventListener('click', (e) => {
      if (contactWrapper.classList.contains('active')) {
        contactWrapper.classList.remove('active');
      }
    });
  }

  // 5. Footer Repeat Text (fill width without justification)
  const repeatLine = document.querySelector('.wip-repeat');
  function fillFooterRepeatLine() {
    if (!repeatLine) return;

    const phrase = (repeatLine.dataset.phrase || 'where do i go from here?').trim();
    repeatLine.textContent = phrase;

    // Build enough repeated phrases to cover visible width.
    while (repeatLine.scrollWidth <= repeatLine.clientWidth) {
      repeatLine.textContent += ` ${phrase}`;
    }
  }
  fillFooterRepeatLine();
  window.addEventListener('resize', fillFooterRepeatLine);


  // --- B. SIDEBAR & NAVIGATION (BACK TO HOME LOGIC) ----------------------

  const rightSide = document.getElementById('right-side');

  if (rightSide) {
    rightSide.addEventListener('click', (e) => {
      // For homepage feed, make H2 titles clickable to open the project view
      if (e.target.tagName === 'H2' && e.target.closest('.project-layout') && e.target.closest('.home-project-section')) {
        const projectSection = e.target.closest('.home-project-section');
        if (projectSection) {
          const templateId = projectSection.getAttribute('data-template-id');
          if (templateId) {
            const projectLink = document.querySelector(`.project-wrapper a[data-template="${templateId}"]`);
            if (projectLink) {
              projectLink.click();
            }
          }
        }
      }
    });
  }

  const nameElement = document.querySelector('.name');
  const projectLinks = document.querySelectorAll('.project-wrapper a[data-template]');
  let homepageFeedObserver = null;
  let homepageActiveTicking = false;

  function stopHomepageFeedObserver() {
    if (!homepageFeedObserver) return;
    homepageFeedObserver.disconnect();
    homepageFeedObserver = null;
  }

  function hydrateHomepageSection(section) {
    if (!section || section.dataset.hydrated === 'true') return;
    const templateId = section.getAttribute('data-template-id');
    const template = templateId ? document.getElementById(templateId) : null;
    if (!template) return;

    section.innerHTML = '';
    section.classList.remove('home-project-shell');
    section.dataset.hydrated = 'true';
    section.appendChild(template.content.cloneNode(true));
    activateLazyLoad(section);
    enablePhotoReorder(section);
  }

  function startHomepageFeedObserver() {
    stopHomepageFeedObserver();
    const shells = rightSide ? rightSide.querySelectorAll('.home-project-section') : [];
    if (!shells.length) return;

    homepageFeedObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        hydrateHomepageSection(entry.target);
        observer.unobserve(entry.target);
      });
    }, { root: null, rootMargin: '900px 0px', threshold: 0.01 });

    shells.forEach(shell => homepageFeedObserver.observe(shell));
  }

  function setHomepageActiveLink(templateId) {
    document.querySelectorAll('.project-wrapper.homepage-active').forEach(wrapper => {
      wrapper.classList.remove('homepage-active');
    });
    if (!templateId) return;
    const activeLink = document.querySelector(`.project-wrapper a[data-template="${templateId}"]`);
    const activeWrapper = activeLink ? activeLink.closest('.project-wrapper') : null;
    if (activeWrapper) activeWrapper.classList.add('homepage-active');
  }

  function updateHomepageActiveFromScroll() {
    const isDesktopHome = window.innerWidth > 850 && !document.body.classList.contains('project-open');
    if (!isDesktopHome || !rightSide) {
      setHomepageActiveLink(null);
      return;
    }

    const sections = rightSide.querySelectorAll('.home-project-section[data-template-id]');
    if (!sections.length) {
      setHomepageActiveLink(null);
      return;
    }

    // Stable marker just below the top bar.
    const markerY = 140;
    let closest = null;

    // Use the last section that has crossed the marker.
    sections.forEach(section => {
      const rect = section.getBoundingClientRect();
      if (rect.top <= markerY) closest = section;
    });

    // Nothing active until a section reaches the marker line.
    if (!closest) {
      setHomepageActiveLink(null);
      return;
    }

    const templateId = closest ? closest.getAttribute('data-template-id') : null;
    setHomepageActiveLink(templateId);
  }

  function scheduleHomepageActiveUpdate() {
    if (homepageActiveTicking) return;
    homepageActiveTicking = true;
    requestAnimationFrame(() => {
      homepageActiveTicking = false;
      updateHomepageActiveFromScroll();
    });
  }

  function renderHomepageFeed() {
    if (!rightSide) return;
    const isDesktop = window.innerWidth > 850;

    // Homepage feed only on desktop landing state.
    if (!isDesktop || document.body.classList.contains('project-open')) {
      stopHomepageFeedObserver();
      if (!document.body.classList.contains('project-open')) rightSide.innerHTML = '';
      setHomepageActiveLink(null);
      return;
    }

    stopHomepageFeedObserver();
    rightSide.innerHTML = '';
    const frag = document.createDocumentFragment();

    projectLinks.forEach(link => {
      const templateId = link.getAttribute('data-template');
      if (!templateId || !document.getElementById(templateId)) return;
      if (templateId === 'content-about') return;
      const label = (link.textContent || '').replace(/\s+/g, ' ').trim();

      const section = document.createElement('section');
      section.className = 'content-enter visible home-project-section home-project-shell';
      section.setAttribute('data-template-id', templateId);
      section.setAttribute('data-hydrated', 'false');
      section.innerHTML = `<p class="home-project-shell-label">${label}</p>`;
      frag.appendChild(section);
    });

    rightSide.appendChild(frag);
    startHomepageFeedObserver();
    scheduleHomepageActiveUpdate();
  }

  function resetProjects() {
    document.querySelectorAll('.project-wrapper').forEach(wrapper => {
      wrapper.classList.remove('active');
      const text = wrapper.querySelector('.project-text');
      if (text) {
        text.style.maxHeight = null;
        text.style.opacity = null;
        text.style.marginTop = null;
      }
      // Reset buttons text
      const btn = wrapper.querySelector('.toggle-btn');
      if (btn) btn.textContent = "Show More +";

      const hiddenContent = wrapper.querySelector('.info-collapsible');
      if (hiddenContent) {
        hiddenContent.classList.remove('expanded');
        hiddenContent.style.display = ''; // Clear any legacy inline styles
      }
    });
  }

  if (nameElement) {
    nameElement.addEventListener('click', () => {
      // 1. REMOVE THE CLASS (Triggers transition back to Landing Layout)
      document.body.classList.remove('project-open');

      // 2. Clear the Right Side Content
      if (rightSide) {
        rightSide.innerHTML = '';
      }

      resetProjects();
      renderHomepageFeed();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }


  // --- C. PROJECT SYSTEM (OPEN PROJECT LOGIC) ----------------------------

  const projectWrappers = document.querySelectorAll('.project-wrapper');

  // 1. Align Popout
  function alignPopout() {
    const firstLink = document.querySelector('.project-wrapper:first-child a');
    if (firstLink) {
      const rect = firstLink.getBoundingClientRect();
      const offset = -10;
      const finalTop = rect.top + offset;
      document.documentElement.style.setProperty('--popout-top', `${finalTop}px`);
    }
  }
  alignPopout();
  window.addEventListener('resize', alignPopout);
  window.addEventListener('resize', renderHomepageFeed);
  window.addEventListener('resize', scheduleHomepageActiveUpdate);
  window.addEventListener('scroll', scheduleHomepageActiveUpdate, { passive: true });
  renderHomepageFeed();

  // 2. Project Hover Logic
  projectWrappers.forEach(wrapper => {
    const popoutContainer = wrapper.querySelector('.project-popout');
    const media = wrapper.querySelector('.project-popout img, .project-popout video');
    const link = wrapper.querySelector('a');
    const previewSrc = link ? link.getAttribute('data-image') : null;

    if (popoutContainer && media) {
      wrapper.addEventListener('mouseenter', () => {
        if (previewSrc) {
          media.src = previewSrc;
          if (media.tagName === 'VIDEO') {
            media.play().catch(e => { });
          }
          if (!wrapper.classList.contains('active')) {
            popoutContainer.style.opacity = "1";
          }
        }
      });
      wrapper.addEventListener('mouseleave', () => {
        popoutContainer.style.opacity = "0";
        if (media.tagName === 'VIDEO') {
          media.pause();
        }
      });
    }
  });

  // 3. Project Click Logic
  projectWrappers.forEach(wrapper => {
    const link = wrapper.querySelector('a');

    if (link) {
      link.addEventListener('click', (e) => {
        e.preventDefault();

        const isMobile = window.innerWidth <= 850;

        // --- 1. ACTIVATE LANDING TRANSITION (Desktop Only) ---
        if (!isMobile) {
          document.body.classList.add('project-open');
          setHomepageActiveLink(null);
        }

        // --- CHECK: ALREADY OPEN? ---
        if (wrapper.classList.contains('active')) {
          if (isMobile) {
            wrapper.classList.remove('active');
            const existing = wrapper.querySelector('.mobile-content-inject');
            if (existing) existing.remove();

            const details = wrapper.querySelector('.project-text');
            if (details) {
              details.style.maxHeight = null;
              details.style.opacity = null;
              details.style.marginTop = null;
            }
          } else {
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }
          return;
        }

        // --- RESET OTHERS ---
        document.querySelectorAll('.project-wrapper').forEach(w => {
          if (w !== wrapper) {
            w.classList.remove('active');
            const text = w.querySelector('.project-text');
            const mobileContent = w.querySelector('.mobile-content-inject');
            const otherPopout = w.querySelector('.project-popout');
            const btn = w.querySelector('.toggle-btn');
            const hidden = w.querySelector('.info-collapsible');

            if (otherPopout) otherPopout.style.opacity = "0";
            if (text) {
              text.style.maxHeight = null;
              text.style.opacity = null;
              text.style.marginTop = null;
            }
            if (mobileContent) mobileContent.remove();

            // Reset Accordions
            if (btn) btn.textContent = "Show More +";
            if (hidden) hidden.style.display = '';
          }
        });

        // --- ACTIVATE CURRENT ---
        wrapper.classList.add('active');

        // Hide CURRENT popout
        const currentPopout = wrapper.querySelector('.project-popout');
        if (currentPopout) currentPopout.style.opacity = "0";

        // Open Sidebar Text (Left Side)
        const details = wrapper.querySelector('.project-text');
        if (details) {
          details.style.maxHeight = details.scrollHeight + 'px';
          details.style.opacity = 1;
          details.style.marginTop = '5px';
        }

        // --- LOAD CONTENT ---
        if (isMobile) {
          // MOBILE INJECTION
          const existing = wrapper.querySelector('.mobile-content-inject');
          if (existing) existing.remove();

          const templateId = link.getAttribute('data-template');
          const template = document.getElementById(templateId);
          const inlineContainer = document.createElement('div');
          inlineContainer.className = 'mobile-content-inject';

          if (template) {
            inlineContainer.appendChild(template.content.cloneNode(true));
          } else {
            inlineContainer.innerHTML = `<div style="padding:20px;">Content coming soon...</div>`;
          }

          wrapper.appendChild(inlineContainer);
          activateLazyLoad(inlineContainer);
          enablePhotoReorder(inlineContainer);
          enableTextEditing(inlineContainer);
          requestAnimationFrame(() => inlineContainer.style.opacity = "1");

        } else {
          // DESKTOP INJECTION (Right Side)
          if (rightSide) {
            rightSide.innerHTML = '';
            const templateId = link.getAttribute('data-template');
            const template = document.getElementById(templateId);
            const contentWrapper = document.createElement('div');
            contentWrapper.className = 'content-enter';

            if (template) contentWrapper.appendChild(template.content.cloneNode(true));
            else contentWrapper.innerHTML = `<div style="padding:40px;">Content coming soon...</div>`;

            rightSide.appendChild(contentWrapper);
            activateLazyLoad(contentWrapper);
            enablePhotoReorder(contentWrapper);
            enableTextEditing(contentWrapper);

            window.scrollTo({ top: 0, behavior: 'smooth' });
            setTimeout(() => contentWrapper.classList.add('visible'), 10);
          }
        }
      });
    }
  });


  // --- D. LIGHTBOX SYSTEM ------------------------------------------------

  const lightbox = document.getElementById('lightbox');
  const lightboxImg = document.getElementById('lightbox-img');
  const prevBtn = document.querySelector('.lightbox-prev');
  const nextBtn = document.querySelector('.lightbox-next');

  let currentImages = [];
  let currentIndex = 0;

  // 1. Open Lightbox
  document.addEventListener('click', (e) => {
    if (reorderEnabled) return;

    // Carousel Click-to-Scroll Logic
    const carousel = e.target.closest('.carousel');
    if (carousel) {
      const rect = carousel.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const width = rect.width;

      // Left 35% -> Scroll Left
      if (x < width * 0.35) {
        carousel.scrollBy({ left: -width * 0.6, behavior: 'smooth' });
        return;
      }
      // Right 35% -> Scroll Right
      else if (x > width * 0.65) {
        carousel.scrollBy({ left: width * 0.6, behavior: 'smooth' });
        return;
      }
    }

    if (e.target.tagName === 'IMG') {
      const container = e.target.closest('.temp-grid') ||
        e.target.closest('.photo-stack');

      if (container) {
        const images = container.querySelectorAll('img');
        currentImages = Array.from(images).map(img => img.src || img.dataset.src);
        currentIndex = currentImages.indexOf(e.target.src) !== -1
          ? currentImages.indexOf(e.target.src)
          : currentImages.indexOf(e.target.dataset.src);

        if (currentIndex === -1) currentIndex = 0;

        updateLightboxImage();
        lightbox.classList.add('active');
      }
    }
  });

  // 2. Update Image
  function updateLightboxImage() {
    lightboxImg.classList.add('lightbox-switching');
    setTimeout(() => {
      lightboxImg.src = currentImages[currentIndex];

      const nextIndex = (currentIndex + 1) % currentImages.length;
      new Image().src = currentImages[nextIndex];

      requestAnimationFrame(() => {
        lightboxImg.classList.remove('lightbox-switching');
      });
    }, 150);
  }

  // 3. Controls
  function showNext() {
    currentIndex = (currentIndex + 1) % currentImages.length;
    updateLightboxImage();
  }
  function showPrev() {
    currentIndex = (currentIndex - 1 + currentImages.length) % currentImages.length;
    updateLightboxImage();
  }

  if (nextBtn) nextBtn.addEventListener('click', (e) => { e.stopPropagation(); showNext(); });
  if (prevBtn) prevBtn.addEventListener('click', (e) => { e.stopPropagation(); showPrev(); });

  if (lightbox) {
    lightbox.addEventListener('click', (e) => {
      if (e.target !== lightboxImg && e.target !== nextBtn && e.target !== prevBtn) {
        lightbox.classList.remove('active');
      }
    });
  }

  document.addEventListener('keydown', (e) => {
    if (!lightbox || !lightbox.classList.contains('active')) return;
    if (e.key === 'Escape') lightbox.classList.remove('active');
    if (e.key === 'ArrowRight') showNext();
    if (e.key === 'ArrowLeft') showPrev();
  });

  function enableTextEditing(container) {
    if (!reorderEnabled || !container) return;

    const editables = container.querySelectorAll('h2, .summary-col p, .detail-text p, .detail-text, h3, h4, li, .about-text p');
    editables.forEach(el => {
      el.setAttribute('contenteditable', 'true');
      el.style.outline = '1px dashed #ccc';
      el.style.minWidth = '10px';
      el.addEventListener('focus', () => el.style.outline = '1px solid blue');
      el.addEventListener('blur', () => el.style.outline = '1px dashed #ccc');
    });

    if (!document.getElementById('global-export-btn')) {
      const btn = document.createElement('button');
      btn.id = 'global-export-btn';
      btn.textContent = 'EXPORT PROJECT HTML';
      Object.assign(btn.style, {
        position: 'fixed', bottom: '20px', right: '20px', zIndex: 100000,
        padding: '10px 20px', background: 'blue', color: 'white',
        border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold'
      });
      document.body.appendChild(btn);

      btn.addEventListener('click', () => {
        const activeContainer = document.querySelector('.content-enter') || document.querySelector('.mobile-content-inject');
        if (!activeContainer) return alert('No active project found.');

        const clone = activeContainer.cloneNode(true);
        clone.querySelectorAll('[contenteditable]').forEach(el => {
          el.removeAttribute('contenteditable');
          el.removeAttribute('style');
        });

        clone.querySelectorAll('.photo-edit-controls, .reorder-export-btn, .photo-resize-handle').forEach(el => el.remove());

        let html = clone.innerHTML;

        const modal = document.createElement('div');
        Object.assign(modal.style, {
          position: 'fixed', top: '0', left: '0', width: '100%', height: '100%',
          background: 'rgba(0,0,0,0.8)', zIndex: 100001, display: 'flex',
          alignItems: 'center', justifyContent: 'center'
        });

        const textarea = document.createElement('textarea');
        textarea.value = html.trim();
        Object.assign(textarea.style, {
          width: '80%', height: '80%', fontFamily: 'monospace', fontSize: '12px', padding: '10px'
        });

        const close = document.createElement('button');
        close.textContent = 'CLOSE';
        Object.assign(close.style, {
          position: 'absolute', top: '20px', right: '20px', padding: '10px',
          background: 'white', border: 'none', cursor: 'pointer'
        });
        close.onclick = () => modal.remove();

        modal.appendChild(textarea);
        modal.appendChild(close);
        document.body.appendChild(modal);
      });
    }
  }

});
