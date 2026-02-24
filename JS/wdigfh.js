'use strict';

(function moodboardApp() {
  // Environment-based logging
  const isDevelopment = window.location.hostname.includes('localhost') || 
                        window.location.hostname.includes('127.0.0.1') ||
                        window.location.protocol === 'file:';
  const log = isDevelopment ? console.log : () => {};
  const logError = console.error; // Always log errors
  const logWarn = isDevelopment ? console.warn : () => {};

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
    unitAspectRatio: 4 / 3,
    maxRetries: 3,
    retryDelayMs: 1000,
    uploadUrl: 'api/upload.php', // PHP endpoint for uploads
    supportedFormats: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'avif'],
    maxFileSize: 10 * 1024 * 1024, // 10MB
    autoSaveDelayMs: 2000 // Auto-save after 2 seconds of inactivity
  };

  const state = {
    editMode: false,
    interactInitialized: false,
    moodboardGalleryReady: Promise.resolve(),
    isUploading: false,
    uploadQueue: [],
    autoSaveTimer: null,
    hasUnsavedChanges: false
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
    log('applyLayout called');
    if (!dom.grid) {
      log('No grid element found for layout');
      return;
    }

    dom.grid.classList.add('edit-freeform');

    const posts = Array.from(dom.grid.querySelectorAll(SELECTORS.moodboardPost));
    log('Found posts for layout:', posts.length);

    const { columns, unitWidth, unitHeight, startY } = getGridMetrics(dom.grid);
    log('Grid metrics:', { columns, unitWidth, unitHeight, startY });

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

    posts.forEach((postElement, index) => {
      const widthUnits = Math.min(columns, Number(postElement.getAttribute('data-w-units')) || 1);
      const heightUnits = Number(postElement.getAttribute('data-h-units')) || 1;

      log(`Laying out post ${index}:`, { widthUnits, heightUnits });

      let row = 0;
      let col = 0;
      let positioned = false;

      while (!positioned) {
        if (isAreaClear(row, col, widthUnits, heightUnits)) {
          const x = col * unitWidth;
          const y = startY + (row * unitHeight);

          log(`Positioning post ${index} at:`, { x, y, row, col });

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
    log('Layout applied successfully');
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

    // Mark as saved
    state.hasUnsavedChanges = false;
    updateSaveIndicator();
  }

  function triggerAutoSave() {
    state.hasUnsavedChanges = true;
    updateSaveIndicator();
    
    // Clear existing timer
    if (state.autoSaveTimer) {
      clearTimeout(state.autoSaveTimer);
    }
    
    // Set new timer
    state.autoSaveTimer = setTimeout(() => {
      if (state.hasUnsavedChanges) {
        saveLayout();
        log('Auto-saved layout');
      }
    }, CONFIG.autoSaveDelayMs);
  }

  function updateSaveIndicator() {
    const editIndicator = document.getElementById('edit-indicator');
    if (editIndicator) {
      if (state.hasUnsavedChanges) {
        editIndicator.textContent = '📝 EDIT MODE *';
        editIndicator.style.background = '#ffc107';
        editIndicator.style.color = '#000';
      } else {
        editIndicator.textContent = '📝 EDIT MODE';
        editIndicator.style.background = '#28a745';
        editIndicator.style.color = '#fff';
      }
    }
  }

  function exitEditMode() {
    // Save any pending changes
    if (state.hasUnsavedChanges) {
      saveLayout();
    }
    
    // Clear auto-save timer
    if (state.autoSaveTimer) {
      clearTimeout(state.autoSaveTimer);
    }
    
    // Exit edit mode
    setEditMode(false);
    
    // Update URL to remove edit parameter
    const url = new URL(window.location);
    url.searchParams.delete('edit');
    window.history.replaceState({}, '', url);
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

  function validateFile(file) {
    const extension = file.name.split('.').pop().toLowerCase();
    const isValidFormat = CONFIG.supportedFormats.includes(extension);
    const isValidSize = file.size <= CONFIG.maxFileSize;
    
    if (!isValidFormat) {
      throw new Error(`Unsupported format. Please use: ${CONFIG.supportedFormats.join(', ')}`);
    }
    if (!isValidSize) {
      throw new Error(`File too large. Maximum size is ${CONFIG.maxFileSize / 1024 / 1024}MB`);
    }
    
    return true;
  }

  function generateUniqueFilename(originalName) {
    const timestamp = Date.now();
    const random = Math.random().toString(36).slice(2, 8);
    const extension = originalName.split('.').pop();
    return `${timestamp}_${random}.${extension}`;
  }

  async function uploadImage(file) {
    if (!validateFile(file)) return null;
    
    // Check if we should use GitHub Pages uploader
    if (window.GitHubPagesUploader && 
        (window.location.hostname.includes('github.io') || 
         window.location.hostname.includes('pages.dev') ||
         window.location.hostname.includes('simongrey.blue'))) {
      
      log('Using GitHub Pages uploader for:', file.name);
      const uploader = new window.GitHubPagesUploader();
      return await uploader.uploadImage(file);
    }
    
    // For local testing without PHP server, simulate upload
    if (window.location.protocol === 'file:' || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      log('Local testing detected - simulating upload for:', file.name);
      
      // Simulate upload delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const filename = generateUniqueFilename(file.name);
      const objectUrl = URL.createObjectURL(file);
      
      return {
        path: objectUrl, // Use object URL for local testing
        originalName: file.name,
        size: file.size,
        type: file.type,
        isLocal: true
      };
    }
    
    const formData = new FormData();
    const filename = generateUniqueFilename(file.name);
    formData.append('image', file, filename);
    formData.append('targetPath', 'assets/pictures-of/');
    
    try {
      log('Uploading file:', file.name, 'Size:', file.size, 'Type:', file.type);
      
      const response = await fetch(CONFIG.uploadUrl, {
        method: 'POST',
        body: formData
      });
      
      log('Upload response status:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Upload failed response:', errorText);
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const result = await response.json();
      log('Upload result:', result);
      
      if (!result.success) {
        throw new Error(result.error || 'Upload failed');
      }
      
      return {
        path: `assets/pictures-of/${filename}`,
        originalName: file.name,
        size: file.size,
        type: file.type
      };
      
    } catch (error) {
      console.error('Upload error details:', error);
      throw error;
    }
  }

  function createUploadZone() {
    const zone = document.createElement('div');
    zone.className = 'upload-zone';
    zone.innerHTML = `
      <div class="upload-content">
        <div class="upload-icon">📸</div>
        <h3>Drop images here</h3>
        <p>or click to browse</p>
        <input type="file" id="file-input" multiple accept="image/*" style="display: none;">
        <button class="upload-button">Choose Images</button>
      </div>
      <div class="upload-progress" style="display: none;">
        <div class="progress-bar">
          <div class="progress-fill"></div>
        </div>
        <p class="progress-text">Uploading...</p>
      </div>
    `;
    
    return zone;
  }

  function showUploadZone() {
    log('showUploadZone called, editMode:', state.editMode, 'dom.grid:', !!dom.grid);
    
    if (!dom.grid || !state.editMode) {
      log('showUploadZone early return - missing grid or not in edit mode');
      return;
    }
    
    const existingZone = dom.grid.querySelector('.upload-zone');
    if (existingZone) {
      log('Upload zone already exists');
      return;
    }
    
    log('Creating new upload zone');
    const uploadZone = createUploadZone();
    dom.grid.appendChild(uploadZone);
    
    const fileInput = uploadZone.querySelector('#file-input');
    const uploadButton = uploadZone.querySelector('.upload-button');
    
    log('Setting up upload event listeners');
    
    uploadButton.addEventListener('click', () => {
      log('Upload button clicked');
      fileInput.click();
    });
    
    fileInput.addEventListener('change', (event) => {
      log('File input changed:', event.target.files);
      handleFileSelect(event);
    });
    
    // Drag and drop events
    uploadZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      uploadZone.classList.add('drag-over');
    });
    
    uploadZone.addEventListener('dragleave', () => {
      uploadZone.classList.remove('drag-over');
    });
    
    uploadZone.addEventListener('drop', (e) => {
      e.preventDefault();
      uploadZone.classList.remove('drag-over');
      log('Files dropped:', e.dataTransfer.files);
      handleFiles(e.dataTransfer.files);
    });
    
    log('Upload zone setup complete');
  }

  async function handleFileSelect(event) {
    handleFiles(event.target.files);
  }

  async function handleFiles(files) {
    log('handleFiles called with:', files.length, 'files');
    
    const validFiles = Array.from(files).filter(file => {
      try {
        validateFile(file);
        log('Valid file:', file.name, file.type, file.size);
        return true;
      } catch (error) {
        console.error(`Invalid file ${file.name}:`, error.message);
        return false;
      }
    });
    
    log('Valid files count:', validFiles.length);
    
    if (validFiles.length === 0) {
      log('No valid files to upload');
      return;
    }
    
    state.isUploading = true;
    showUploadProgress(validFiles.length);
    
    try {
      log('Starting upload process...');
      const uploadPromises = validFiles.map(file => uploadImage(file));
      const results = await Promise.all(uploadPromises);
      
      log('Upload results:', results);
      
      // Add uploaded images to gallery
      await addImagesToGallery(results.filter(Boolean));
      
      // Hide upload zone
      const uploadZone = dom.grid.querySelector('.upload-zone');
      if (uploadZone) uploadZone.remove();
      
    } catch (error) {
      console.error('Batch upload failed:', error);
      showUploadError(error.message);
    } finally {
      state.isUploading = false;
      hideUploadProgress();
    }
  }

  function showUploadProgress(fileCount) {
    const progress = document.querySelector('.upload-progress');
    if (progress) {
      progress.style.display = 'block';
      progress.querySelector('.progress-text').textContent = `Uploading ${fileCount} file${fileCount > 1 ? 's' : ''}...`;
    }
  }

  function hideUploadProgress() {
    const progress = document.querySelector('.upload-progress');
    if (progress) progress.style.display = 'none';
  }

  function showUploadError(message) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'upload-error';
    errorDiv.innerHTML = `
      <p>❌ Upload failed: ${message}</p>
      <button onclick="this.parentElement.remove()">Dismiss</button>
    `;
    dom.grid.appendChild(errorDiv);
    
    setTimeout(() => errorDiv.remove(), 5000);
  }

  async function addImagesToGallery(uploadedImages) {
    log('addImagesToGallery called with:', uploadedImages.length, 'images');
    
    if (!uploadedImages.length) {
      log('No images to add');
      return;
    }
    
    // For GitHub Pages, add to public gallery so visitors can see them
    if (window.location.hostname.includes('github.io') || 
        window.location.hostname.includes('pages.dev') ||
        window.location.hostname.includes('simongrey.blue')) {
      
      log('GitHub Pages detected - adding to public gallery');
      
      uploadedImages.forEach((image, index) => {
        log(`Processing image ${index + 1}:`, image);
        
        const post = createMediaPost({
          path: image.path,
          type: 'image',
          caption: image.originalName.replace(/\.[^/.]+$/, ''),
          isLocal: image.isLocal,
          isBase64: image.isBase64
        });
        
        log('Created media post:', post);
        
        if (post && dom.grid) {
          log('Adding post to grid...');
          
          // Insert at the beginning before text placeholders
          const firstPlaceholder = dom.grid.querySelector('.moodboard-post.text-placeholder');
          if (firstPlaceholder) {
            log('Inserting before first text placeholder');
            dom.grid.insertBefore(post, firstPlaceholder);
          } else {
            log('Appending to end of grid');
            dom.grid.appendChild(post);
          }
          
          // Set initial position at the top of grid
          const gridWidth = dom.grid.clientWidth || 1000;
          const columns = 10; // Fixed column count
          const unitWidth = gridWidth / columns;
          const unitHeight = 165; // Fixed height
          
          // Find first available position by checking existing posts
          const existingPosts = Array.from(dom.grid.querySelectorAll('.moodboard-post:not(.text-placeholder)'));
          const occupiedPositions = new Set();
          
          existingPosts.forEach(existingPost => {
            const x = parseFloat(existingPost.getAttribute('data-x')) || 0;
            const y = parseFloat(existingPost.getAttribute('data-y')) || 0;
            const col = Math.round(x / unitWidth);
            const row = Math.round(y / unitHeight);
            occupiedPositions.add(`${row},${col}`);
          });
          
          // Find first unoccupied position
          let targetRow = 0;
          let targetCol = 0;
          let found = false;
          
          for (let row = 0; row < 20 && !found; row++) {
            for (let col = 0; col < columns && !found; col++) {
              if (!occupiedPositions.has(`${row},${col}`)) {
                targetRow = row;
                targetCol = col;
                found = true;
              }
            }
          }
          
          const x = targetCol * unitWidth;
          const y = 10 + (targetRow * unitHeight); // 10px start offset
          
          log('Positioning image at:', { x, y, row: targetRow, col: targetCol });
          
          // Apply position and size
          post.style.transform = `translate(${x}px, ${y}px)`;
          post.style.width = `${unitWidth}px`;
          post.style.height = `${unitHeight}px`;
          post.style.position = 'absolute';
          post.style.display = 'block';
          post.style.visibility = 'visible';
          post.style.opacity = '1';
          post.style.zIndex = '1';
          
          // Set attributes for layout system
          post.setAttribute('data-x', String(x));
          post.setAttribute('data-y', String(y));
          post.setAttribute('data-w-units', '1');
          post.setAttribute('data-h-units', '1');
          
          // Trigger lazy loading for the new image
          if (typeof window.activateLazyLoad === 'function') {
            window.activateLazyLoad(post);
          }
          
          log('Image added successfully at visible position:', { x, y });
        } else {
          console.error('Failed to create post or find grid');
        }
      });
      
      // Add to public gallery so visitors can see them
      if (window.PublicGalleryManager) {
        const publicManager = new window.PublicGalleryManager();
        uploadedImages.forEach(image => {
          publicManager.addAdminChange({
            ...image,
            id: image.path || image.id
          });
        });
        
        log('Added', uploadedImages.length, 'images to public gallery');
      }
      
      return;
    }
    
    // For local testing, just add images directly without updating gallery.json
    if (window.location.protocol === 'file:' || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      log('Local testing - adding images directly to gallery');
      
      uploadedImages.forEach((image, index) => {
        log(`Processing image ${index + 1}:`, image);
        
        const post = createMediaPost({
          path: image.path,
          type: 'image',
          caption: image.originalName.replace(/\.[^/.]+$/, ''),
          isLocal: image.isLocal
        });
        
        log('Created media post:', post);
        
        if (post && dom.grid) {
          log('Adding post to grid...');
          
          // Find the right place to insert (before text placeholders)
          const anchor = dom.grid.querySelector('.moodboard-post.text-placeholder');
          if (anchor) {
            log('Inserting before first text placeholder');
            dom.grid.insertBefore(post, anchor);
          } else {
            log('Appending to end of grid');
            dom.grid.appendChild(post);
          }
          
          // Apply layout to make it visible
          log('Applying layout...');
          applyLayout();
          
          // Trigger lazy loading for the new image
          if (typeof window.activateLazyLoad === 'function') {
            window.activateLazyLoad(post);
          }
          
          log('Image added successfully');
        } else {
          console.error('Failed to create post or find grid');
        }
      });
      
      return;
    }
    
    try {
      // Get current gallery data
      const response = await fetch(CONFIG.manifestUrl, { cache: 'no-store' });
      const gallery = await response.json();
      
      // Add new images
      uploadedImages.forEach(image => {
        gallery.items.push({
          path: image.path,
          type: 'image',
          caption: image.originalName.replace(/\.[^/.]+$/, '') // Remove extension
        });
      });
      
      // Update gallery.json (this would need a server endpoint)
      await updateGalleryJson(gallery);
      
      // Reload gallery
      await loadMoodboardGallery();
      
    } catch (error) {
      console.error('Failed to add images to gallery:', error);
    }
  }

  async function updateGalleryJson(galleryData) {
    // This would need a server endpoint to update the JSON file
    // For now, we'll just reload the existing gallery
    log('Gallery data updated:', galleryData);
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
    log('setEditMode called with:', active);
    state.editMode = Boolean(active);
    if (!dom.grid) {
      log('No grid element found');
      return;
    }

    log('Setting edit mode to:', state.editMode);
    dom.grid.classList.add('edit-freeform');
    dom.grid.classList.toggle('edit-mode', state.editMode);

    // Show/hide edit indicator
    const editIndicator = document.getElementById('edit-indicator');
    if (editIndicator) {
      editIndicator.style.display = state.editMode ? 'block' : 'none';
      log('Edit indicator updated');
    }

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
        headerDescription.addEventListener('input', triggerAutoSave);
        headerDescription.dataset.autosaveBound = 'true';
      }

      const savedHeader = getStoredHeaderText();
      if (savedHeader) headerDescription.textContent = savedHeader;
    }

    if (state.editMode) {
      log('Entering edit mode - showing upload zone');
      showUploadZone();
      initInteract();
    } else {
      log('Exiting edit mode - hiding upload zone');
      // Hide upload zone when exiting edit mode
      const uploadZone = dom.grid.querySelector('.upload-zone');
      if (uploadZone) uploadZone.remove();
      
      if (typeof interact !== 'undefined') {
        interact(SELECTORS.moodboardPost).unset();
        state.interactInitialized = false;
      }
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
            triggerAutoSave();
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
            triggerAutoSave();
          }
        }
      });
  }

  function createMediaPost(item) {
    log('createMediaPost called with:', item);
    
    const post = document.createElement('div');
    post.className = 'moodboard-post photo-only auto-generated lazy';

    const path = typeof item.path === 'string' ? item.path.trim() : '';
    if (!path) {
      console.error('No path provided for media post');
      return null;
    }

    post.setAttribute('data-id', path);
    log('Created post element with ID:', path);

    const isVideo = item.type === 'video';
    const media = document.createElement(isVideo ? 'video' : 'img');
    
    // Handle different image sources
    if (item.isBase64 && path.startsWith('data:')) {
      // GitHub Pages base64 image
      media.src = path;
      media.classList.add('loaded');
      log('Set base64 image for GitHub Pages');
    } else if (item.isLocal && path.startsWith('blob:')) {
      // Local testing with object URL
      media.src = path;
      media.classList.add('loaded');
      log('Set local blob URL for image:', path);
    } else {
      // Regular lazy loading for server images
      media.dataset.src = path;
      media.classList.add('lazy');
      log('Set lazy loading for image:', path);
    }

    if (isVideo) {
      media.autoplay = true;
      media.muted = true;
      media.loop = true;
      media.playsInline = true;
      media.setAttribute('playsinline', '');
    }

    post.appendChild(media);
    log('Added media element to post');

    if (item.caption) {
      const caption = document.createElement('div');
      caption.className = 'caption';
      caption.textContent = item.caption;
      post.appendChild(caption);
      log('Added caption:', item.caption);
    }

    log('Media post created successfully:', post);
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
      let items = [];
      
      // Check if we should use public gallery (GitHub Pages)
      if (window.PublicGalleryManager) {
        const publicManager = new window.PublicGalleryManager();
        const publicGallery = publicManager.getCombinedGallery();
        
        if (publicGallery) {
          items = publicGallery;
          log('Using public gallery with', items.length, 'items');
        }
      }
      
      // If no public gallery, try server gallery
      if (items.length === 0) {
        const response = await fetch(CONFIG.manifestUrl, { 
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
          }
        });
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const payload = await response.json();
        items = Array.isArray(payload && payload.items) ? payload.items : [];
        log('Using server gallery with', items.length, 'items');
      }
      
      if (!items.length) {
        console.warn('No items found in gallery manifest');
        return;
      }

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
      
      log(`Successfully loaded ${items.length} gallery items`);
      
    } catch (error) {
      console.error('Failed to load moodboard gallery manifest:', error);
      
      // Show user-friendly error message
      if (dom.grid) {
        const errorMsg = document.createElement('div');
        errorMsg.style.cssText = 'grid-column: 1/-1; padding: 40px; text-align: center; color: var(--accent); background: rgba(0,0,0,0.05); border-radius: 8px; margin: 20px;';
        errorMsg.innerHTML = `
          <h3>Gallery Loading Issue</h3>
          <p>Unable to load the gallery images. This might be a temporary issue.</p>
          <p style="font-size: 0.9em; opacity: 0.8;">Error: ${error.message}</p>
          <button onclick="location.reload()" style="margin-top: 10px; padding: 8px 16px; background: var(--accent); color: white; border: none; border-radius: 4px; cursor: pointer;">Retry</button>
        `;
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

    // Add publish button functionality
    const publishButton = document.getElementById('publish-changes');
    if (publishButton) {
      publishButton.addEventListener('click', () => {
        handlePublishChanges();
      });
    }

    if (dom.grid) {
      dom.grid.addEventListener('input', (event) => {
        const target = event.target;
        if (!target) return;

        if (target.classList.contains('text-only-content') ||
          target.classList.contains('placeholder-body') ||
          target.classList.contains('caption')) {
          triggerAutoSave();
        }
      });
    }

    window.addEventListener('resize', debounce(() => {
      applyLayout();
    }, CONFIG.resizeDebounceMs));

    // Add keyboard shortcut for exiting edit mode (Escape key)
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && state.editMode) {
        exitEditMode();
      }
    });

    // Add beforeunload event to warn about unsaved changes
    window.addEventListener('beforeunload', (event) => {
      if (state.editMode && state.hasUnsavedChanges) {
        event.preventDefault();
        event.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
        return event.returnValue;
      }
    });
  }

  function handlePublishChanges() {
    if (!window.PublicGalleryManager) {
      log('Public gallery manager not available');
      return;
    }

    const publicManager = new window.PublicGalleryManager();
    const wasPublished = publicManager.publishChanges();
    
    if (wasPublished) {
      // Show success message
      showNotification('🌐 Changes published! Visitors can now see your updates.', 'success');
      
      // Update the gallery to show published changes
      setTimeout(() => {
        loadMoodboardGallery();
      }, 1000);
      
      log('Changes published successfully');
    } else {
      // Show info message
      showNotification('ℹ️ No changes to publish', 'info');
      log('No changes to publish');
    }
  }

  function showNotification(message, type) {
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 16px 20px;
      background: ${type === 'success' ? '#28a745' : type === 'info' ? '#17a2b8' : '#dc3545'};
      color: white;
      border-radius: 8px;
      font-weight: 600;
      z-index: 10001;
      animation: slideIn 0.3s ease;
      max-width: 300px;
    `;
    notification.textContent = message;
    document.body.appendChild(notification);
    
    setTimeout(() => {
      notification.style.animation = 'slideOut 0.3s ease';
      setTimeout(() => notification.remove(), 300);
    }, 3000);
  }

  function init() {
    log('Moodboard app initializing...');
    
    // Check authentication before proceeding
    if (window.moodboardAuth && !window.moodboardAuth.requireAuth()) {
      log('Authentication required - waiting for login');
      return;
    }
    
    state.moodboardGalleryReady = loadMoodboardGallery().catch((error) => {
      console.warn('Moodboard gallery initialization failed', error);
    });

    state.moodboardGalleryReady.finally(() => {
      log('Gallery loaded, setting up edit mode...');
      hydrateMoodboardPosts();
      const params = new URLSearchParams(window.location.search);
      const isEditing = params.has('edit');
      log('Edit mode parameter found:', isEditing);
      
      // Only set edit mode if authenticated
      if (!window.moodboardAuth || window.moodboardAuth.isAdmin) {
        setEditMode(isEditing);
      } else {
        log('Not authenticated - edit mode disabled');
      }
    });

    bindStaticEvents();
    log('Moodboard app initialization complete');
  }

  document.addEventListener('DOMContentLoaded', init);
})();
