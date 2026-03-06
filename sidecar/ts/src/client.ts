import WebSocket from 'ws';
import * as os from 'node:os';
import type {
  SidecarConfig,
  SidecarTokenClaims,
  SidecarRegistration,
  RPCRequest,
  SidecarEvent,
  RPCHandler,
} from './types.js';
import { decodeJwtPayload } from './config.js';
import { createHandlerRegistry } from './handlers/index.js';

const MIN_RECONNECT_DELAY = 1000;
const MAX_RECONNECT_DELAY = 60_000;

export class SidecarClient {
  private ws: WebSocket | null = null;
  private reconnectDelay = MIN_RECONNECT_DELAY;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private handlers: Map<string, RPCHandler>;
  private claims: SidecarTokenClaims;
  private stopped = false;

  constructor(private config: SidecarConfig) {
    this.claims = decodeJwtPayload<SidecarTokenClaims>(config.token);
    this.handlers = createHandlerRegistry(config);
  }

  start(): void {
    this.stopped = false;
    this.connect();
  }

  stop(): void {
    this.stopped = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close(1000, 'client shutdown');
      this.ws = null;
    }
  }

  private connect(): void {
    const url = `${this.claims.brain}?token=${this.config.token}`;
    console.log(`[sidecar] Connecting to ${this.claims.brain}...`);

    this.ws = new WebSocket(url);

    this.ws.on('open', () => {
      console.log('[sidecar] Connected');
      this.reconnectDelay = MIN_RECONNECT_DELAY;
      this.sendRegistration();
    });

    this.ws.on('message', (data) => {
      this.handleMessage(data.toString());
    });

    this.ws.on('close', (code, reason) => {
      console.log(`[sidecar] Disconnected (code=${code}, reason=${reason.toString()})`);
      this.ws = null;
      this.scheduleReconnect();
    });

    this.ws.on('error', (err) => {
      console.error(`[sidecar] WebSocket error: ${err.message}`);
    });
  }

  private sendRegistration(): void {
    const msg: SidecarRegistration = {
      type: 'register',
      hostname: os.hostname(),
      os: os.platform(),
      platform: os.arch(),
      capabilities: this.config.capabilities,
    };
    this.send(msg);
    console.log(`[sidecar] Registered as ${msg.hostname} (${msg.os}/${msg.platform})`);
  }

  private async handleMessage(raw: string): Promise<void> {
    let msg: RPCRequest;
    try {
      msg = JSON.parse(raw);
    } catch {
      console.error('[sidecar] Invalid JSON received');
      return;
    }

    if (msg.type !== 'rpc_request') {
      return;
    }

    console.log(`[sidecar] RPC ${msg.id}: ${msg.method}`);

    const handler = this.handlers.get(msg.method);
    if (!handler) {
      this.sendResult(msg.id, undefined, { code: 'METHOD_NOT_FOUND', message: `Unknown method: ${msg.method}` });
      return;
    }

    try {
      const { result, binary } = await handler(msg.params);
      this.sendResult(msg.id, result, undefined, binary);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.sendResult(msg.id, undefined, { code: 'HANDLER_ERROR', message });
    }
  }

  private sendResult(
    rpcId: string,
    result: unknown,
    error?: { code: string; message: string },
    binary?: SidecarEvent['binary'],
  ): void {
    const event: SidecarEvent = {
      type: 'rpc_result',
      event_type: 'rpc_result',
      timestamp: Date.now(),
      payload: error
        ? { rpc_id: rpcId, error }
        : { rpc_id: rpcId, result },
    };
    if (binary) event.binary = binary;
    this.send(event);
  }

  private send(msg: unknown): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  private scheduleReconnect(): void {
    if (this.stopped) return;
    console.log(`[sidecar] Reconnecting in ${this.reconnectDelay / 1000}s...`);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, this.reconnectDelay);
    this.reconnectDelay = Math.min(this.reconnectDelay * 2, MAX_RECONNECT_DELAY);
  }
}
