# Personality Engine & Vault Extractor

This document provides an overview of the newly implemented Personality Engine and Vault Extractor modules for Project J.A.R.V.I.S.

## Overview

Two powerful systems that work together to create an adaptive, intelligent AI assistant:

1. **Personality Engine**: Learns user preferences and adapts communication style
2. **Vault Extractor**: Extracts and stores knowledge from conversations

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     USER INTERACTION                        │
└────────────────────────┬────────────────────────────────────┘
                         │
         ┌───────────────┴───────────────┐
         │                               │
         ▼                               ▼
┌─────────────────┐            ┌──────────────────┐
│   PERSONALITY   │            │  VAULT EXTRACTOR │
│     ENGINE      │            │                  │
├─────────────────┤            ├──────────────────┤
│ • Learn prefs   │            │ • Extract facts  │
│ • Adapt style   │            │ • Store entities │
│ • Build trust   │            │ • Track commits  │
│ • Gen prompts   │            │ • Map relations  │
└────────┬────────┘            └────────┬─────────┘
         │                               │
         │    ┌──────────────────┐      │
         └───▶│   KNOWLEDGE      │◀─────┘
              │      VAULT       │
              │   (SQLite DB)    │
              └──────────────────┘
```

## File Structure

```
src/
├── personality/                 # Personality Engine
│   ├── model.ts                # State management
│   ├── learner.ts              # Signal extraction
│   ├── adapter.ts              # Channel adaptation
│   ├── index.ts                # Public API
│   ├── personality.test.ts     # Tests
│   └── README.md
│
├── vault/                      # Knowledge Vault
│   ├── schema.ts               # Database schema
│   ├── entities.ts             # Entity CRUD
│   ├── facts.ts                # Fact storage
│   ├── relationships.ts        # Relationship management
│   ├── commitments.ts          # Task tracking
│   ├── observations.ts         # Event storage
│   ├── vectors.ts              # Embeddings
│   ├── extractor.ts            # LLM extraction ⭐ NEW
│   ├── extractor.test.ts       # Extractor tests ⭐ NEW
│   ├── index.ts                # Public API
│   └── README.md
│
├── llm/                        # LLM Providers
│   ├── provider.ts             # LLM interface
│   └── anthropic.ts            # Anthropic impl
│
docs/
├── PERSONALITY_ENGINE.md       # Personality docs ⭐ NEW
└── VAULT_EXTRACTOR.md          # Extractor docs ⭐ NEW

examples/
├── personality-demo.ts         # Personality demo ⭐ NEW
├── extractor-demo.ts          # Extractor demo ⭐ NEW
└── full-integration.ts        # Full demo ⭐ NEW

data/
└── jarvis.db                   # SQLite database
```

## Installation & Setup

### 1. Database Initialization

```typescript
import { initDatabase } from '@/vault/schema';

// For production
initDatabase('./data/jarvis.db');

// For testing
initDatabase(':memory:');
```

### 2. Run Tests

```bash
# Test personality engine
bun test src/personality/personality.test.ts

# Test vault extractor
bun test src/vault/extractor.test.ts

# Test all
bun test src/**/*.test.ts
```

### 3. Run Demos

```bash
# Personality engine demo
bun run examples/personality-demo.ts

# Vault extractor demo
bun run examples/extractor-demo.ts

# Full integration demo
bun run examples/full-integration.ts
```

## Quick Start Guide

### Basic Message Handler

```typescript
import { initDatabase } from '@/vault/schema';
import {
  getPersonality,
  savePersonality,
  extractSignals,
  applySignals,
  recordInteraction,
  personalityToPrompt,
} from '@/personality';
import { extractAndStore } from '@/vault';
import type { LLMProvider } from '@/llm/provider';

// Initialize
initDatabase('./data/jarvis.db');

async function handleMessage(
  userMessage: string,
  llm: LLMProvider
): Promise<string> {
  // 1. Get personality
  let personality = getPersonality();

  // 2. Generate personality-aware prompt
  const systemPrompt = personalityToPrompt(personality);

  // 3. Call LLM
  const response = await llm.chat([
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userMessage },
  ]);

  // 4. Learn from interaction
  const signals = extractSignals(userMessage, response.content);
  personality = applySignals(personality, signals);
  personality = recordInteraction(personality);
  savePersonality(personality);

  // 5. Extract knowledge
  await extractAndStore(userMessage, response.content, llm);

  return response.content;
}
```

## Key Features

### Personality Engine

✅ **Adaptive Learning**
- Detects verbosity preferences ("brief", "more detail")
- Adjusts formality ("casual", "formal")
- Learns emoji usage patterns
- Adapts output format (lists, prose, tables)

✅ **Channel Adaptation**
- WhatsApp: casual, brief, emoji-friendly
- Email: formal, detailed, professional
- Terminal: adaptive, balanced

✅ **Trust Building**
- Trust level grows with interaction count
- Formula: `trust = 3 + floor(messages / 10)`
- Caps at 10/10 after 100+ messages

✅ **LLM Integration**
- Generates personality prompts for system messages
- Includes traits, preferences, relationship context

### Vault Extractor

✅ **Automatic Extraction**
- Entities (person, project, tool, place, concept, event)
- Facts (attributes with confidence scores)
- Relationships (typed connections)
- Commitments (promises, tasks, reminders)

✅ **LLM-Powered**
- Works with any LLM provider
- Uses specialized extraction prompts
- Handles JSON parsing and errors gracefully

✅ **Deduplication**
- Reuses existing entities automatically
- Maintains graph integrity
- Prevents duplicate storage

✅ **Confidence Tracking**
- 1.0: Explicitly stated facts
- 0.8-0.9: Strongly implied
- 0.5-0.7: Weakly implied
- < 0.5: Speculative

## API Reference

### Personality Engine

```typescript
// Model
getPersonality(): PersonalityModel
savePersonality(model: PersonalityModel): void
updatePersonality(updates: DeepPartial<PersonalityModel>): PersonalityModel

