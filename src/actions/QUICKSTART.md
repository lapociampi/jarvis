# Action Layer Quick Start

Get started with J.A.R.V.I.S. Action Layer in 5 minutes.

## Installation

No npm packages needed! Just install system dependencies on Linux:

```bash
# Ubuntu/Debian
sudo apt install xdotool x11-utils wmctrl imagemagick scrot

# Test installation
bun run src/actions/test.ts
```

## Basic Usage

### 1. Control Applications

```typescript
import { getAppController } from '@/actions';

const controller = getAppController();

// Get active window info
const window = await controller.getActiveWindow();
console.log(window.title, window.pid);

// Take a screenshot
const screenshot = await controller.captureScreen();
await Bun.write('screenshot.png', screenshot);

// Automate input
await controller.typeText("Hello World");
await controller.pressKeys(['ctrl', 'c']);
```

### 2. Control Browser

```typescript
import { BrowserSession } from '@/actions';

// Start Chrome with: google-chrome --remote-debugging-port=9222

const session = new BrowserSession();
await session.ensureConnected();

const browser = session.getBrowser();
const tabs = await browser.listTabs();

// Navigate
await browser.navigate(tabs[0].id, 'https://google.com');

// Run JavaScript
const title = await browser.evaluate(tabs[0].id, 'document.title');

// Screenshot
const screenshot = await browser.screenshot(tabs[0].id);
```

### 3. Execute Terminal Commands

```typescript
import { TerminalExecutor } from '@/actions';

const executor = new TerminalExecutor();

// Simple command
const result = await executor.execute('ls -la');
console.log(result.stdout);

// With options
const result2 = await executor.execute('npm test', {
  cwd: '/path/to/project',
  env: { NODE_ENV: 'test' },
  timeout: 60000,
});

// Stream output
for await (const chunk of executor.stream('npm install')) {
  process.stdout.write(chunk);
}
```

### 4. WSL Integration

```typescript
import { WSLBridge } from '@/actions';

if (WSLBridge.isWSL()) {
  const bridge = new WSLBridge();

  // Run Windows commands from Linux
  const result = await bridge.runWindowsCommand('dir C:\\');

  // Run PowerShell
  const ps = await bridge.runPowerShell('Get-Process chrome');

  // Path conversion
  const winPath = await bridge.convertToWindowsPath('/home/user/file.txt');
  // Returns: C:\Users\user\file.txt (or similar)
}
```

### 5. Tool Registry

```typescript
import { ToolRegistry, type ToolDefinition } from '@/actions';

const registry = new ToolRegistry();

// Define a tool
const searchTool: ToolDefinition = {
  name: 'search',
  description: 'Search for text',
  category: 'utility',
  parameters: {
    query: { type: 'string', description: 'Search query', required: true },
  },
  execute: async (params) => {
    // Implementation
    return `Searching for: ${params.query}`;
  },
};

// Register and execute
registry.register(searchTool);
const result = await registry.execute('search', { query: 'hello' });
```

## Examples

Run the comprehensive demo:

```bash
bun run src/actions/example.ts
```

Run the test suite:

```bash
bun run src/actions/test.ts
```

## Common Patterns

### Pattern 1: Smart Window Capture

```typescript
import { getAppController } from '@/actions';

async function captureActiveApp(outputPath: string) {
  const controller = getAppController();
  const window = await controller.getActiveWindow();

  console.log(`Capturing: ${window.title}`);

  const screenshot = await controller.captureWindow(window.pid);
  await Bun.write(outputPath, screenshot);

  return { title: window.title, path: outputPath };
}

const result = await captureActiveApp('current-app.png');
```

### Pattern 2: Browser Automation Task

```typescript
import { BrowserSession } from '@/actions';

async function fetchPageData(url: string) {
  const session = new BrowserSession();
  await session.ensureConnected();

  const browser = session.getBrowser();
  const tabs = await browser.listTabs();
  const tabId = tabs[0]?.id;

  if (!tabId) throw new Error('No tabs available');

  await browser.navigate(tabId, url);

  const data = await browser.evaluate(tabId, `
    ({
      title: document.title,
      links: Array.from(document.querySelectorAll('a')).length,
      images: Array.from(document.querySelectorAll('img')).length
    })
  `);

  await session.disconnect();
  return data;
}

const data = await fetchPageData('https://example.com');
```

### Pattern 3: Command Pipeline

