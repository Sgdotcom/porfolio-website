export class AuthManager {
  constructor(options = {}) {
    this.editMode = Boolean(options.editMode);
    this.overlay = options.overlay || null;
    this.onAuthenticatedCallback = () => {};
    this.setOnAuthenticated(options.onAuthenticated);
    this.token = null;
    this.loginForm = null;
    this.statusElement = null;
  }

  init() {
    if (!this.editMode) {
      this.onAuthenticatedCallback();
      return;
    }

    if (!this.overlay) {
      this.onAuthenticatedCallback();
      return;
    }

    this.loginForm = this.overlay.querySelector('form');
    this.statusElement = this.overlay.querySelector('[data-login-status]');
    if (!this.token) {
      this.overlay.classList.remove('hidden');
    }

    if (this.loginForm) {
      this.loginForm.addEventListener('submit', (event) => {
        event.preventDefault();
        const password = this.loginForm.querySelector('input[name="cms-password"]')?.value;
        if (!password) return;
        this.authenticate(password);
      });
    }
  }

  async authenticate(token) {
    this.token = token;
    this.overlay?.classList.add('hidden');
    this.onAuthenticatedCallback();
  }

  setOnAuthenticated(callback) {
    if (typeof callback === 'function') {
      this.onAuthenticatedCallback = callback;
    } else {
      this.onAuthenticatedCallback = () => {};
    }
  }

  isAuthenticated() {
    return Boolean(this.token);
  }

  getToken() {
    return this.token;
  }
}
