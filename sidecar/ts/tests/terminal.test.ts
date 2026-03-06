import { describe, test, expect } from 'bun:test';
import { createTerminalHandler } from '../src/handlers/terminal.js';
import type { SidecarConfig } from '../src/types.js';

const config: SidecarConfig = {
  token: '',
  capabilities: ['terminal'],
  terminal: { blocked_commands: ['rm -rf /'], default_shell: null, timeout_ms: 5000 },
  filesystem: { blocked_paths: [], max_file_size_kb: 100 },
  browser: { cdp_port: 9222, profile_dir: null },
};

describe('terminal handler', () => {
  const handler = createTerminalHandler(config);

  test('runs a simple command', async () => {
    const { result } = await handler({ command: 'echo hello' });
    const r = result as { stdout: string; stderr: string; exit_code: number };
    expect(r.stdout.trim()).toBe('hello');
    expect(r.exit_code).toBe(0);
  });

  test('returns exit code on failure', async () => {
    const { result } = await handler({ command: 'false' });
    const r = result as { exit_code: number };
    expect(r.exit_code).not.toBe(0);
  });

  test('blocks disallowed commands', async () => {
    const { result } = await handler({ command: 'rm -rf /' });
    const r = result as { stderr: string; exit_code: number };
    expect(r.exit_code).toBe(1);
    expect(r.stderr).toContain('blocked');
  });

  test('throws on missing command', async () => {
    expect(handler({})).rejects.toThrow('Missing required parameter');
  });
});
