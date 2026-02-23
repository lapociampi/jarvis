import type { AppController, WindowInfo, UIElement } from './interface.ts';

export class WindowsAppController implements AppController {
  private notImplemented(method: string): never {
    throw new Error(
      `${method} not yet implemented for Windows.\n\n` +
      `TODO: Implement using one of:\n` +
      `  - Windows UI Automation COM API via N-API native bindings\n` +
      `  - PowerShell UIAutomation module\n` +
      `  - win32-api Node.js package\n` +
      `  - AutoHotkey IPC bridge\n\n` +
      `Reference:\n` +
      `  - https://docs.microsoft.com/en-us/windows/win32/winauto/entry-uiauto-win32\n` +
      `  - https://github.com/microsoft/PowerShell/tree/master/src/System.Management.Automation\n` +
      `  - https://www.nuget.org/packages/UIAutomationClient/`
    );
  }

  async getActiveWindow(): Promise<WindowInfo> {
    this.notImplemented('getActiveWindow');
  }

  async getWindowTree(pid: number): Promise<UIElement[]> {
    this.notImplemented('getWindowTree');
  }

  async listWindows(): Promise<WindowInfo[]> {
    this.notImplemented('listWindows');
  }

  async clickElement(element: UIElement): Promise<void> {
    this.notImplemented('clickElement');
  }

  async typeText(text: string): Promise<void> {
    this.notImplemented('typeText');
  }

  async pressKeys(keys: string[]): Promise<void> {
    this.notImplemented('pressKeys');
  }

  async captureScreen(): Promise<Buffer> {
    this.notImplemented('captureScreen');
  }

  async captureWindow(pid: number): Promise<Buffer> {
    this.notImplemented('captureWindow');
  }

  async focusWindow(pid: number): Promise<void> {
    this.notImplemented('focusWindow');
  }
}
