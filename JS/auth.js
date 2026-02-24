// Secure Authentication System for GitHub Pages
class MoodboardAuth {
  constructor() {
    this.isAdmin = false;
    this.authKey = 'moodboard-admin-auth';
    this.sessionKey = 'moodboard-admin-session';
    const urlParams = new URLSearchParams(window.location.search);
    this.isEditMode = urlParams.get('edit') === '1';
    this.adminPassword = this.generateAdminPassword();
    this.init();
  }

  init() {
    this.checkAuthStatus();
    this.setupAuthUI();
  }

  generateAdminPassword() {
    // Generate a unique password based on browser fingerprint + date
    const fingerprint = navigator.userAgent + navigator.language + screen.width + screen.height;
    const today = new Date().toDateString();
    return btoa(fingerprint + today).slice(0, 12);
  }

  checkAuthStatus() {
    const session = localStorage.getItem(this.sessionKey);
    if (session) {
      const sessionData = JSON.parse(session);
      const now = Date.now();
      
      // Session expires after 24 hours
      if (now - sessionData.timestamp < 24 * 60 * 60 * 1000) {
        this.isAdmin = true;
        this.showAdminUI();
        return;
      } else {
        // Session expired
        localStorage.removeItem(this.sessionKey);
      }
    }
    
    this.isAdmin = false;
    if (this.isEditMode) {
      this.showLoginUI();
    } else {
      this.hideAuthModal();
    }
  }

  setupAuthUI() {
    // Add auth modal to page
    const authModal = document.createElement('div');
    authModal.id = 'auth-modal';
    authModal.innerHTML = `
      <div class="auth-overlay" id="auth-overlay">
        <div class="auth-card">
          <h2>🔐 Admin Access Required</h2>
          <p>This page is in edit mode. Please enter your admin password to continue.</p>
          <div class="auth-form">
            <input type="password" id="admin-password" placeholder="Enter admin password" />
            <button id="auth-submit">Access Editor</button>
          </div>
          <div class="auth-hint">
            <small>Hint: Check your browser console for today's password</small>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(authModal);

    // Add styles
    const authStyles = document.createElement('style');
    authStyles.textContent = `
      .auth-overlay {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.8);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
        backdrop-filter: blur(5px);
      }
      
      .auth-card {
        background: white;
        padding: 30px;
        border-radius: 12px;
        box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
        max-width: 400px;
        width: 90%;
        text-align: center;
      }
      
      .auth-card h2 {
        margin: 0 0 16px 0;
        color: #333;
      }
      
      .auth-card p {
        margin: 0 0 24px 0;
        color: #666;
        line-height: 1.5;
      }
      
      .auth-form {
        display: flex;
        flex-direction: column;
        gap: 16px;
        margin-bottom: 20px;
      }
      
      .auth-form input {
        padding: 12px;
        border: 2px solid #e0e0e0;
        border-radius: 8px;
        font-size: 16px;
        transition: border-color 0.3s;
      }
      
      .auth-form input:focus {
        outline: none;
        border-color: #007bff;
      }
      
      .auth-form button {
        padding: 12px 24px;
        background: #007bff;
        color: white;
        border: none;
        border-radius: 8px;
        font-size: 16px;
        font-weight: 600;
        cursor: pointer;
        transition: background 0.3s;
      }
      
      .auth-form button:hover {
        background: #0056b3;
      }
      
      .auth-hint {
        color: #999;
        font-style: italic;
      }
      
