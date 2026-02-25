// Simple Moodboard Layout Script
// Handles grid positioning for static moodboard

(function() {
  'use strict';

  function init() {
    const grid = document.querySelector('.moodboard-grid');
    if (!grid) return;

    const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    function applyLayout() {
      const posts = Array.from(grid.querySelectorAll('.moodboard-post'));
      posts.forEach((post) => {
        const wUnits = parseInt(post.getAttribute('data-w-units')) || 1;
        const hUnits = parseInt(post.getAttribute('data-h-units')) || 1;
        post.style.gridColumn = `span ${wUnits}`;
        post.style.gridRow = `span ${hUnits}`;
      });
    }

    applyLayout();

    const videos = grid.querySelectorAll('video');
    videos.forEach((video, index) => {
      video.autoplay = true;
      video.muted = true;
      video.loop = true;
      video.playsInline = true;
      video.setAttribute('playsinline', '');
      video.style.opacity = '1';
      video.style.visibility = 'visible';
      video.style.display = 'block';
      video.style.position = 'absolute';
      video.style.top = '0';
      video.style.left = '0';
      video.style.width = '100%';
      video.style.height = '100%';
      video.style.zIndex = '2';
      video.style.background = 'transparent';
      video.removeAttribute('poster');
      video.load();

      const playVideo = () => {
        const playPromise = video.play();
        if (playPromise !== undefined) {
          playPromise.catch(() => {
            video.addEventListener('click', () => video.play(), { once: true });
          });
        }
      };

      playVideo();
      setTimeout(playVideo, 1000);
      document.addEventListener('click', playVideo, { once: true });
      document.addEventListener('touchstart', playVideo, { once: true });
    });

    let resizeTimer;
    let isResizing = false;
    window.addEventListener('resize', () => {
      if (!isResizing) {
        isResizing = true;
        document.body.style.willChange = 'transform';
      }
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        applyLayout();
        isResizing = false;
        document.body.style.willChange = 'auto';
      }, 250);
    });
  }

  function saveLayout() {
    applyLayout();
  }

  function loadMoodboardGallery() {
    return Promise.resolve();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
