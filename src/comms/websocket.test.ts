import { test, expect, beforeEach, afterEach } from 'bun:test';
import { WebSocketServer, type WSMessage } from './websocket.ts';

let server: WebSocketServer;

beforeEach(() => {
  server = new WebSocketServer(3143); // Use different port for tests
});

afterEach(() => {
  if (server.isRunning()) {
    server.stop();
  }
});

test('WebSocketServer - initialization', () => {
  expect(server.isRunning()).toBe(false);
  expect(server.getPort()).toBe(3143);
  expect(server.getClientCount()).toBe(0);
});

test('WebSocketServer - start and stop', () => {
  server.start();
  expect(server.isRunning()).toBe(true);

  server.stop();
  expect(server.isRunning()).toBe(false);
  expect(server.getClientCount()).toBe(0);
});

test('WebSocketServer - health endpoint', async () => {
  server.start();

  const response = await fetch('http://localhost:3143/health');
  expect(response.ok).toBe(true);

  const data = await response.json() as any;
  expect(data.status).toBe('ok');
  expect(data.clients).toBe(0);
  expect(typeof data.uptime).toBe('number');

  server.stop();
});

test('WebSocketServer - root endpoint returns 404 without static dir', async () => {
  server.start();

  const response = await fetch('http://localhost:3143/');
  expect(response.status).toBe(404);

  server.stop();
});

test('WebSocketServer - WebSocket connection', async () => {
  let connectCalled = false;
  let disconnectCalled = false;

  server.setHandler({
    async onMessage(msg, _ws) {
      return {
        type: 'status',
        payload: { echo: msg.payload },
        timestamp: Date.now(),
      };
    },
    onConnect(_ws) {
      connectCalled = true;
    },
    onDisconnect(_ws) {
      disconnectCalled = true;
    },
  });

  server.start();

  // Connect WebSocket client
  const ws = new WebSocket('ws://localhost:3143/ws');

  await new Promise<void>((resolve) => {
    ws.onopen = () => {
      expect(server.getClientCount()).toBe(1);
      expect(connectCalled).toBe(true);
      resolve();
    };
  });

  // Send message and receive response
  const received = await new Promise<WSMessage>((resolve) => {
    ws.onmessage = (event) => {
      resolve(JSON.parse(event.data));
    };

    const testMessage: WSMessage = {
      type: 'chat',
      payload: 'Hello J.A.R.V.I.S.',
      timestamp: Date.now(),
    };

    ws.send(JSON.stringify(testMessage));
  });

  expect(received.type).toBe('status');
  expect(received.payload).toEqual({ echo: 'Hello J.A.R.V.I.S.' });

  // Close connection
  ws.close();

  await new Promise((resolve) => setTimeout(resolve, 100));
  expect(disconnectCalled).toBe(true);
  expect(server.getClientCount()).toBe(0);

  server.stop();
});

test('WebSocketServer - broadcast', async () => {
  server.start();

  const clients: WebSocket[] = [];
  const messages: WSMessage[][] = [[], []];

  // Connect two clients
  for (let i = 0; i < 2; i++) {
    const ws = new WebSocket('ws://localhost:3143/ws');
    clients.push(ws);

    await new Promise<void>((resolve) => {
      ws.onopen = () => resolve();
    });

    ws.onmessage = (event) => {
      messages[i]!.push(JSON.parse(event.data));
    };
  }

  expect(server.getClientCount()).toBe(2);

  // Broadcast message
  const broadcastMsg: WSMessage = {
    type: 'status',
    payload: { text: 'Broadcast to all' },
    timestamp: Date.now(),
  };

  server.broadcast(broadcastMsg);

  // Wait for messages to arrive
  await new Promise((resolve) => setTimeout(resolve, 100));

  expect(messages[0]!.length).toBe(1);
  expect(messages[1]!.length).toBe(1);
  expect(messages[0]![0]!.payload).toEqual({ text: 'Broadcast to all' });
  expect(messages[1]![0]!.payload).toEqual({ text: 'Broadcast to all' });

  clients.forEach((ws) => ws.close());
  server.stop();
});

