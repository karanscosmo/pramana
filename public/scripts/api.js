export const API = {
  getToken() {
    return sessionStorage.getItem('pramana_token');
  },

  logout() {
    sessionStorage.removeItem('pramana_token');
    sessionStorage.removeItem('pramana_user');
    localStorage.removeItem('pramana_token');
    localStorage.removeItem('pramana_user');
    window.location.href = '/login.html';
  },

  getAuthHeaders() {
    const token = this.getToken();
    return token ? { 'Authorization': `Bearer ${token}` } : {};
  },

  async runScenario(scenarioId) {
    const res = await fetch('/api/demo/run', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...this.getAuthHeaders()
      },
      body: JSON.stringify({ scenarioId }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to trigger scenario');
    }
    return res.json();
  },

  async createSession() {
    let res = await fetch('/api/session', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...this.getAuthHeaders()
      },
    });

    // If session creation failed with stored token (e.g. stale user on newly rotated serverless container), retry cleanly
    if (!res.ok && this.getToken()) {
      console.warn("[Pramana API] Session creation failed with token, retrying clean anonymous session...");
      res = await fetch('/api/session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
    }

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || err.message || 'Failed to create session');
    }
    return res.json();
  },

  async uploadDocument(sessionId, docType, file) {
    const formData = new FormData();
    formData.append('docType', docType);
    formData.append('document', file);

    const res = await fetch(`/api/session/${sessionId}/document`, {
      method: 'POST',
      headers: {
        ...this.getAuthHeaders()
      },
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to upload document');
    }
    return res.json();
  },

  async verifyBundle(sessionId, filesMap, isDemo = false) {
    const formData = new FormData();
    for (const [docType, file] of Object.entries(filesMap)) {
      if (file) {
        formData.append(docType, file);
      }
    }
    if (isDemo) {
      formData.append('isDemo', 'true');
    }
    const query = isDemo ? '?demo=true' : '';

    const res = await fetch(`/api/session/${sessionId}/verify-bundle${query}`, {
      method: 'POST',
      headers: {
        ...this.getAuthHeaders()
      },
      body: formData,
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || err.message || 'Failed to verify document bundle');
    }
    return res.json();
  },

  async getReport(sessionId) {
    const res = await fetch(`/api/session/${sessionId}/report`, {
      headers: {
        ...this.getAuthHeaders()
      }
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to fetch report');
    }
    return res.json();
  },

  async askAgent(sessionId, question, report = null) {
    let reportPayload = report;
    if (!reportPayload && typeof window !== 'undefined') {
      reportPayload = window.lastVerificationReport || (function() {
        try { return JSON.parse(sessionStorage.getItem("pramana_last_report") || "null"); } catch(e) { return null; }
      })();
    }

    const res = await fetch(`/api/session/${sessionId}/ask`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...this.getAuthHeaders()
      },
      body: JSON.stringify({ question, report: reportPayload }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to query Bodh');
    }
    return res.json();
  },

  async getNarrative(sessionId) {
    const res = await fetch(`/api/session/${sessionId}/narrative`, {
      headers: {
        ...this.getAuthHeaders()
      }
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to fetch underwriter narrative');
    }
    return res.json();
  }
};
