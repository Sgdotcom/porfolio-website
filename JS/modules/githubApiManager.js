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
      let detail = '';
      try {
        const payload = await response.json();
        detail = payload?.message ? ` - ${payload.message}` : '';
      } catch (_) {
        // Ignore JSON parse failure for non-JSON error bodies
      }
      const error = new Error(`GitHub API error: ${response.status} ${response.statusText}${detail}`);
      error.status = response.status;
      throw error;
    }

    return response.json();
  }

  async getFileSha(path) {
    const ref = encodeURIComponent(this.branch);
    const response = await fetch(`https://api.github.com/repos/${this.owner}/${this.repo}/contents/${path}?ref=${ref}`, {
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
    const putOnce = async () => {
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
    };

    try {
      return await putOnce();
    } catch (error) {
      // Branch head can move between SHA read and PUT; retry once with fresh SHA.
      if (error?.status === 409) {
        return putOnce();
      }
      throw error;
    }
  }

  async uploadImage(path, base64) {
    const message = `CMS publish – ${path}`;
    return this.updateFile(path, base64, message);
  }
}
