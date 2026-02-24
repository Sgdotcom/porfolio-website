// GitHub Pages Upload Handler (JavaScript-only solution)
// This simulates file uploads for static hosting

class GitHubPagesUploader {
  constructor() {
    this.isGitHubPages = window.location.hostname.includes('github.io') || 
                        window.location.hostname.includes('pages.dev');
  }

  async uploadImage(file) {
    if (!this.isGitHubPages) {
      return this.handleServerUpload(file);
    }

    // For GitHub Pages, convert to base64 and store in localStorage
    return this.handleLocalUpload(file);
  }

  async handleLocalUpload(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        const base64Data = e.target.result;
        const filename = this.generateUniqueFilename(file.name);
        
        // Store in localStorage
        const storedImages = JSON.parse(localStorage.getItem('uploaded-images') || '[]');
        const imageData = {
          id: filename,
          name: file.name,
          data: base64Data,
          type: file.type,
          size: file.size,
          uploaded: new Date().toISOString()
        };
        
        storedImages.push(imageData);
        localStorage.setItem('uploaded-images', JSON.stringify(storedImages));
        
        resolve({
          path: base64Data,
          originalName: file.name,
          size: file.size,
          type: file.type,
          isLocal: true,
          isBase64: true
        });
      };
      
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });
  }

  generateUniqueFilename(originalName) {
    const timestamp = Date.now();
    const random = Math.random().toString(36).slice(2, 8);
    const extension = originalName.split('.').pop();
    return `${timestamp}_${random}.${extension}`;
  }

  getStoredImages() {
    return JSON.parse(localStorage.getItem('uploaded-images') || '[]');
  }

  deleteImage(imageId) {
    const storedImages = this.getStoredImages();
    const filtered = storedImages.filter(img => img.id !== imageId);
    localStorage.setItem('uploaded-images', JSON.stringify(filtered));
  }
}

// Export for use in main app
window.GitHubPagesUploader = GitHubPagesUploader;
