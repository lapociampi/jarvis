# Communication Layer Integration Guide

Quick guide for integrating the communication layer with J.A.R.V.I.S. daemon and other components.

## Basic Integration

### 1. Start WebSocket Server in Daemon

```typescript
// In src/daemon/index.ts
import { WebSocketServer, StreamRelay, type WSMessage } from '../comms';
import { MessageRouter } from '../agents/router';

export class JarvisDaemon {
  private wsServer: WebSocketServer;
  private streamRelay: StreamRelay;
  private messageRouter: MessageRouter;

  constructor() {
    this.wsServer = new WebSocketServer(3142);
    this.streamRelay = new StreamRelay(this.wsServer);
    this.messageRouter = new MessageRouter();
  }

  async start() {
    // Set up WebSocket message handler
    this.wsServer.setHandler({
      async onMessage(msg: WSMessage) {
        if (msg.type === 'chat') {
          // Route to appropriate agent/LLM
          const response = await this.messageRouter.route(msg.payload);
          return {
            type: 'chat',
            payload: response,
            id: msg.id,
            timestamp: Date.now(),
          };
        }
      },
      onConnect() {
        console.log('[Daemon] WebSocket client connected');
      },
      onDisconnect() {
        console.log('[Daemon] WebSocket client disconnected');
      },
    });

    this.wsServer.start();
    console.log('J.A.R.V.I.S. daemon started');
  }

  async stop() {
    this.wsServer.stop();
  }
}
```

### 2. Add Multi-Channel Support

```typescript
import { ChannelManager, TelegramAdapter } from '../comms';

export class JarvisDaemon {
  private channels: ChannelManager;

  constructor() {
    // ... existing initialization
    this.channels = new ChannelManager();
  }

  async start() {
    // ... existing WebSocket setup

    // Set up unified channel handler
    this.channels.setHandler(async (message) => {
      console.log(`[${message.channel}] ${message.from}: ${message.text}`);

      // Broadcast to WebSocket clients
      this.wsServer.broadcast({
        type: 'chat',
        payload: {
          channel: message.channel,
          from: message.from,
          text: message.text,
        },
        timestamp: message.timestamp,
      });

      // Route to message processor
      const response = await this.messageRouter.route(message.text);

      return response;
    });

    // Register channels from environment
    if (process.env.TELEGRAM_BOT_TOKEN) {
      this.channels.register(new TelegramAdapter(process.env.TELEGRAM_BOT_TOKEN));
    }

    await this.channels.connectAll();
  }

  async stop() {
    await this.channels.disconnectAll();
    this.wsServer.stop();
  }
}
```

### 3. Stream LLM Responses

```typescript
import type { LLMProvider } from '../llm/provider';

export class JarvisDaemon {
  private llm: LLMProvider;

  async handleMessage(text: string, requestId: string): Promise<string> {
    // Generate streaming response
    const stream = this.llm.generateStream({
      messages: [{ role: 'user', content: text }],
    });

    // Relay stream to all WebSocket clients
    const fullResponse = await this.streamRelay.relayStream(stream, requestId);

    return fullResponse;
  }
}
```

## Integration with LLM Layer

The StreamRelay expects LLM providers to return streams conforming to this interface:

```typescript
// From src/llm/provider.ts
export type LLMStreamEvent =
  | { type: 'text'; text: string }
  | { type: 'error'; error: string }
  | { type: 'done'; usage?: { total_tokens: number } };

// LLM providers should implement:
export interface LLMProvider {
  generateStream(request: LLMRequest): AsyncIterable<LLMStreamEvent>;
}
```

Example OpenAI provider:

```typescript
async *generateStream(request: LLMRequest): AsyncIterable<LLMStreamEvent> {
  const stream = await this.client.chat.completions.create({
    model: this.model,
    messages: request.messages,
    stream: true,
  });

  try {
    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content;
      if (delta) {
        yield { type: 'text', text: delta };
      }
    }
    yield { type: 'done' };
  } catch (error) {
    yield { type: 'error', error: error.message };
  }
}
```

## WebSocket Client Example

### JavaScript/TypeScript Client

