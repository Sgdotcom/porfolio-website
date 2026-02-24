// Simple Moodboard Layout Script
// Handles grid positioning for static moodboard

(function() {
  'use strict';

  function initMoodboardLayout() {
    const grid = document.querySelector('.moodboard-grid');
    if (!grid) return;

    // Apply grid positioning based on data attributes
    function applyGridLayout() {
      const posts = Array.from(grid.querySelectorAll('.moodboard-post'));
      
      posts.forEach((post) => {
        const wUnits = parseInt(post.getAttribute('data-w-units')) || 1;
        const hUnits = parseInt(post.getAttribute('data-h-units')) || 1;

        // Apply CSS Grid positioning
        post.style.gridColumn = `span ${wUnits}`;
        post.style.gridRow = `span ${hUnits}`;
      });
    }

    // Initial layout
    applyGridLayout();

    // Re-layout on resize
    let resizeTimer;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(applyGridLayout, 250);
    });

    // Add fade-in animation to images
    const images = grid.querySelectorAll('img');
    images.forEach(img => {
      if (img.complete) {
        img.classList.add('loaded');
      } else {
        img.addEventListener('load', () => img.classList.add('loaded'));
      }
    });

    // Add loaded class to videos
    const videos = grid.querySelectorAll('video');
    videos.forEach(video => {
      video.classList.add('loaded');
    });
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initMoodboardLayout);
  } else {
    initMoodboardLayout();
  }

})();
