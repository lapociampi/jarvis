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

  const data = await response.json();
  expect(data.status).toBe('ok');
  expect(data.clients).toBe(0);
  expect(typeof data.uptime).toBe('number');

  server.stop();
});

test('WebSocketServer - root endpoint', async () => {
  server.start();

  const response = await fetch('http://localhost:3143/');
  expect(response.ok).toBe(true);

  const data = await response.json();
  expect(data.name).toBe('J.A.R.V.I.S.');
  expect(data.version).toBe('0.1.0');
  expect(data.endpoints).toBeDefined();

  server.stop();
});

test('WebSocketServer - WebSocket connection', async () => {
  let connectCalled = false;
  let disconnectCalled = false;

  server.setHandler({
    async onMessage(msg) {
      return {
        type: 'status',
        payload: { echo: msg.payload },
        timestamp: Date.now(),
      };
    },
    onConnect() {
      connectCalled = true;
    },
    onDisconnect() {
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
      messages[i].push(JSON.parse(event.data));
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

  expect(messages[0].length).toBe(1);
  expect(messages[1].length).toBe(1);
  expect(messages[0][0].payload).toEqual({ text: 'Broadcast to all' });
  expect(messages[1][0].payload).toEqual({ text: 'Broadcast to all' });

  clients.forEach((ws) => ws.close());
  server.stop();
});
