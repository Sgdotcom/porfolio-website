// Public Gallery System for GitHub Pages
class PublicGalleryManager {
  constructor() {
    this.storageKey = 'moodboard-public-gallery';
    this.isGitHubPages = window.location.hostname.includes('github.io') || 
                        window.location.hostname.includes('pages.dev') ||
                        window.location.hostname.includes('simongrey.blue');
    this.init();
  }

  init() {
    if (this.isGitHubPages) {
      this.setupPublicSync();
    }
  }

  setupPublicSync() {
    // Check if admin has made changes that should be public
    const adminChanges = this.getAdminChanges();
    const publicGallery = this.getPublicGallery();
    
    // Sync admin changes to public gallery
    if (adminChanges.length > 0) {
      console.log('Syncing admin changes to public gallery...');
      
      // Add new admin images to public gallery
      adminChanges.forEach(change => {
        if (!publicGallery.find(item => item.id === change.id)) {
          publicGallery.push(change);
        }
      });
      
      this.savePublicGallery(publicGallery);
      this.clearAdminChanges();
      
      console.log('Public gallery updated with', publicGallery.length, 'items');
    }
  }

  // Admin methods - store changes that should become public
  addAdminChange(imageData) {
    const changes = this.getAdminChanges();
    changes.push({
      ...imageData,
      timestamp: Date.now(),
      id: imageData.id || imageData.path
    });
    localStorage.setItem('moodboard-admin-changes', JSON.stringify(changes));
  }

  getAdminChanges() {
    return JSON.parse(localStorage.getItem('moodboard-admin-changes') || '[]');
  }

  clearAdminChanges() {
    localStorage.removeItem('moodboard-admin-changes');
  }

  // Public gallery methods
  savePublicGallery(gallery) {
    localStorage.setItem(this.storageKey, JSON.stringify(gallery));
  }

  getPublicGallery() {
    return JSON.parse(localStorage.getItem(this.storageKey) || '[]');
  }

  // Load public gallery instead of server gallery.json
  loadPublicGallery() {
    if (this.isGitHubPages) {
      const publicGallery = this.getPublicGallery();
      console.log('Loading public gallery with', publicGallery.length, 'items');
      return publicGallery;
    }
    return null;
  }

  // Make admin changes visible to public
  publishChanges() {
    const changes = this.getAdminChanges();
    if (changes.length === 0) {
      console.log('No changes to publish');
      return false;
    }

    const publicGallery = this.getPublicGallery();
    changes.forEach(change => {
      if (!publicGallery.find(item => item.id === change.id)) {
        publicGallery.push(change);
      }
    });

    this.savePublicGallery(publicGallery);
    this.clearAdminChanges();
    
    console.log('Published', changes.length, 'changes to public gallery');
    return true;
  }

  // Get combined gallery (original + admin changes)
  getCombinedGallery() {
    if (!this.isGitHubPages) {
      return null; // Use server gallery for regular hosting
    }

    const originalGallery = this.getPublicGallery();
    const adminChanges = this.getAdminChanges();
    
    // Combine original gallery with admin changes
    const combined = [...originalGallery];
    
    adminChanges.forEach(change => {
      if (!combined.find(item => item.id === change.id)) {
        combined.push(change);
      }
    });

    return combined;
  }
}

// Export for use in main app
window.PublicGalleryManager = PublicGalleryManager;
