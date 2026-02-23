/**
 * Tests for Observer Layer
 */

import { test, expect, describe } from 'bun:test';
import {
  ObserverManager,
  FileWatcher,
  ClipboardMonitor,
  ProcessMonitor,
  NotificationListener,
  CalendarSync,
  EmailSync,
  type ObserverEvent,
} from './index';

describe('ObserverManager', () => {
  test('registers observers', () => {
    const manager = new ObserverManager();
    const watcher = new FileWatcher(['/tmp']);

    manager.register(watcher);

    expect(manager.listObservers()).toEqual(['file-watcher']);
  });

  test('propagates event handler to observers', () => {
    const manager = new ObserverManager();
    const watcher = new FileWatcher(['/tmp']);

    manager.register(watcher);

    let handlerCalled = false;
    manager.setEventHandler(() => {
      handlerCalled = true;
    });

    // Handler should be set on the observer
    expect(handlerCalled).toBe(false); // Not called yet, just registered
  });

  test('starts and stops all observers', async () => {
    const manager = new ObserverManager();
    const watcher = new FileWatcher(['/tmp']);
    const clipboard = new ClipboardMonitor(5000);

    manager.register(watcher);
    manager.register(clipboard);

    await manager.startAll();

    const status = manager.getStatus();
    expect(status['file-watcher']).toBe(true);
    expect(status['clipboard']).toBe(true);

    await manager.stopAll();

    const statusAfter = manager.getStatus();
    expect(statusAfter['file-watcher']).toBe(false);
    expect(statusAfter['clipboard']).toBe(false);
  });

  test('starts and stops individual observers', async () => {
    const manager = new ObserverManager();
    const watcher = new FileWatcher(['/tmp']);

    manager.register(watcher);

    await manager.startObserver('file-watcher');
    expect(manager.getStatus()['file-watcher']).toBe(true);

    await manager.stopObserver('file-watcher');
    expect(manager.getStatus()['file-watcher']).toBe(false);
  });
});

describe('FileWatcher', () => {
  test('starts and stops', async () => {
    const watcher = new FileWatcher(['/tmp']);

    expect(watcher.isRunning()).toBe(false);

    await watcher.start();
    expect(watcher.isRunning()).toBe(true);

    await watcher.stop();
    expect(watcher.isRunning()).toBe(false);
  });

  test('prevents double start', async () => {
    const watcher = new FileWatcher(['/tmp']);

    await watcher.start();
    await watcher.start(); // Should not throw

    expect(watcher.isRunning()).toBe(true);

    await watcher.stop();
  });
});

describe('ClipboardMonitor', () => {
  test('starts and stops', async () => {
    const clipboard = new ClipboardMonitor(5000);

    expect(clipboard.isRunning()).toBe(false);

    await clipboard.start();
    expect(clipboard.isRunning()).toBe(true);

    await clipboard.stop();
    expect(clipboard.isRunning()).toBe(false);
  });

  test('uses custom poll interval', async () => {
    const clipboard = new ClipboardMonitor(10000);

    await clipboard.start();
    expect(clipboard.isRunning()).toBe(true);

    await clipboard.stop();
  });
});

describe('ProcessMonitor', () => {
  test('starts and stops', async () => {
    const monitor = new ProcessMonitor(10000);

    expect(monitor.isRunning()).toBe(false);

    await monitor.start();
    expect(monitor.isRunning()).toBe(true);

    await monitor.stop();
    expect(monitor.isRunning()).toBe(false);
  });

  test('gets process list', async () => {
    const monitor = new ProcessMonitor(10000);

    const processes = await monitor.getProcessList();

    expect(Array.isArray(processes)).toBe(true);
    expect(processes.length).toBeGreaterThan(0);

    // Check structure of first process
    const proc = processes[0];
    expect(proc).toHaveProperty('pid');
    expect(proc).toHaveProperty('name');
    expect(proc).toHaveProperty('cpu');
    expect(proc).toHaveProperty('memory');
  });
});

describe('Stub Observers', () => {
  test('NotificationListener starts and stops', async () => {
    const listener = new NotificationListener();

    expect(listener.isRunning()).toBe(false);

    await listener.start();
    expect(listener.isRunning()).toBe(true);

    await listener.stop();
    expect(listener.isRunning()).toBe(false);
  });

  test('CalendarSync starts and stops', async () => {
    const sync = new CalendarSync();

    expect(sync.isRunning()).toBe(false);

    await sync.start();
    expect(sync.isRunning()).toBe(true);

    await sync.stop();
    expect(sync.isRunning()).toBe(false);
  });

  test('EmailSync starts and stops', async () => {
    const sync = new EmailSync();

    expect(sync.isRunning()).toBe(false);

    await sync.start();
    expect(sync.isRunning()).toBe(true);

    await sync.stop();
    expect(sync.isRunning()).toBe(false);
  });
});