```typescript
const ws = new WebSocket('ws://localhost:3142/ws');

ws.onopen = () => {
  console.log('Connected to J.A.R.V.I.S.');

  // Send message
  ws.send(JSON.stringify({
    type: 'chat',
    payload: 'Hello J.A.R.V.I.S.!',
    id: crypto.randomUUID(),
    timestamp: Date.now(),
  }));
};

ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);

  switch (msg.type) {
    case 'stream':
      // Incremental response chunk
      console.log('Chunk:', msg.payload.text);
      break;

    case 'chat':
      // Complete message
      console.log('Response:', msg.payload);
      break;

    case 'status':
      if (msg.payload.status === 'done') {
        console.log('Stream complete:', msg.payload.fullText);
      }
      break;

    case 'error':
      console.error('Error:', msg.payload.message);
      break;
  }
};
```

### React Hook

```typescript
import { useEffect, useRef, useState } from 'react';

export function useJarvisWebSocket() {
  const ws = useRef<WebSocket | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    ws.current = new WebSocket('ws://localhost:3142/ws');

    ws.current.onopen = () => setConnected(true);
    ws.current.onclose = () => setConnected(false);

    ws.current.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      setMessages((prev) => [...prev, msg]);
    };

    return () => ws.current?.close();
  }, []);

  const sendMessage = (type: string, payload: any) => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify({
        type,
        payload,
        id: crypto.randomUUID(),
        timestamp: Date.now(),
      }));
    }
  };

  return { messages, sendMessage, connected };
}
```

## Environment Configuration

Add to `.env`:

```bash
# WebSocket Server
JARVIS_WS_PORT=3142

# Telegram Bot
TELEGRAM_BOT_TOKEN=1234567890:ABCdefGHIjklMNOpqrsTUVwxyz

# Future integrations
# WHATSAPP_PHONE_ID=...
# WHATSAPP_ACCESS_TOKEN=...
# DISCORD_BOT_TOKEN=...
# SIGNAL_PHONE=+1234567890

# Voice I/O (future)
# WHISPER_ENDPOINT=http://localhost:8080
# ELEVENLABS_API_KEY=...
# TTS_ENDPOINT=http://localhost:5002
```

## Testing Integration

### 1. Test WebSocket Locally

```bash
# Start daemon
bun run src/daemon/index.ts

# In another terminal, test with websocat
websocat ws://localhost:3142/ws

# Send a message (paste this JSON):
{"type":"chat","payload":"Hello!","timestamp":1708645200000}
```

### 2. Test Telegram Bot

```bash
# Set token
export TELEGRAM_BOT_TOKEN="your_token"

# Start daemon
bun run src/daemon/index.ts

# Send message to bot via Telegram app
# Bot should respond
```

### 3. Health Check

```bash
curl http://localhost:3142/health
# {"status":"ok","uptime":12345,"clients":0,"timestamp":1708645200000}
```

## Error Handling

All communication layer components include built-in error handling:

1. **WebSocket**: Malformed messages return error type
2. **Telegram**: API errors logged and user notified
3. **StreamRelay**: Stream errors broadcast to clients
4. **ChannelManager**: Channel connection failures logged

Add application-level error handling:

```typescript
this.wsServer.setHandler({
  async onMessage(msg) {
    try {
      // Process message
      const response = await processMessage(msg);
      return response;
    } catch (error) {
      console.error('[Daemon] Error processing message:', error);
      return {
        type: 'error',
        payload: {
          message: 'Failed to process message',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
        timestamp: Date.now(),
      };
    }
  },
  // ...
});
```

## Performance Optimization

### Connection Pooling

```typescript
// Limit concurrent WebSocket connections
const MAX_CLIENTS = 100;

this.wsServer.setHandler({
  onConnect() {
    if (this.wsServer.getClientCount() > MAX_CLIENTS) {
      // Reject connection
      throw new Error('Max clients reached');
    }
  },
  // ...
});
```

### Rate Limiting

```typescript
import { RateLimiter } from '../utils/rate-limiter';

const limiter = new RateLimiter({
  maxRequests: 10,
  windowMs: 60000, // 10 requests per minute
});

this.channels.setHandler(async (message) => {
  if (!limiter.check(message.from)) {
    return 'Rate limit exceeded. Please slow down.';
  }

  // Process message
});
```

## Next Steps

1. Integrate with existing `src/daemon/index.ts`
2. Connect to LLM router (`src/llm/router.ts`)
3. Add authentication layer for WebSocket
4. Implement voice I/O providers (Whisper, TTS)
5. Add additional channel adapters (Discord, WhatsApp)
6. Create frontend UI with WebSocket client
7. Set up production deployment (reverse proxy, SSL)

## Troubleshooting

See [README.md](./README.md#troubleshooting) for common issues and solutions.
