export class SSEManager {
  constructor(sessionId, onMessage, onError) {
    this.sessionId = sessionId;
    this.onMessage = onMessage;
    this.onError = onError;
    this.eventSource = null;
    this.connect();
  }

  connect() {
    this.eventSource = new EventSource(`/api/session/${this.sessionId}/stream`);

    this.eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (this.onMessage) this.onMessage(data);
      } catch (err) {
        console.warn('Failed to parse SSE event data:', err);
      }
    };

    this.eventSource.onerror = (err) => {
      if (this.onError) this.onError(err);
    };
  }

  close() {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
  }
}
