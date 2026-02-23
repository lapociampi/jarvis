#!/usr/bin/env bun

/**
 * J.A.R.V.I.S. Action Layer - Comprehensive Example
 *
 * This example demonstrates integration of all action layer components:
 * - App Control (window management)
 * - Browser Control (CDP)
 * - Terminal Execution
 * - WSL Bridge
 * - Tool Registry
 */

import {
  getAppController,
  TerminalExecutor,
  WSLBridge,
  BrowserSession,
  ToolRegistry,
  type ToolDefinition,
  type WindowInfo,
} from './index.ts';

class ActionLayerDemo {
  private executor = new TerminalExecutor();
  private registry = new ToolRegistry();

  async run() {
    console.log('='.repeat(60));
    console.log('J.A.R.V.I.S. Action Layer - Comprehensive Demo');
    console.log('='.repeat(60));
    console.log();

    await this.demoAppControl();
    await this.demoBrowserControl();
    await this.demoTerminal();
    await this.demoWSLBridge();
    await this.demoToolRegistry();

    console.log();
    console.log('='.repeat(60));
    console.log('Demo Complete!');
    console.log('='.repeat(60));
  }

  private async demoAppControl() {
    console.log('1. APP CONTROL DEMO');
    console.log('-'.repeat(60));

    try {
      const controller = getAppController();

      console.log('→ Getting active window...');
      const activeWindow = await controller.getActiveWindow();
      console.log(`  Title: ${activeWindow.title}`);
      console.log(`  PID: ${activeWindow.pid}`);
      console.log(`  Class: ${activeWindow.className}`);
      console.log(`  Bounds: ${activeWindow.bounds.width}x${activeWindow.bounds.height} at (${activeWindow.bounds.x}, ${activeWindow.bounds.y})`);

      console.log('\n→ Listing all windows...');
      const windows = await controller.listWindows();
      console.log(`  Found ${windows.length} window(s)`);

      if (windows.length > 0) {
        console.log('\n  Top 5 windows:');
        windows.slice(0, 5).forEach((win, idx) => {
          console.log(`    ${idx + 1}. [PID ${win.pid}] ${win.title.slice(0, 50)}${win.title.length > 50 ? '...' : ''}`);
        });
      }

      console.log('\n→ Screenshot capabilities:');
      console.log('  - captureScreen(): Full screen capture');
      console.log('  - captureWindow(pid): Single window capture');
      console.log('  - typeText(text): Simulate keyboard input');
      console.log('  - pressKeys([keys]): Simulate key combinations');

    } catch (error) {
      console.log(`  ⚠ App control not available: ${error instanceof Error ? error.message.split('\n')[0] : String(error)}`);
      console.log('  Install required tools: xdotool, xprop, wmctrl, imagemagick');
    }

    console.log();
  }

  private async demoBrowserControl() {
    console.log('2. BROWSER CONTROL DEMO (Chrome DevTools Protocol)');
    console.log('-'.repeat(60));

    const session = new BrowserSession(9222);

    console.log('→ Checking Chrome DevTools availability...');
    const isAvailable = await session.isAvailable();
    console.log(`  Status: ${isAvailable ? '✓ Available' : '✗ Not available'}`);

    if (isAvailable) {
      try {
        console.log('\n→ Connecting to browser...');
        await session.ensureConnected();
        console.log('  ✓ Connected');

        const browser = session.getBrowser();

        console.log('\n→ Listing browser tabs...');
        const tabs = await browser.listTabs();
        console.log(`  Found ${tabs.length} tab(s)`);

        tabs.forEach((tab, idx) => {
          console.log(`    ${idx + 1}. ${tab.title}`);
          console.log(`       ${tab.url.slice(0, 70)}${tab.url.length > 70 ? '...' : ''}`);
        });

        if (tabs.length > 0) {
          const firstTab = tabs[0]!;
          console.log(`\n→ Demonstrating JavaScript evaluation in first tab...`);
          try {
            const title = await browser.evaluate(firstTab.id, 'document.title');
            console.log(`  Page title via JS: ${title}`);

            const url = await browser.evaluate(firstTab.id, 'window.location.href');
            console.log(`  Current URL: ${url}`);
          } catch (error) {
            console.log(`  ⚠ Could not evaluate JavaScript: ${error instanceof Error ? error.message : String(error)}`);
          }
        }

        console.log('\n→ CDP Capabilities:');
        console.log('  - navigate(tabId, url): Navigate to URL');
        console.log('  - evaluate(tabId, js): Execute JavaScript');
        console.log('  - screenshot(tabId): Capture tab screenshot');
        console.log('  - Full DevTools Protocol support');

        await session.disconnect();

      } catch (error) {
        console.log(`  ⚠ Error: ${error instanceof Error ? error.message.split('\n')[0] : String(error)}`);
      }
    } else {
      console.log('\n  To enable, launch Chrome with:');
      console.log('    google-chrome --remote-debugging-port=9222');
      console.log('  or:');
      console.log('    chromium --headless --remote-debugging-port=9222');
    }

    console.log();
  }

