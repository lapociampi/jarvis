import { test, expect } from 'bun:test';
import { ChannelManager } from './index.ts';
import type { ChannelAdapter, ChannelMessage } from './channels/telegram.ts';

// Mock channel adapter for testing
class MockChannel implements ChannelAdapter {
  name = 'mock';
  private _connected = false;
  private _handler: ((msg: ChannelMessage) => Promise<string>) | null = null;

  async connect(): Promise<void> {
    this._connected = true;
  }

  async disconnect(): Promise<void> {
    this._connected = false;
  }

  async sendMessage(to: string, text: string): Promise<void> {
    // Mock implementation
  }

  onMessage(handler: (msg: ChannelMessage) => Promise<string>): void {
    this._handler = handler;
  }

  isConnected(): boolean {
    return this._connected;
  }

  // Test helper to simulate receiving a message
  async simulateMessage(text: string): Promise<string | null> {
    if (!this._handler) return null;

    const msg: ChannelMessage = {
      id: '1',
      channel: 'mock',
      from: 'testuser',
      text,
      timestamp: Date.now(),
      metadata: {},
    };

    return this._handler(msg);
  }
}

test('ChannelManager - register channel', () => {
  const manager = new ChannelManager();
  const channel = new MockChannel();

  manager.register(channel);
  expect(manager.listChannels()).toEqual(['mock']);
  expect(manager.getChannel('mock')).toBe(channel);
});

test('ChannelManager - set handler', async () => {
  const manager = new ChannelManager();
  const channel = new MockChannel();

  manager.register(channel);

  let handlerCalled = false;
  manager.setHandler(async (msg) => {
    handlerCalled = true;
    return `Echo: ${msg.text}`;
  });

  const response = await channel.simulateMessage('test');
  expect(handlerCalled).toBe(true);
  expect(response).toBe('Echo: test');
});

test('ChannelManager - connect all channels', async () => {
  const manager = new ChannelManager();
  const channel1 = new MockChannel();
  const channel2 = new MockChannel();
  channel2.name = 'mock2';

  manager.register(channel1);
  manager.register(channel2);

  await manager.connectAll();

  const status = manager.getStatus();
  expect(status.mock).toBe(true);
  expect(status.mock2).toBe(true);
});

test('ChannelManager - disconnect all channels', async () => {
  const manager = new ChannelManager();
  const channel = new MockChannel();

  manager.register(channel);
  await manager.connectAll();

  expect(manager.getStatus().mock).toBe(true);

  await manager.disconnectAll();
  expect(manager.getStatus().mock).toBe(false);
});

test('ChannelManager - list channels', () => {
  const manager = new ChannelManager();

  expect(manager.listChannels()).toEqual([]);

  manager.register(new MockChannel());
  expect(manager.listChannels()).toEqual(['mock']);

  const channel2 = new MockChannel();
  channel2.name = 'mock2';
  manager.register(channel2);

  expect(manager.listChannels()).toContain('mock');
  expect(manager.listChannels()).toContain('mock2');
});
