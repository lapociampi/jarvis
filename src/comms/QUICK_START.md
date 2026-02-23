# Communication Layer - Quick Start

Get started with J.A.R.V.I.S. Communication Layer in 5 minutes.

## Installation

No dependencies needed! Uses only Bun built-in APIs.

```bash
cd /home/vierisid/jarvis
bun test src/comms/*.test.ts  # Verify everything works
```

## 1. Basic WebSocket Server (30 seconds)

```typescript
import { WebSocketServer } from './comms';

const ws = new WebSocketServer(3142);

ws.setHandler({
  async onMessage(msg) {
    console.log('Received:', msg.payload);
    return { type: 'chat', payload: 'Hello!', timestamp: Date.now() };
  },
  onConnect: () => console.log('Client connected'),
  onDisconnect: () => console.log('Client disconnected'),
});

ws.start();
// WebSocket: ws://localhost:3142/ws
// Health: http://localhost:3142/health
```

**Test it:**
```bash
curl http://localhost:3142/health
# {"status":"ok","uptime":12345,"clients":0,...}
```

## 2. Telegram Bot Integration (2 minutes)

```typescript
import { TelegramAdapter } from './comms';

const bot = new TelegramAdapter(process.env.TELEGRAM_BOT_TOKEN!);

bot.onMessage(async (msg) => {
  console.log(`${msg.from}: ${msg.text}`);
  return `Echo: ${msg.text}`;
});

await bot.connect();
// Bot is now polling for messages
```

