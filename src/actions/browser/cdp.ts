export type BrowserTab = {
  id: string;
  title: string;
  url: string;
};

type CDPMessage = {
  id: number;
  method?: string;
  params?: Record<string, unknown>;
  result?: unknown;
  error?: { message: string; code: number };
};

export class CDPBrowser {
  private wsUrl: string | null = null;
  private ws: WebSocket | null = null;
  private messageId = 0;
  private pendingMessages = new Map<number, { resolve: (value: unknown) => void; reject: (error: Error) => void }>();

  async connect(port: number = 9222): Promise<void> {
    try {
      const versionResponse = await fetch(`http://localhost:${port}/json/version`);

      if (!versionResponse.ok) {
        throw new Error(`Failed to connect to Chrome DevTools on port ${port}. Is Chrome running with --remote-debugging-port=${port}?`);
      }

      const versionData = await versionResponse.json() as { webSocketDebuggerUrl: string };
      this.wsUrl = versionData.webSocketDebuggerUrl;

      if (!this.wsUrl) {
        throw new Error('No WebSocket debugger URL found in Chrome DevTools response');
      }

      await this.connectWebSocket();
    } catch (error) {
      throw new Error(
        `Failed to connect to Chrome DevTools Protocol:\n` +
        `  ${error instanceof Error ? error.message : String(error)}\n\n` +
        `Make sure Chrome is running with: --remote-debugging-port=${port}\n` +
        `Example: google-chrome --remote-debugging-port=9222`
      );
    }
  }

  private async connectWebSocket(): Promise<void> {
    if (!this.wsUrl) {
      throw new Error('No WebSocket URL available. Call connect() first.');
    }

    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.wsUrl!);

      this.ws.onopen = () => {
        resolve();
      };

      this.ws.onerror = (event) => {
        reject(new Error(`WebSocket connection failed: ${event}`));
      };

      this.ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data as string) as CDPMessage;

          if (message.id !== undefined) {
            const pending = this.pendingMessages.get(message.id);
            if (pending) {
              this.pendingMessages.delete(message.id);

              if (message.error) {
                pending.reject(new Error(`CDP Error: ${message.error.message}`));
              } else {
                pending.resolve(message.result);
              }
            }
          }
        } catch (error) {
          console.error('Failed to parse CDP message:', error);
        }
      };

      this.ws.onclose = () => {
        this.pendingMessages.forEach(({ reject }) => {
          reject(new Error('WebSocket connection closed'));
        });
        this.pendingMessages.clear();
      };
    });
  }

  private async sendCommand(method: string, params?: Record<string, unknown>): Promise<unknown> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket not connected. Call connect() first.');
    }

    return new Promise((resolve, reject) => {
      const id = ++this.messageId;

      this.pendingMessages.set(id, { resolve, reject });

      const message: CDPMessage = { id, method, params };
      this.ws!.send(JSON.stringify(message));

      setTimeout(() => {
        if (this.pendingMessages.has(id)) {
          this.pendingMessages.delete(id);
          reject(new Error(`CDP command timeout: ${method}`));
        }
      }, 30000);
    });
  }

  async listTabs(): Promise<BrowserTab[]> {
    try {
      const response = await fetch('http://localhost:9222/json/list');

      if (!response.ok) {
        throw new Error('Failed to list tabs');
      }

      const tabs = await response.json() as Array<{
        id: string;
        title: string;
        url: string;
        type: string;
      }>;

      return tabs
        .filter(tab => tab.type === 'page')
        .map(tab => ({
          id: tab.id,
          title: tab.title,
          url: tab.url,
        }));
    } catch (error) {
      throw new Error(`Failed to list browser tabs: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async navigate(tabId: string, url: string): Promise<void> {
    try {
      await this.sendCommand('Page.navigate', { url });
      await this.sendCommand('Page.loadEventFired');
    } catch (error) {
      throw new Error(`Failed to navigate to ${url}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async evaluate(tabId: string, expression: string): Promise<unknown> {
    try {
      const result = await this.sendCommand('Runtime.evaluate', {
        expression,
        returnByValue: true,
        awaitPromise: true,
      }) as { result: { value?: unknown; type: string }; exceptionDetails?: unknown };

      if (result.exceptionDetails) {
        throw new Error(`JavaScript execution failed: ${JSON.stringify(result.exceptionDetails)}`);
      }

      return result.result.value;
    } catch (error) {
      throw new Error(`Failed to evaluate expression: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async screenshot(tabId: string): Promise<Buffer> {
    try {
      const result = await this.sendCommand('Page.captureScreenshot', {
        format: 'png',
      }) as { data: string };

      return Buffer.from(result.data, 'base64');
    } catch (error) {
      throw new Error(`Failed to capture screenshot: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async disconnect(): Promise<void> {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.wsUrl = null;
    this.pendingMessages.clear();
  }
}