  private async demoTerminal() {
    console.log('3. TERMINAL EXECUTOR DEMO');
    console.log('-'.repeat(60));

    console.log(`→ Detected shell: ${this.executor.getShell()}`);

    console.log('\n→ Executing simple command...');
    try {
      const result = await this.executor.execute('echo "Hello from J.A.R.V.I.S."');
      console.log(`  Output: ${result.stdout.trim()}`);
      console.log(`  Exit code: ${result.exitCode}`);
      console.log(`  Duration: ${result.duration}ms`);
    } catch (error) {
      console.log(`  ✗ Error: ${error instanceof Error ? error.message : String(error)}`);
    }

    console.log('\n→ Executing with environment variables...');
    try {
      const result = await this.executor.execute('echo "VAR=$DEMO_VAR"', {
        env: { DEMO_VAR: 'test_value' },
      });
      console.log(`  Output: ${result.stdout.trim()}`);
    } catch (error) {
      console.log(`  ✗ Error: ${error instanceof Error ? error.message : String(error)}`);
    }

    console.log('\n→ Getting system information...');
    try {
      const uname = await this.executor.execute('uname -a');
      console.log(`  System: ${uname.stdout.trim().slice(0, 80)}...`);

      const uptime = await this.executor.execute('uptime');
      console.log(`  Uptime: ${uptime.stdout.trim()}`);
    } catch (error) {
      console.log(`  ⚠ Could not get system info: ${error instanceof Error ? error.message : String(error)}`);
    }

    console.log('\n→ Streaming output demo (simulated)...');
    console.log('  Stream API allows real-time output consumption:');
    console.log('    for await (const chunk of executor.stream(command)) {');
    console.log('      process.stdout.write(chunk);');
    console.log('    }');

    console.log();
  }

  private async demoWSLBridge() {
    console.log('4. WSL BRIDGE DEMO');
    console.log('-'.repeat(60));

    const isWSL = WSLBridge.isWSL();
    console.log(`→ Running in WSL: ${isWSL}`);

    if (isWSL) {
      const bridge = new WSLBridge();

      console.log('\n→ Environment detection:');
      console.log(`  WSL_DISTRO_NAME: ${process.env.WSL_DISTRO_NAME ?? 'Not set'}`);
      console.log(`  WSL_INTEROP: ${process.env.WSL_INTEROP ?? 'Not set'}`);
      console.log(`  Windows home: ${bridge.getWindowsHome() ?? 'Not detected yet'}`);

      console.log('\n→ Testing Windows command execution...');
      try {
        const result = await bridge.runWindowsCommand('echo %USERNAME%');
        console.log(`  Windows username: ${result.stdout.trim()}`);
      } catch (error) {
        console.log(`  ⚠ Could not run Windows command: ${error instanceof Error ? error.message : String(error)}`);
      }

      console.log('\n→ Testing PowerShell execution...');
      try {
        const result = await bridge.runPowerShell('$PSVersionTable.PSVersion');
        console.log(`  PowerShell version info:`);
        result.stdout.split('\n').forEach(line => {
          if (line.trim()) {
            console.log(`    ${line}`);
          }
        });
      } catch (error) {
        console.log(`  ⚠ Could not run PowerShell: ${error instanceof Error ? error.message : String(error)}`);
      }

      console.log('\n→ WSL Bridge capabilities:');
      console.log('  - runWindowsCommand(cmd): Execute Windows commands');
      console.log('  - runPowerShell(script): Execute PowerShell scripts');
      console.log('  - convertToWindowsPath(wsl): WSL → Windows path');
      console.log('  - convertToWSLPath(win): Windows → WSL path');

    } else {
      console.log('  Not running in WSL environment');
      console.log('  WSL Bridge only works inside Windows Subsystem for Linux');
    }

    console.log();
  }

