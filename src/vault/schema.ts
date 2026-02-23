import { Database } from "bun:sqlite";

let dbInstance: Database | null = null;

/**
 * Generate a short unique ID for database records
 */
export function generateId(): string {
  return crypto.randomUUID();
}

/**
 * Get the current database instance (singleton)
 * @throws Error if database has not been initialized
 */
export function getDb(): Database {
  if (!dbInstance) {
    throw new Error(
      "Database not initialized. Call initDatabase() first."
    );
  }
  return dbInstance;
}

/**
 * Close the database connection
 */
export function closeDb(): void {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}

/**
 * Initialize the SQLite database with all required tables
 * @param dbPath - Path to the database file. Defaults to :memory: for testing
 * @returns Database instance
 */
export function initDatabase(dbPath: string = ":memory:"): Database {
  try {
    // Close existing connection if any
    closeDb();

    // Create new database connection
    dbInstance = new Database(dbPath, { create: true });

    // Enable WAL mode for better concurrency
    dbInstance.exec("PRAGMA journal_mode=WAL");

    // Enable foreign key constraints
    dbInstance.exec("PRAGMA foreign_keys=ON");

    // Create all tables
    createTables(dbInstance);

    console.log(`Database initialized at: ${dbPath}`);
    return dbInstance;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to initialize database: ${message}`);
  }
}

/**
 * Create all database tables and indexes
 */
function createTables(db: Database): void {
  // Entities table: people, places, projects, tools, concepts
  db.exec(`
    CREATE TABLE IF NOT EXISTS entities (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      name TEXT NOT NULL,
      properties TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      source TEXT,
      CHECK(type IN ('person', 'project', 'tool', 'place', 'concept', 'event'))
    )
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_entities_type ON entities(type)
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_entities_name ON entities(name)
  `);

  // Facts table: atomic pieces of knowledge with confidence
  db.exec(`
    CREATE TABLE IF NOT EXISTS facts (
      id TEXT PRIMARY KEY,
      subject_id TEXT NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
      predicate TEXT NOT NULL,
      object TEXT NOT NULL,
      confidence REAL DEFAULT 1.0,
      source TEXT,
      created_at INTEGER NOT NULL,
      verified_at INTEGER,
      CHECK(confidence >= 0.0 AND confidence <= 1.0)
    )
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_facts_subject ON facts(subject_id)
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_facts_predicate ON facts(predicate)
  `);

  // Relationships table: edges between entities
  db.exec(`
    CREATE TABLE IF NOT EXISTS relationships (
      id TEXT PRIMARY KEY,
      from_id TEXT NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
      to_id TEXT NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      properties TEXT,
      created_at INTEGER NOT NULL
    )
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_rel_from ON relationships(from_id)
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_rel_to ON relationships(to_id)
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_rel_type ON relationships(type)
  `);

  // Commitments table: things the AI promised to do
  db.exec(`
    CREATE TABLE IF NOT EXISTS commitments (
      id TEXT PRIMARY KEY,
      what TEXT NOT NULL,
      when_due INTEGER,
      context TEXT,
      priority TEXT DEFAULT 'normal' CHECK(priority IN ('low','normal','high','critical')),
      status TEXT DEFAULT 'pending' CHECK(status IN ('pending','active','completed','failed','escalated')),
      retry_policy TEXT,
      created_from TEXT,
      assigned_to TEXT,
      created_at INTEGER NOT NULL,
      completed_at INTEGER,
      result TEXT
    )
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_commitments_status ON commitments(status)
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_commitments_due ON commitments(when_due)
  `);

  // Observations table: raw events from the observation layer
  db.exec(`
    CREATE TABLE IF NOT EXISTS observations (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      data TEXT NOT NULL,
      processed INTEGER DEFAULT 0,
      created_at INTEGER NOT NULL,
      CHECK(processed IN (0, 1))
    )
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_obs_type ON observations(type)
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_obs_processed ON observations(processed)
  `);

  // Vectors table: embeddings for semantic search
  db.exec(`
    CREATE TABLE IF NOT EXISTS vectors (
      id TEXT PRIMARY KEY,
      ref_type TEXT,
      ref_id TEXT,
      embedding BLOB,
      model TEXT,
      created_at INTEGER NOT NULL
    )
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_vectors_ref ON vectors(ref_type, ref_id)
  `);

  // Agent messages table: inter-agent communication
  db.exec(`
    CREATE TABLE IF NOT EXISTS agent_messages (
      id TEXT PRIMARY KEY,
      from_agent TEXT NOT NULL,
      to_agent TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('task','report','question','escalation')),
      content TEXT NOT NULL,
      priority TEXT DEFAULT 'normal' CHECK(priority IN ('low','normal','high','urgent')),
      requires_response INTEGER DEFAULT 0,
      deadline INTEGER,
      created_at INTEGER NOT NULL,
      CHECK(requires_response IN (0, 1))
    )
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_msg_to ON agent_messages(to_agent)
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_msg_from ON agent_messages(from_agent)
  `);

  // Personality state table
  db.exec(`
    CREATE TABLE IF NOT EXISTS personality_state (
      id TEXT PRIMARY KEY DEFAULT 'default',
      data TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `);

  // Conversations table: context tracking
  db.exec(`
    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,
      agent_id TEXT,
      channel TEXT,
      started_at INTEGER NOT NULL,
      last_message_at INTEGER NOT NULL,
      message_count INTEGER DEFAULT 0,
      metadata TEXT,
      CHECK(message_count >= 0)
    )
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_conversations_agent ON conversations(agent_id)
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_conversations_channel ON conversations(channel)
  `);
}
