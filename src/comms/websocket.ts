import type { Server, ServerWebSocket } from 'bun';

export type WSMessage = {
  type: 'chat' | 'command' | 'status' | 'stream' | 'error';
  payload: unknown;
  id?: string;
  timestamp: number;
};

export type WSClientHandler = {
  onMessage: (msg: WSMessage) => Promise<WSMessage | void>;
  onConnect: () => void;
  onDisconnect: () => void;
};

export class WebSocketServer {
  private server: Server | null = null;
  private clients: Set<ServerWebSocket<unknown>> = new Set();
  private handler: WSClientHandler | null = null;
  private port: number;
  private startTime: number = 0;

  constructor(port: number = 3142) {
    this.port = port;
  }

  setHandler(handler: WSClientHandler): void {
    this.handler = handler;
  }

  start(): void {
    if (this.server) {
      console.warn('[WebSocketServer] Server already running');
      return;
    }

    this.startTime = Date.now();
    const self = this;

    this.server = Bun.serve({
      port: this.port,
      fetch(req, server) {
        const url = new URL(req.url);

        if (url.pathname === '/ws') {
          const success = server.upgrade(req);
          if (success) {
            return undefined;
          }
          return new Response('WebSocket upgrade failed', { status: 500 });
        }

        if (url.pathname === '/health') {
          return Response.json({
            status: 'ok',
            uptime: Date.now() - self.startTime,
            clients: self.clients.size,
            timestamp: Date.now(),
          });
        }

        // Default root response
        return Response.json({
          name: 'J.A.R.V.I.S.',
          version: '0.1.0',
          endpoints: {
            websocket: '/ws',
            health: '/health',
          },
          clients: self.clients.size,
        });
      },

      websocket: {
        open(ws) {
          self.clients.add(ws);
          console.log('[WebSocketServer] Client connected. Total clients:', self.clients.size);
          self.handler?.onConnect();
        },

        async message(ws, message) {
          try {
            const msg: WSMessage = JSON.parse(message.toString());
            console.log('[WebSocketServer] Received:', msg.type, msg.id);

            if (self.handler) {
              const response = await self.handler.onMessage(msg);
              if (response) {
                ws.send(JSON.stringify(response));
              }
            }
          } catch (error) {
            console.error('[WebSocketServer] Error processing message:', error);
            const errorMsg: WSMessage = {
              type: 'error',
              payload: {
                message: error instanceof Error ? error.message : 'Unknown error',
              },
              timestamp: Date.now(),
            };
            ws.send(JSON.stringify(errorMsg));
          }
        },

        close(ws) {
          self.clients.delete(ws);
          console.log('[WebSocketServer] Client disconnected. Total clients:', self.clients.size);
          self.handler?.onDisconnect();
        },
      },
    });

    console.log(`[WebSocketServer] Started on ws://localhost:${this.port}/ws`);
    console.log(`[WebSocketServer] Health endpoint: http://localhost:${this.port}/health`);
  }

  stop(): void {
    if (this.server) {
      this.server.stop();
      this.server = null;
      this.clients.clear();
      console.log('[WebSocketServer] Stopped');
    }
  }

  broadcast(message: WSMessage): void {
    const payload = JSON.stringify(message);
    let sent = 0;

    for (const client of this.clients) {
      try {
        client.send(payload);
        sent++;
      } catch (error) {
        console.error('[WebSocketServer] Error broadcasting to client:', error);
      }
    }

    console.log(`[WebSocketServer] Broadcast to ${sent}/${this.clients.size} clients`);
  }

  send(client: ServerWebSocket<unknown>, message: WSMessage): void {
    try {
      client.send(JSON.stringify(message));
    } catch (error) {
      console.error('[WebSocketServer] Error sending to client:', error);
    }
  }

  isRunning(): boolean {
    return this.server !== null;
  }

  getPort(): number {
    return this.port;
  }

  getClientCount(): number {
    return this.clients.size;
  }
}