// Learner
extractSignals(userMsg: string, assistantMsg: string): InteractionSignal[]
applySignals(personality: PersonalityModel, signals: InteractionSignal[]): PersonalityModel
recordInteraction(personality: PersonalityModel): PersonalityModel

// Adapter
getChannelPersonality(personality: PersonalityModel, channel: string): PersonalityModel
personalityToPrompt(personality: PersonalityModel): string
```

### Vault Extractor

```typescript
// Extraction
buildExtractionPrompt(userMsg: string, assistantMsg: string): string
parseExtractionResponse(llmResponse: string): ExtractionResult
extractAndStore(
  userMsg: string,
  assistantMsg: string,
  provider?: LLMProvider
): Promise<ExtractionResult>

// Vault queries (existing)
findEntities(query: { type?, name?, nameContains? }): Entity[]
findFacts(query: { subject_id?, predicate?, object? }): Fact[]
findRelationships(query: { from_id?, to_id?, type? }): Relationship[]
findCommitments(query: { status?, priority?, assigned_to?, overdue? }): Commitment[]
```

## Testing

### Test Coverage

- **Personality Engine**: 16 tests, 40 assertions
- **Vault Extractor**: 12 tests, 39 assertions
- **Total**: 28 tests, 79 assertions

### Run Tests

```bash
# All tests
bun test

# Specific module
bun test src/personality/personality.test.ts
bun test src/vault/extractor.test.ts
```

## Performance Considerations

### Personality Engine

- **Speed**: Milliseconds (in-memory operations)
- **Storage**: ~1KB per personality state
- **Memory**: Minimal (single JSON object)

### Vault Extractor

- **LLM Cost**: ~$0.001-0.01 per extraction
- **Speed**: Depends on LLM latency (1-5 seconds)
- **Storage**: ~1-10KB per conversation
- **Optimization**: Use background workers for extraction

## Best Practices

### 1. Regular Updates

```typescript
// After every message
personality = recordInteraction(personality);
savePersonality(personality);
```

### 2. Background Extraction

```typescript
// Queue extraction, don't block response
await Promise.all([
  sendResponse(response),
  extractAndStore(userMsg, response, llm),
]);
```

### 3. Channel Context

```typescript
// Always adapt for channel
const adapted = getChannelPersonality(personality, channel);
const prompt = personalityToPrompt(adapted);
```

### 4. Error Handling

```typescript
// Extractor handles errors gracefully
const result = await extractAndStore(msg1, msg2, llm);
// Returns empty result on error, never throws
```

## Documentation

- **[Personality Engine](docs/PERSONALITY_ENGINE.md)**: Complete guide
- **[Vault Extractor](docs/VAULT_EXTRACTOR.md)**: Extraction system
- **[Vault README](src/vault/README.md)**: Knowledge graph
- **[Personality README](src/personality/README.md)**: Quick reference

## Examples

All examples are runnable:

```bash
# Learn personality preferences
bun run examples/personality-demo.ts

# Extract knowledge from conversations
bun run examples/extractor-demo.ts

# Full integration (personality + extraction)
bun run examples/full-integration.ts
```

## Integration with J.A.R.V.I.S.

### Message Flow

1. **Receive** user message from communication layer
2. **Load** personality and adapt for channel
3. **Generate** personality-aware system prompt
4. **Call** LLM with personalized prompt
5. **Extract** preference signals from conversation
6. **Update** personality based on signals
7. **Extract** knowledge using LLM
8. **Store** entities, facts, relationships, commitments
9. **Return** response to user

### Agent Integration

```typescript
// In agent message handler
import { handleMessage } from './message-handler';

agent.on('message', async (msg) => {
  const response = await handleMessage(msg.content, msg.channel);
  await msg.reply(response);
});
```

### Background Workers

```typescript
// Daemon process for background extraction
import { getUnprocessed, markProcessed } from '@/vault';
import { extractAndStore } from '@/vault';

setInterval(async () => {
  const observations = getUnprocessed();

  for (const obs of observations) {
    const { user_msg, assistant_msg } = JSON.parse(obs.data);
    await extractAndStore(user_msg, assistant_msg, llm);
    markProcessed(obs.id);
  }
}, 5000);
```

## Future Enhancements

### Personality Engine
- [ ] Sentiment analysis
- [ ] Multi-user profiles
- [ ] A/B testing
- [ ] Personality versioning
- [ ] Advanced signal detection with LLMs

### Vault Extractor
- [ ] Multi-turn context extraction
- [ ] Confidence-based verification
- [ ] Entity disambiguation
- [ ] Automatic entity merging
- [ ] Fine-tuned extraction models
- [ ] Streaming extraction

## Support

For questions or issues:
1. Check the documentation in `docs/`
2. Review the examples in `examples/`
3. Run the test suite to verify setup
4. Check the module READMEs in `src/*/README.md`

## Summary

The Personality Engine and Vault Extractor are production-ready modules that provide:

✅ Adaptive, personalized communication
✅ Automatic knowledge extraction and storage
✅ Channel-specific personality adaptation
✅ LLM integration for intelligent extraction
✅ Comprehensive test coverage (28 tests)
✅ Full documentation and examples
✅ SQLite-based persistent storage
✅ TypeScript type safety throughout

These modules are the foundation for J.A.R.V.I.S. to become a truly intelligent, adaptive assistant that learns from every interaction and builds a rich knowledge graph over time.
