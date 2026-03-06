import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { parse, stringify } from 'yaml';
import type { SidecarConfig } from './types.js';

const CONFIG_DIR = path.join(os.homedir(), '.jarvis-sidecar');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.yaml');

const DEFAULT_CONFIG: SidecarConfig = {
  token: '',
  capabilities: ['terminal', 'filesystem', 'clipboard', 'screenshot', 'system_info'],
  terminal: {
    blocked_commands: [],
    default_shell: null,
    timeout_ms: 30_000,
  },
  filesystem: {
    blocked_paths: [],
    max_file_size_kb: 100,
  },
  browser: {
    cdp_port: 9222,
    profile_dir: null,
  },
};

export function loadConfig(): SidecarConfig {
  if (!fs.existsSync(CONFIG_FILE)) {
    return { ...DEFAULT_CONFIG };
  }
  const raw = fs.readFileSync(CONFIG_FILE, 'utf-8');
  const parsed = parse(raw) as Partial<SidecarConfig>;
  return {
    ...DEFAULT_CONFIG,
    ...parsed,
    terminal: { ...DEFAULT_CONFIG.terminal, ...parsed.terminal },
    filesystem: { ...DEFAULT_CONFIG.filesystem, ...parsed.filesystem },
    browser: { ...DEFAULT_CONFIG.browser, ...parsed.browser },
  };
}

export function saveConfig(config: SidecarConfig): void {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  fs.writeFileSync(CONFIG_FILE, stringify(config), 'utf-8');
}

/** Decode JWT payload without verification (brain verifies) */
export function decodeJwtPayload<T>(token: string): T {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Invalid JWT format');
  const payload = parts[1]!;
  const padded = payload.replace(/-/g, '+').replace(/_/g, '/');
  const json = Buffer.from(padded, 'base64').toString('utf-8');
  return JSON.parse(json) as T;
}