**Setup:**
1. Talk to [@BotFather](https://t.me/botfather) on Telegram
2. Create bot: `/newbot`
3. Copy token: `1234567890:ABCdefGHI...`
4. Set env: `export TELEGRAM_BOT_TOKEN="your_token"`
5. Run code above

## 3. Multi-Channel Support (3 minutes)

```typescript
import { ChannelManager, TelegramAdapter } from './comms';

const channels = new ChannelManager();

// Register channels
channels.register(new TelegramAdapter(process.env.TELEGRAM_BOT_TOKEN!));
// channels.register(new DiscordAdapter(...));  // Future
// channels.register(new WhatsAppAdapter(...));  // Future

// Set unified handler for all channels
channels.setHandler(async (message) => {
  console.log(`[${message.channel}] ${message.from}: ${message.text}`);
  return `Received your message!`;
});

// Connect everything
await channels.connectAll();
console.log('Status:', channels.getStatus());
// Status: { telegram: true }
```

## 4. Stream LLM Responses (2 minutes)

```typescript
import { WebSocketServer, StreamRelay } from './comms';

const ws = new WebSocketServer();
ws.start();

const relay = new StreamRelay(ws);

// Simulate LLM streaming response
async function* generateStream() {
  yield { type: 'text', text: 'Hello ' };
  yield { type: 'text', text: 'from ' };
  yield { type: 'text', text: 'J.A.R.V.I.S.!' };
  yield { type: 'done' };
}

// Relay to all connected WebSocket clients
const fullText = await relay.relayStream(generateStream(), 'req-123');
console.log('Complete:', fullText);
// Complete: Hello from J.A.R.V.I.S.!
```

**Clients receive real-time updates:**
```json
{"type":"stream","payload":{"text":"Hello ","requestId":"req-123"},...}
{"type":"stream","payload":{"text":"from ","requestId":"req-123"},...}
{"type":"stream","payload":{"text":"J.A.R.V.I.S.!","requestId":"req-123"},...}
{"type":"status","payload":{"status":"done","fullText":"Hello from J.A.R.V.I.S.!"},...}
```

## 5. Complete Integration (5 minutes)

```typescript
import {
  WebSocketServer,
  ChannelManager,
  TelegramAdapter,
  StreamRelay,
} from './comms';

// Initialize
const ws = new WebSocketServer();
const channels = new ChannelManager();
const relay = new StreamRelay(ws);

// WebSocket handler
ws.setHandler({
  async onMessage(msg) {
    if (msg.type === 'chat') {
      // Process and respond
      return { type: 'chat', payload: `You said: ${msg.payload}`, timestamp: Date.now() };
    }
  },
  onConnect: () => console.log('[WS] Client connected'),
  onDisconnect: () => console.log('[WS] Client disconnected'),
});

// Channel handler (Telegram, Discord, etc.)
channels.setHandler(async (message) => {
  console.log(`[${message.channel}] ${message.from}: ${message.text}`);

  // Broadcast to WebSocket clients
  ws.broadcast({
    type: 'chat',
    payload: { channel: message.channel, text: message.text },
    timestamp: Date.now(),
  });

  // TODO: Route to LLM and stream response
  return `Received: ${message.text}`;
});

// Register channels
if (process.env.TELEGRAM_BOT_TOKEN) {
  channels.register(new TelegramAdapter(process.env.TELEGRAM_BOT_TOKEN));
}

// Start everything
ws.start();
await channels.connectAll();

console.log('✅ J.A.R.V.I.S. Communication Layer running');
console.log(`   WebSocket: ws://localhost:${ws.getPort()}/ws`);
console.log(`   Channels: ${channels.listChannels().join(', ')}`);

// Graceful shutdown
process.on('SIGINT', async () => {
  await channels.disconnectAll();
  ws.stop();
  process.exit(0);
});
```

## Message Types

### WebSocket Messages

```typescript
type WSMessage = {
  type: 'chat' | 'command' | 'status' | 'stream' | 'error';
  payload: unknown;
  id?: string;
  timestamp: number;
};
```

### Channel Messages

```typescript
type ChannelMessage = {
  id: string;
  channel: string;        // 'telegram', 'discord', etc.
  from: string;           // Username or display name
  text: string;           // Message content
  timestamp: number;      // Unix timestamp (ms)
  metadata: {
    chatId?: number;      // Telegram chat ID
    userId?: number;      // Telegram user ID
    // ... other platform-specific data
  };
};
```

## Testing

```bash
# Run all tests
bun test src/comms/*.test.ts

# Run example
bun run src/comms/example.ts

# Run with Telegram
export TELEGRAM_BOT_TOKEN="your_token"
bun run src/comms/example.ts
```

## Common Patterns

### Broadcast to all WebSocket clients
```typescript
ws.broadcast({
  type: 'status',
  payload: { message: 'Server starting up...' },
  timestamp: Date.now(),
});
```

### Send to specific channel
```typescript
const telegram = channels.getChannel('telegram');
await telegram?.sendMessage('CHAT_ID', 'Hello user!');
```

### Check connection status
```typescript
console.log(ws.isRunning());        // true/false
console.log(ws.getClientCount());   // number of connected clients
console.log(channels.getStatus());  // { telegram: true, discord: false }
```

### Error handling
```typescript
ws.setHandler({
  async onMessage(msg) {
    try {
      // Process message
      return { type: 'chat', payload: 'Success!', timestamp: Date.now() };
    } catch (error) {
      return {
        type: 'error',
        payload: { message: error.message },
        timestamp: Date.now(),
      };
    }
  },
});
```

## Environment Variables

```bash
# Optional: WebSocket port (default: 3142)
JARVIS_WS_PORT=3142

# Required for Telegram
TELEGRAM_BOT_TOKEN=1234567890:ABCdefGHIjklMNOpqrsTUVwxyz

# Future integrations
WHATSAPP_PHONE_ID=...
WHATSAPP_ACCESS_TOKEN=...
DISCORD_BOT_TOKEN=...
SIGNAL_PHONE=+1234567890
```

## WebSocket Client (Browser)

```html
<script>
const ws = new WebSocket('ws://localhost:3142/ws');

ws.onopen = () => {
  ws.send(JSON.stringify({
    type: 'chat',
    payload: 'Hello J.A.R.V.I.S.!',
    timestamp: Date.now(),
  }));
};

ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  console.log('Received:', msg);

  if (msg.type === 'stream') {
    // Real-time LLM response chunk
    document.body.innerHTML += msg.payload.text;
  }
};
</script>
```

## Next Steps

1. ✅ You've learned the basics
2. Read [`README.md`](./README.md) for detailed documentation
3. Read [`INTEGRATION.md`](./INTEGRATION.md) for daemon integration
4. Check [`example.ts`](./example.ts) for complete working code
5. Run tests: `bun test src/comms/*.test.ts`

## Common Issues

**WebSocket not connecting?**
- Check port: `lsof -i :3142`
- Verify server is running: `curl http://localhost:3142/health`

**Telegram bot not responding?**
- Verify token: `curl https://api.telegram.org/bot<TOKEN>/getMe`
- Check logs for "Starting polling..."
- Ensure bot isn't blocked

**No LLM streaming?**
- Verify WebSocket clients connected: `/health` endpoint
- Check LLM stream format matches `LLMStreamEvent` interface
- Add logging in `StreamRelay.relayStream()`

## Full Documentation

- [`README.md`](./README.md) - Complete API reference
- [`INTEGRATION.md`](./INTEGRATION.md) - Daemon integration guide
- [`FILE_STRUCTURE.md`](./FILE_STRUCTURE.md) - File structure overview
- [`example.ts`](./example.ts) - Working demonstration

---

**Questions?** Check the inline TypeScript documentation in each module.
