export const API = {
  getAuthHeaders() {
    const token = localStorage.getItem('pramana_token');
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
    const res = await fetch('/api/session', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...this.getAuthHeaders()
      },
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to create session');
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

  async askAgent(sessionId, question) {
    const res = await fetch(`/api/session/${sessionId}/ask`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...this.getAuthHeaders()
      },
      body: JSON.stringify({ question }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to query RAG agent');
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
