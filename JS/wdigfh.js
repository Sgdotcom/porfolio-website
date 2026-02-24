// Simple Moodboard Layout Script
// Handles grid positioning for static moodboard

(function() {
  'use strict';

  function initMoodboardLayout() {
    const grid = document.querySelector('.moodboard-grid');
    if (!grid) return;

    const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

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

    // Simple video autoplay handling
    const videos = grid.querySelectorAll('video');
    console.log(`Found ${videos.length} videos`);
    
    videos.forEach((video, index) => {
      console.log(`Video ${index}:`, video.querySelector('source')?.src);
      
      // Set proper video attributes that were in the working version
      video.autoplay = true;
      video.muted = true;
      video.loop = true;
      video.playsInline = true;
      video.setAttribute('playsinline', '');
      
      // Force video visibility
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
      
      // Remove any potential poster
      video.removeAttribute('poster');
      
      // Force load the video
      video.load();
      
      // Add multiple event listeners for debugging
      video.addEventListener('loadstart', () => console.log(`Video ${index}: loadstart`));
      video.addEventListener('loadeddata', () => console.log(`Video ${index}: loadeddata`));
      video.addEventListener('canplay', () => console.log(`Video ${index}: canplay`));
      video.addEventListener('playing', () => console.log(`Video ${index}: playing`));
      video.addEventListener('error', (e) => console.error(`Video ${index}: error`, e));
      
      // Try to play video with multiple fallbacks
      const playVideo = () => {
        const playPromise = video.play();
        if (playPromise !== undefined) {
          playPromise.then(() => {
            console.log(`Video ${index} playing successfully`);
          }).catch(error => {
            console.log(`Video ${index} autoplay blocked:`, error);
            // Add click to play functionality
            video.addEventListener('click', () => {
              video.play();
            }, { once: true });
          });
        }
      };
      
      // Try playing immediately
      playVideo();
      
      // Also try playing after a delay
      setTimeout(playVideo, 1000);
      
      // Try playing when user interacts with page
      document.addEventListener('click', playVideo, { once: true });
      document.addEventListener('touchstart', playVideo, { once: true });
    });

    // Re-layout on resize with debouncing and performance optimization
    let resizeTimer;
    let isResizing = false;
    window.addEventListener('resize', () => {
      if (!isResizing) {
        isResizing = true;
        document.body.style.willChange = 'transform';
      }
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        applyGridLayout();
        isResizing = false;
        document.body.style.willChange = 'auto';
      }, 250);
    });
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initMoodboardLayout);
  } else {
    initMoodboardLayout();
  }

})();
