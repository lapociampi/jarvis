export type WindowInfo = {
  pid: number;
  title: string;
  className: string;
  bounds: { x: number; y: number; width: number; height: number };
  focused: boolean;
};

export type UIElement = {
  id: string;
  role: string;
  name: string;
  value: string | null;
  bounds: { x: number; y: number; width: number; height: number };
  children: UIElement[];
  properties: Record<string, unknown>;
};

export interface AppController {
  getActiveWindow(): Promise<WindowInfo>;
  getWindowTree(pid: number): Promise<UIElement[]>;
  listWindows(): Promise<WindowInfo[]>;

  clickElement(element: UIElement): Promise<void>;
  typeText(text: string): Promise<void>;
  pressKeys(keys: string[]): Promise<void>;

  captureScreen(): Promise<Buffer>;
  captureWindow(pid: number): Promise<Buffer>;

  focusWindow(pid: number): Promise<void>;
}

export function getAppController(): AppController {
  const platform = process.platform;

  switch (platform) {
    case 'linux': {
      const { LinuxAppController } = require('./linux.ts');
      return new LinuxAppController();
    }
    case 'win32': {
      const { WindowsAppController } = require('./windows.ts');
      return new WindowsAppController();
    }
    case 'darwin': {
      const { MacAppController } = require('./macos.ts');
      return new MacAppController();
    }
    default:
      throw new Error(`Unsupported platform: ${platform}`);
  }
}