```typescript
import { TerminalExecutor } from '@/actions';

async function buildProject(projectPath: string) {
  const executor = new TerminalExecutor({ timeout: 300000 });

  // Install dependencies
  console.log('Installing dependencies...');
  await executor.execute('bun install', { cwd: projectPath });

  // Run tests
  console.log('Running tests...');
  const testResult = await executor.execute('bun test', { cwd: projectPath });

  if (testResult.exitCode !== 0) {
    throw new Error('Tests failed');
  }

  // Build
  console.log('Building...');
  await executor.execute('bun run build', { cwd: projectPath });

  return 'Build successful';
}
```

### Pattern 4: Cross-Platform File Operations

```typescript
import { WSLBridge, TerminalExecutor } from '@/actions';

async function copyToDesktop(sourcePath: string, fileName: string) {
  if (WSLBridge.isWSL()) {
    const bridge = new WSLBridge();
    const winPath = await bridge.convertToWindowsPath(sourcePath);

    await bridge.runPowerShell(
      `Copy-Item "${winPath}" "$HOME\\Desktop\\${fileName}"`
    );
  } else {
    const executor = new TerminalExecutor();
    await executor.execute(`cp "${sourcePath}" ~/Desktop/${fileName}`);
  }
}
```

### Pattern 5: Dynamic Tool System

```typescript
import { ToolRegistry, TerminalExecutor, type ToolDefinition } from '@/actions';

function createSystemTools(): ToolRegistry {
  const registry = new ToolRegistry();
  const executor = new TerminalExecutor();

  const tools: ToolDefinition[] = [
    {
      name: 'run_command',
      description: 'Execute a shell command',
      category: 'system',
      parameters: {
        command: { type: 'string', description: 'Command to execute', required: true },
      },
      execute: async (params) => {
        const result = await executor.execute(params.command as string);
        return { stdout: result.stdout, exitCode: result.exitCode };
      },
    },
    {
      name: 'read_file',
      description: 'Read a file',
      category: 'filesystem',
      parameters: {
        path: { type: 'string', description: 'File path', required: true },
      },
      execute: async (params) => {
        const file = Bun.file(params.path as string);
        return await file.text();
      },
    },
  ];

  tools.forEach(tool => registry.register(tool));
  return registry;
}

const tools = createSystemTools();
const content = await tools.execute('read_file', { path: 'README.md' });
```

## Troubleshooting

### App Control Issues

**Error: "xdotool not found"**
```bash
sudo apt install xdotool
```

**Error: "No screenshot tool found"**
```bash
sudo apt install imagemagick scrot
```

### Browser Control Issues

**Error: "Failed to connect to Chrome DevTools"**
```bash
# Start Chrome with remote debugging
google-chrome --remote-debugging-port=9222 &

# Or use Chromium headless
chromium --headless --remote-debugging-port=9222 &
```

### WSL Issues

**Error: "Not running in WSL environment"**
- Only works inside Windows Subsystem for Linux
- Check: `cat /proc/version | grep -i microsoft`

## Next Steps

1. Read the full [README.md](./README.md) for detailed documentation
2. Explore [example.ts](./example.ts) for comprehensive demos
3. Run [test.ts](./test.ts) to verify your setup
4. Check platform support matrix in README.md

## API Reference

### App Control
- `getAppController(): AppController`
- `getActiveWindow(): Promise<WindowInfo>`
- `listWindows(): Promise<WindowInfo[]>`
- `typeText(text): Promise<void>`
- `pressKeys(keys[]): Promise<void>`
- `captureScreen(): Promise<Buffer>`
- `captureWindow(pid): Promise<Buffer>`

### Browser
- `new BrowserSession(port?)`
- `ensureConnected(): Promise<void>`
- `getBrowser(): CDPBrowser`
- `listTabs(): Promise<BrowserTab[]>`
- `navigate(tabId, url): Promise<void>`
- `evaluate(tabId, js): Promise<unknown>`
- `screenshot(tabId): Promise<Buffer>`

### Terminal
- `new TerminalExecutor(opts?)`
- `execute(cmd, opts?): Promise<CommandResult>`
- `stream(cmd, opts?): AsyncIterable<string>`

### WSL Bridge
- `WSLBridge.isWSL(): boolean`
- `runWindowsCommand(cmd): Promise<CommandResult>`
- `runPowerShell(script): Promise<CommandResult>`
- `convertToWindowsPath(wsl): Promise<string>`
- `convertToWSLPath(win): Promise<string>`

### Tool Registry
- `register(tool): void`
- `execute(name, params): Promise<unknown>`
- `list(category?): ToolDefinition[]`
- `has(name): boolean`
- `getCategories(): string[]`
