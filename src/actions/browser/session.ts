import { CDPBrowser } from './cdp.ts';

export class BrowserSession {
  private browser: CDPBrowser;
  private connected: boolean = false;
  private port: number;

  constructor(port: number = 9222) {
    this.browser = new CDPBrowser();
    this.port = port;
  }

  async ensureConnected(): Promise<void> {
    if (!this.connected) {
      try {
        await this.browser.connect(this.port);
        this.connected = true;
      } catch (error) {
        this.connected = false;
        throw error;
      }
    }
  }

  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch(`http://localhost:${this.port}/json/version`, {
        signal: AbortSignal.timeout(2000),
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  getBrowser(): CDPBrowser {
    if (!this.connected) {
      throw new Error('Browser session not connected. Call ensureConnected() first.');
    }
    return this.browser;
  }

  async disconnect(): Promise<void> {
    if (this.connected) {
      await this.browser.disconnect();
      this.connected = false;
    }
  }

  isConnected(): boolean {
    return this.connected;
  }
}