  private async demoToolRegistry() {
    console.log('5. TOOL REGISTRY DEMO');
    console.log('-'.repeat(60));

    console.log('→ Registering example tools...');

    const tools: ToolDefinition[] = [
      {
        name: 'greet',
        description: 'Greet a user',
        category: 'utility',
        parameters: {
          name: {
            type: 'string',
            description: 'Name to greet',
            required: true,
          },
          formal: {
            type: 'boolean',
            description: 'Use formal greeting',
            required: false,
          },
        },
        execute: async (params) => {
          const name = params.name as string;
          const formal = params.formal as boolean ?? false;
          return formal ? `Good day, ${name}.` : `Hi ${name}!`;
        },
      },
      {
        name: 'calculate',
        description: 'Perform basic calculation',
        category: 'math',
        parameters: {
          expression: {
            type: 'string',
            description: 'Mathematical expression',
            required: true,
          },
        },
        execute: async (params) => {
          const expr = params.expression as string;
          try {
            return eval(expr);
          } catch {
            throw new Error('Invalid expression');
          }
        },
      },
      {
        name: 'system_info',
        description: 'Get system information',
        category: 'system',
        parameters: {},
        execute: async () => {
          return {
            platform: process.platform,
            arch: process.arch,
            nodeVersion: process.version,
            cwd: process.cwd(),
          };
        },
      },
    ];

    tools.forEach(tool => {
      this.registry.register(tool);
      console.log(`  ✓ Registered: ${tool.name} (${tool.category})`);
    });

    console.log(`\n→ Registry stats:`);
    console.log(`  Total tools: ${this.registry.count()}`);
    console.log(`  Categories: ${this.registry.getCategories().join(', ')}`);

    console.log('\n→ Executing tools:');

    try {
      const greeting = await this.registry.execute('greet', { name: 'J.A.R.V.I.S.' });
      console.log(`  greet("J.A.R.V.I.S."): ${greeting}`);
    } catch (error) {
      console.log(`  ✗ Error: ${error instanceof Error ? error.message : String(error)}`);
    }

    try {
      const formalGreeting = await this.registry.execute('greet', {
        name: 'Sir',
        formal: true,
      });
      console.log(`  greet("Sir", formal=true): ${formalGreeting}`);
    } catch (error) {
      console.log(`  ✗ Error: ${error instanceof Error ? error.message : String(error)}`);
    }

    try {
      const result = await this.registry.execute('calculate', { expression: '2 + 2 * 10' });
      console.log(`  calculate("2 + 2 * 10"): ${result}`);
    } catch (error) {
      console.log(`  ✗ Error: ${error instanceof Error ? error.message : String(error)}`);
    }

    try {
      const sysInfo = await this.registry.execute('system_info', {}) as Record<string, unknown>;
      console.log('  system_info():');
      console.log(`    Platform: ${sysInfo.platform}`);
      console.log(`    Arch: ${sysInfo.arch}`);
      console.log(`    Node: ${sysInfo.nodeVersion}`);
    } catch (error) {
      console.log(`  ✗ Error: ${error instanceof Error ? error.message : String(error)}`);
    }

    console.log('\n→ Listing tools by category:');
    const categories = this.registry.getCategories();
    categories.forEach(category => {
      const categoryTools = this.registry.list(category);
      console.log(`  ${category}:`);
      categoryTools.forEach(tool => {
        console.log(`    - ${tool.name}: ${tool.description}`);
      });
    });

    console.log('\n→ Parameter validation:');
    try {
      await this.registry.execute('greet', {});
      console.log('  ✗ Should have thrown validation error');
    } catch (error) {
      console.log(`  ✓ Validation works: ${error instanceof Error ? error.message : String(error)}`);
    }

    console.log();
  }
}

const demo = new ActionLayerDemo();
demo.run().catch(console.error);