test('WebSocketServer - binary message routing', async () => {
  let receivedBinary: Buffer | null = null;
  let receivedFromWs: any = null;

  server.setHandler({
    async onMessage(msg, _ws) { return undefined; },
    async onBinaryMessage(data, ws) {
      receivedBinary = data;
      receivedFromWs = ws;
    },
    onConnect(_ws) {},
    onDisconnect(_ws) {},
  });

  server.start();

  const ws = new WebSocket('ws://localhost:3143/ws');
  await new Promise<void>((resolve) => { ws.onopen = () => resolve(); });

  // Send binary data
  const testData = new Uint8Array([1, 2, 3, 4, 5]);
  ws.send(testData.buffer);

  await new Promise((resolve) => setTimeout(resolve, 200));
  expect(receivedBinary).not.toBeNull();
  expect(receivedBinary!.length).toBe(5);
  expect(receivedFromWs).not.toBeNull();

  ws.close();
  server.stop();
});

test('WebSocketServer - sendBinary reaches client', async () => {
  let serverWsRef: any = null;

  server.setHandler({
    async onMessage(msg, ws) {
      serverWsRef = ws;
      return { type: 'status', payload: { ok: true }, timestamp: Date.now() };
    },
    onConnect(_ws) {},
    onDisconnect(_ws) {},
  });

  server.start();

  const ws = new WebSocket('ws://localhost:3143/ws');
  ws.binaryType = 'arraybuffer';

  let receivedBinary: ArrayBuffer | null = null;

  await new Promise<void>((resolve) => { ws.onopen = () => resolve(); });

  ws.onmessage = (e) => {
    if (e.data instanceof ArrayBuffer) {
      receivedBinary = e.data;
    }
  };

  // Send a JSON message first to capture the server ws ref
  ws.send(JSON.stringify({ type: 'status', payload: {}, timestamp: Date.now() }));
  await new Promise((resolve) => setTimeout(resolve, 200));

  expect(serverWsRef).not.toBeNull();

  // Send binary from server to client
  server.sendBinary(serverWsRef, Buffer.from([10, 20, 30]));
  await new Promise((resolve) => setTimeout(resolve, 200));

  expect(receivedBinary).not.toBeNull();
  expect(new Uint8Array(receivedBinary!)).toEqual(new Uint8Array([10, 20, 30]));

  ws.close();
  server.stop();
});

test('WebSocketServer - sendToClient unicasts JSON', async () => {
  let serverWsRef: any = null;

  server.setHandler({
    async onMessage(msg, ws) {
      serverWsRef = ws;
      return undefined;  // No auto-response
    },
    onConnect(_ws) {},
    onDisconnect(_ws) {},
  });

  server.start();

  const ws = new WebSocket('ws://localhost:3143/ws');
  const received: WSMessage[] = [];

  await new Promise<void>((resolve) => { ws.onopen = () => resolve(); });

  ws.onmessage = (e) => {
    if (typeof e.data === 'string') {
      received.push(JSON.parse(e.data));
    }
  };

  // Trigger to get ws ref
  ws.send(JSON.stringify({ type: 'command', payload: {}, timestamp: Date.now() }));
  await new Promise((resolve) => setTimeout(resolve, 200));

  // Unicast a tts_start message
  server.sendToClient(serverWsRef, {
    type: 'tts_start',
    payload: { requestId: 'test-123' },
    timestamp: Date.now(),
  });
  await new Promise((resolve) => setTimeout(resolve, 200));

  expect(received.length).toBe(1);
  expect(received[0]!.type).toBe('tts_start');
  expect((received[0]!.payload as any).requestId).toBe('test-123');

  ws.close();
  server.stop();
});
