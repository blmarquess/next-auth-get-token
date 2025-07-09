interface SessionResponse {
  accessToken?: string;
  [key: string]: any;
}

class TokenExtractor {
  private button: HTMLButtonElement;
  private status: HTMLElement;

  constructor() {
      this.button = document.getElementById('getTokenBtn') as HTMLButtonElement;
      this.status = document.getElementById('status') as HTMLElement;
      this.init();
  }

  private init(): void {
      this.button.addEventListener('click', () => this.getToken());
  }

  private async getToken(): Promise<void> {
      try {
          this.setStatus('Searching for token...', 'info');
          this.button.disabled = true;

          const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            
          if (!tab.id) {
              throw new Error('No active tab found');
          }

          const token = await this.extractTokenFromTab(tab.id);
            
          if (token) {
              await this.copyToClipboard(token);
              this.setStatus('Token copied!', 'success');
          } else {
              this.setStatus('No token found', 'error');
          }
      } catch (error) {
          this.setStatus('Error: ' + (error as Error).message, 'error');
      } finally {
          this.button.disabled = false;
      }
  }

  private async extractTokenFromTab(tabId: number): Promise<string | null> {
      return new Promise((resolve) => {
          chrome.runtime.sendMessage(
              { action: 'getToken', tabId },
              (response) => {
                  if (chrome.runtime.lastError) {
                      resolve(null);
                  } else {
                      resolve(response?.token || null);
                  }
              }
          );
      });
  }

  private async copyToClipboard(text: string): Promise<void> {
      try {
          await navigator.clipboard.writeText(text);
      } catch (error) {
          throw new Error('Failed to copy to clipboard');
      }
  }

  private setStatus(message: string, type: 'info' | 'success' | 'error'): void {
      this.status.textContent = message;
      this.status.className = `status ${type}`;
        
      if (type === 'success') {
          setTimeout(() => {
              this.status.textContent = '';
              this.status.className = 'status';
          }, 2000);
      }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new TokenExtractor();
});
