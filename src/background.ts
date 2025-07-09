interface NetworkRequest {
  requestId: string;
  url: string;
  method: string;
}

interface NetworkResponse {
  requestId: string;
  response: {
      url: string;
      status: number;
      headers: { [key: string]: string };
  };
}

interface SessionData {
  accessToken?: string;
  [key: string]: any;
}

class TokenCapture {
  private activeTabId: number | null = null;
  private capturedRequests: Map<string, NetworkRequest> = new Map();

  constructor() {
      this.setupMessageListener();
  }

  private setupMessageListener(): void {
      chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
          if (request.action === 'getToken') {
              this.handleGetToken(request.tabId)
                  .then(token => sendResponse({ token }))
                  .catch(() => sendResponse({ token: null }));
              return true; // Keep message channel open for async response
          }
      });
  }

  private async handleGetToken(tabId: number): Promise<string | null> {
      try {
          this.activeTabId = tabId;
          await this.attachDebugger(tabId);
            
          const token = await this.captureSessionToken(tabId);
            
          await this.detachDebugger(tabId);
          return token;
      } catch (error) {
          console.error('Error getting token:', error);
          await this.detachDebugger(tabId);
          return null;
      }
  }

  private async attachDebugger(tabId: number): Promise<void> {
      return new Promise((resolve, reject) => {
          chrome.debugger.attach({ tabId }, '1.3', () => {
              if (chrome.runtime.lastError) {
                  reject(new Error(chrome.runtime.lastError.message));
              } else {
                  resolve();
              }
          });
      });
  }

  private async detachDebugger(tabId: number): Promise<void> {
      return new Promise((resolve) => {
          chrome.debugger.detach({ tabId }, () => {
              resolve();
          });
      });
  }

  private async captureSessionToken(tabId: number): Promise<string | null> {
      return new Promise((resolve) => {
          const timeout = setTimeout(() => {
              resolve(null);
          }, 10000); // 10 second timeout

          const onEvent = (source: any, method: string, params: any) => {
              if (source.tabId !== tabId) return;

              if (method === 'Network.responseReceived') {
                  const networkResponse = params as NetworkResponse;
                  if (networkResponse.response.url.includes('session')) {
                      this.getResponseBody(tabId, networkResponse.requestId)
                          .then(body => {
                              const token = this.extractTokenFromResponse(body);
                              if (token) {
                                  clearTimeout(timeout);
                                  chrome.debugger.onEvent.removeListener(onEvent);
                                  resolve(token);
                              }
                          });
                  }
              }
          };

          chrome.debugger.onEvent.addListener(onEvent);

          // Enable Network domain
          chrome.debugger.sendCommand({ tabId }, 'Network.enable', {}, () => {
              // Wait for network events
          });
      });
  }

  private async getResponseBody(tabId: number, requestId: string): Promise<string | null> {
      return new Promise((resolve) => {
          chrome.debugger.sendCommand(
              { tabId },
              'Network.getResponseBody',
              { requestId },
              (result?: { body?: string }) => {
                  if (chrome.runtime.lastError || !result) {
                      resolve(null);
                  } else {
                      resolve(result?.body ?? "error");
                  }
              }
          );
      });
  }

  private extractTokenFromResponse(responseBody: string | null): string | null {
      if (!responseBody) return null;

      try {
          const data: SessionData = JSON.parse(responseBody);
          return data.accessToken || null;
      } catch (error) {
          console.error('Error parsing response:', error);
          return null;
      }
  }
}

// Initialize the token capture service
new TokenCapture();