      @media (prefers-color-scheme: dark) {
        .auth-card {
          background: #2d2d2d;
          color: #fff;
        }
        
        .auth-card h2 {
          color: #fff;
        }
        
        .auth-card p {
          color: #ccc;
        }
        
        .auth-form input {
          background: #3d3d3d;
          border-color: #555;
          color: #fff;
        }
      }
    `;
    document.head.appendChild(authStyles);

    // Setup event listeners
    document.getElementById('auth-submit').addEventListener('click', () => this.handleLogin());
    document.getElementById('admin-password').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') this.handleLogin();
    });
  }

  handleLogin() {
    const password = document.getElementById('admin-password').value;
    
    if (password === this.adminPassword) {
      // Successful login
      const sessionData = {
        timestamp: Date.now(),
        password: password
      };
      localStorage.setItem(this.sessionKey, JSON.stringify(sessionData));
      
      this.isAdmin = true;
      this.hideAuthModal();
      this.showAdminUI();
      
      // Show success message
      this.showNotification('✅ Admin access granted', 'success');
    } else {
      // Failed login
      this.showNotification('❌ Incorrect password', 'error');
      document.getElementById('admin-password').value = '';
      document.getElementById('admin-password').focus();
    }
  }

  logout() {
    localStorage.removeItem(this.sessionKey);
    this.isAdmin = false;
    location.reload(); // Reload to show login screen
  }

  hideAuthModal() {
    const modal = document.getElementById('auth-modal');
    if (modal) modal.style.display = 'none';
  }

  showLoginUI() {
    const modal = document.getElementById('auth-modal');
    if (!this.isEditMode) {
      this.hideAuthModal();
      return;
    }

    if (modal) modal.style.display = 'flex';
    
    // Hide edit mode UI
    const editIndicator = document.getElementById('edit-indicator');
    if (editIndicator) editIndicator.style.display = 'none';
    
    const editControls = document.querySelector('.edit-controls-footer');
    if (editControls) editControls.style.display = 'none';
  }

  showAdminUI() {
    this.hideAuthModal();
    
    // Show edit mode UI
    const editIndicator = document.getElementById('edit-indicator');
    if (editIndicator) editIndicator.style.display = 'block';
    
    const editControls = document.querySelector('.edit-controls-footer');
    if (editControls) editControls.style.display = 'inline-block';
    
    // Add logout button
    this.addLogoutButton();
    
    // Show today's password in console for admin
    console.log('%c🔐 MOODBOARD ADMIN ACCESS', 'color: #007bff; font-size: 16px; font-weight: bold;');
    console.log('%cToday\'s admin password:', 'color: #333; font-size: 14px;');
    console.log(`%c${this.adminPassword}`, 'color: #28a745; font-size: 18px; font-family: monospace; padding: 4px 8px; background: #f8f9fa; border: 1px solid #dee2e6; border-radius: 4px;');
    console.log('%cThis password changes daily and is unique to your browser/device.', 'color: #666; font-style: italic;');
  }

  addLogoutButton() {
    // Remove existing logout button if any
    const existing = document.getElementById('admin-logout');
    if (existing) existing.remove();
    
    // Add logout button to header
    const header = document.querySelector('.top-bar .right');
    if (header) {
      const logoutBtn = document.createElement('button');
      logoutBtn.id = 'admin-logout';
      logoutBtn.innerHTML = '🚪 Logout';
      logoutBtn.style.cssText = `
        margin-left: 12px;
        padding: 4px 12px;
        background: #dc3545;
        color: white;
        border: none;
        border-radius: 12px;
        font-size: 12px;
        font-weight: 600;
        cursor: pointer;
        transition: background 0.2s;
      `;
      logoutBtn.addEventListener('click', () => this.logout());
      logoutBtn.addEventListener('mouseenter', () => {
        logoutBtn.style.background = '#c82333';
      });
      logoutBtn.addEventListener('mouseleave', () => {
        logoutBtn.style.background = '#dc3545';
      });
      header.appendChild(logoutBtn);
    }
  }

  showNotification(message, type) {
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 16px 20px;
      background: ${type === 'success' ? '#28a745' : '#dc3545'};
      color: white;
      border-radius: 8px;
      font-weight: 600;
      z-index: 10001;
      animation: slideIn 0.3s ease;
    `;
    notification.textContent = message;
    document.body.appendChild(notification);
    
    setTimeout(() => {
      notification.style.animation = 'slideOut 0.3s ease';
      setTimeout(() => notification.remove(), 300);
    }, 3000);
  }

  requireAuth() {
    const urlParams = new URLSearchParams(window.location.search);
    const isEditMode = urlParams.get('edit') === '1';
    
    if (isEditMode && !this.isAdmin) {
      this.showLoginUI();
      return false;
    }
    
    return true;
  }
}

// Add animations
const animationStyles = document.createElement('style');
animationStyles.textContent = `
  @keyframes slideIn {
    from { transform: translateX(100%); opacity: 0; }
    to { transform: translateX(0); opacity: 1; }
  }
  
  @keyframes slideOut {
    from { transform: translateX(0); opacity: 1; }
    to { transform: translateX(100%); opacity: 0; }
  }
`;
document.head.appendChild(animationStyles);

// Initialize auth system
window.moodboardAuth = new MoodboardAuth();
