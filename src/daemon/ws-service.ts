/**
 * WebSocket Service — The Mouth
 *
 * Wraps WebSocketServer and StreamRelay. Routes incoming messages
 * to the AgentService and relays streamed responses back to clients.
 */

import type { Service, ServiceStatus } from './services.ts';
import type { AgentService } from './agent-service.ts';
import { WebSocketServer, type WSMessage } from '../comms/websocket.ts';
import { StreamRelay } from '../comms/streaming.ts';

export class WebSocketService implements Service {
  name = 'websocket';
  private _status: ServiceStatus = 'stopped';
  private port: number;
  private agentService: AgentService;
  private wsServer: WebSocketServer;
  private streamRelay: StreamRelay;

  constructor(port: number, agentService: AgentService) {
    this.port = port;
    this.agentService = agentService;
    this.wsServer = new WebSocketServer(port);
    this.streamRelay = new StreamRelay(this.wsServer);
  }

  async start(): Promise<void> {
    this._status = 'starting';

    try {
      // Set up message handler
      this.wsServer.setHandler({
        onMessage: (msg) => this.routeMessage(msg),
        onConnect: () => {
          console.log('[WSService] Client connected');
        },
        onDisconnect: () => {
          console.log('[WSService] Client disconnected');
        },
      });

      // Start the server
      this.wsServer.start();
      this._status = 'running';
      console.log(`[WSService] Started on port ${this.port}`);
    } catch (error) {
      this._status = 'error';
      throw error;
    }
  }

  async stop(): Promise<void> {
    this._status = 'stopping';
    this.wsServer.stop();
    this._status = 'stopped';
    console.log('[WSService] Stopped');
  }

  status(): ServiceStatus {
    return this._status;
  }

  /**
   * Broadcast a proactive heartbeat message to all connected clients.
   */
  broadcastHeartbeat(text: string): void {
    const message: WSMessage = {
      type: 'chat',
      payload: {
        text,
        source: 'heartbeat',
      },
      timestamp: Date.now(),
    };
    this.wsServer.broadcast(message);
  }

  /**
   * Route incoming WebSocket messages to the appropriate handler.
   */
  private async routeMessage(msg: WSMessage): Promise<WSMessage | void> {
    switch (msg.type) {
      case 'chat':
        return this.handleChat(msg);

      case 'command':
        return this.handleCommand(msg);

      case 'status':
        return this.handleStatus();

      default:
        return {
          type: 'error',
          payload: { message: `Unknown message type: ${msg.type}` },
          timestamp: Date.now(),
        };
    }
  }

  /**
   * Handle chat messages — stream response via StreamRelay.
   */
  private async handleChat(msg: WSMessage): Promise<WSMessage | void> {
    const payload = msg.payload as { text?: string; channel?: string };
    const text = payload?.text;

    if (!text) {
      return {
        type: 'error',
        payload: { message: 'Missing text in chat payload' },
        id: msg.id,
        timestamp: Date.now(),
      };
    }

    const channel = payload.channel ?? 'websocket';
    const requestId = msg.id ?? crypto.randomUUID();

    try {
      const { stream, onComplete } = this.agentService.streamMessage(text, channel);

      // Relay stream to all WebSocket clients, collect full text
      const fullText = await this.streamRelay.relayStream(stream, requestId);

      // Fire-and-forget: run post-processing (extraction, personality)
      onComplete(fullText).catch((err) =>
        console.error('[WSService] onComplete error:', err)
      );

      // Don't return a direct response — StreamRelay already broadcast everything
      return undefined;
    } catch (error) {
      console.error('[WSService] Chat error:', error);
      return {
        type: 'error',
        payload: {
          message: error instanceof Error ? error.message : 'Chat processing failed',
        },
        id: requestId,
        timestamp: Date.now(),
      };
    }
  }

  /**
   * Handle system commands.
   */
  private async handleCommand(msg: WSMessage): Promise<WSMessage> {
    const payload = msg.payload as { command?: string };
    const command = payload?.command;

    switch (command) {
      case 'health':
        return {
          type: 'status',
          payload: {
            status: 'ok',
            service: this.name,
            clients: this.wsServer.getClientCount(),
          },
          id: msg.id,
          timestamp: Date.now(),
        };

      case 'ping':
        return {
          type: 'status',
          payload: { pong: true },
          id: msg.id,
          timestamp: Date.now(),
        };

      default:
        return {
          type: 'error',
          payload: { message: `Unknown command: ${command}` },
          id: msg.id,
          timestamp: Date.now(),
        };
    }
  }

  /**
   * Handle status requests.
   */
  private handleStatus(): WSMessage {
    return {
      type: 'status',
      payload: {
        service: this.name,
        status: this._status,
        clients: this.wsServer.getClientCount(),
        port: this.port,
      },
      timestamp: Date.now(),
    };
  }
}
