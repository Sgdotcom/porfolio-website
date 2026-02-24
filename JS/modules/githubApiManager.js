export class GitHubApiManager {
  constructor(config = {}) {
    this.owner = config.owner || '';
    this.repo = config.repo || '';
    this.branch = config.branch || 'main';
    this.tokenProvider = config.tokenProvider || (() => '');
  }

  _buildHeaders() {
    const headers = {
      'Content-Type': 'application/json',
      Accept: 'application/vnd.github+json'
    };

    const token = this.tokenProvider();
    if (token) {
      headers.Authorization = `token ${token}`;
    }

    return headers;
  }

  async _request(path, options = {}) {
    const response = await fetch(`https://api.github.com/repos/${this.owner}/${this.repo}/contents/${path}`, {
      headers: this._buildHeaders(),
      ...options
    });

    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  async getFileSha(path) {
    const response = await fetch(`https://api.github.com/repos/${this.owner}/${this.repo}/contents/${path}`, {
      headers: this._buildHeaders()
    });
    if (response.status === 404) return null;
    if (!response.ok) {
      throw new Error('Unable to get file sha');
    }
    const json = await response.json();
    return json.sha;
  }

  async updateFile(path, contentBase64, message) {
    const sha = await this.getFileSha(path);
    const body = {
      message,
      content: contentBase64,
      branch: this.branch,
      sha: sha || undefined
    };
    return this._request(path, {
      method: 'PUT',
      body: JSON.stringify(body)
    });
  }

  async uploadImage(path, base64) {
    const message = `CMS publish – ${path}`;
    return this.updateFile(path, base64, message);
  }
}
