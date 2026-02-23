# Project J.A.R.V.I.S.

**J**ust **A** **R**eally **V**ersatile **I**ntelligent **S**ystem

An AI-powered personal assistant system built with Bun, TypeScript, and modern LLM providers.

## Quick Start

```bash
# Install dependencies
bun install

# Setup configuration
bun run setup

# Test LLM providers
bun run test:llm

# Run examples
bun run examples

# Start daemon (coming soon)
bun run dev
```

## Features

### LLM Provider Abstraction
- **Multi-Provider Support**: Anthropic Claude, OpenAI GPT, Ollama (local)
- **Automatic Fallback**: Seamless provider switching on failure
- **Streaming Support**: Real-time response streaming
- **Tool Calling**: Cross-provider function calling
- **Type-Safe**: Full TypeScript coverage

### Configuration System
- **YAML-Based**: Human-readable configuration
- **Type-Safe**: Strong typing with defaults
- **Deep Merging**: Partial configs merge with defaults
- **Path Expansion**: Automatic `~` expansion

### Architecture (Planned)
- **Daemon**: Background service with WebSocket API
- **Vault**: SQLite-based memory and state persistence
- **Roles**: Pluggable role-based behaviors
- **Agents**: Autonomous task executors
- **Observers**: System monitoring and awareness
- **Actions**: Cross-platform automation

## Documentation

- **[Quick Start Guide](QUICKSTART.md)** - Get up and running in 5 minutes
- **[LLM Providers](docs/LLM_PROVIDERS.md)** - Complete provider documentation
- **[Config System](src/config/README.md)** - Configuration reference
- **[Implementation Summary](IMPLEMENTATION_SUMMARY.md)** - Architecture overview

## Project Structure

```
/home/vierisid/jarvis/
├── src/
│   ├── llm/              # LLM provider abstraction
│   │   ├── provider.ts   # Core types & interfaces
│   │   ├── anthropic.ts  # Claude provider
│   │   ├── openai.ts     # GPT provider
│   │   ├── ollama.ts     # Local models provider
│   │   ├── manager.ts    # Multi-provider manager
│   │   └── index.ts      # Public exports
│   ├── config/           # Configuration system
│   │   ├── types.ts      # Config types & defaults
│   │   ├── loader.ts     # YAML loader/saver
│   │   └── index.ts      # Public exports
│   ├── daemon/           # Background service (WIP)
│   ├── vault/            # SQLite persistence (WIP)
│   ├── roles/            # Role definitions (WIP)
│   ├── agents/           # Autonomous agents (WIP)
│   ├── observers/        # System observers (WIP)
│   └── actions/          # Action implementations (WIP)
├── examples/             # Usage examples
├── scripts/              # Utility scripts
├── roles/                # Role configuration files
└── docs/                 # Documentation

```

## Configuration

Create `~/.jarvis/config.yaml`:

```yaml
daemon:
  port: 7777
  data_dir: "~/.jarvis"
  db_path: "~/.jarvis/jarvis.db"

llm:
  primary: "anthropic"
  fallback: ["openai", "ollama"]
  anthropic:
    api_key: "sk-ant-..."
    model: "claude-sonnet-4-5-20250929"

personality:
  core_traits: ["loyal", "efficient", "proactive"]

authority:
  default_level: 3

active_role: "default"
```

See [config.example.yaml](config.example.yaml) for all options.

## Usage Example

```typescript
import { loadConfig } from './src/config/index.ts';
import { LLMManager, AnthropicProvider } from './src/llm/index.ts';

// Load configuration
const config = await loadConfig();

// Initialize LLM manager
const manager = new LLMManager();
manager.registerProvider(
  new AnthropicProvider(
    config.llm.anthropic.api_key,
    config.llm.anthropic.model
  )
);

// Chat
const response = await manager.chat([
  { role: 'user', content: 'Hello, J.A.R.V.I.S.!' }
]);

console.log(response.content);

// Stream
for await (const event of manager.stream(messages)) {
  if (event.type === 'text') {
    process.stdout.write(event.text);
  }
}
```

## Available Scripts

```bash
bun run start       # Start daemon
bun run dev         # Start daemon with hot reload
bun test            # Run test suite
bun run setup       # Setup configuration
bun run test:llm    # Test LLM providers
bun run examples    # Run integration examples
bun run db:init     # Initialize database
```

## Requirements

- **Bun** >= 1.0
- **TypeScript** >= 5.0
- At least one of:
  - Anthropic API key
  - OpenAI API key
  - Ollama (local installation)

## Installation

1. **Install Bun**:
   ```bash
   curl -fsSL https://bun.sh/install | bash
   ```

2. **Clone and Setup**:
   ```bash
   cd /home/vierisid/jarvis
   bun install
   bun run setup
   ```

3. **Configure**:
   Edit `~/.jarvis/config.yaml` with your API keys

4. **Test**:
   ```bash
   bun run test:llm
   ```

## Development Status

### Completed ✅
- LLM provider abstraction (Anthropic, OpenAI, Ollama)
- Configuration system with YAML support
- Multi-provider manager with fallback
- Streaming support for all providers
- Tool/function calling abstraction
- Type-safe interfaces throughout
- Test suites and examples

### In Progress 🚧
- Daemon WebSocket server
- SQLite vault for memory/state
- Role system implementation
- Agent framework
- Observer system
- Action implementations

### Planned 📋
- Web UI
- Voice interface
- Mobile app
- Plugin system
- Cloud sync
- Multi-user support

## Contributing

This is a personal project, but suggestions and feedback are welcome!

## License

Private project - All rights reserved

## Credits

Built with:
- [Bun](https://bun.sh/) - JavaScript runtime
- [TypeScript](https://www.typescriptlang.org/) - Type safety
- [Anthropic](https://www.anthropic.com/) - Claude API
- [OpenAI](https://openai.com/) - GPT API
- [Ollama](https://ollama.ai/) - Local models

---

*"Just A Really Versatile Intelligent System"*
