import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { createReadFileHandler, createWriteFileHandler, createListDirectoryHandler } from '../src/handlers/filesystem.js';
import type { SidecarConfig } from '../src/types.js';

const tmpDir = path.join(os.tmpdir(), `jarvis-test-${Date.now()}`);

const config: SidecarConfig = {
  token: '',
  capabilities: ['filesystem'],
  terminal: { blocked_commands: [], default_shell: null, timeout_ms: 5000 },
  filesystem: { blocked_paths: ['/etc/shadow'], max_file_size_kb: 1 },
  browser: { cdp_port: 9222, profile_dir: null },
};

beforeAll(() => fs.mkdirSync(tmpDir, { recursive: true }));
afterAll(() => fs.rmSync(tmpDir, { recursive: true, force: true }));

describe('filesystem handlers', () => {
  const readFile = createReadFileHandler(config);
  const writeFile = createWriteFileHandler(config);
  const listDir = createListDirectoryHandler(config);

  test('write and read a file', async () => {
    const filePath = path.join(tmpDir, 'test.txt');
    await writeFile({ path: filePath, content: 'hello world' });
    const { result } = await readFile({ path: filePath });
    expect((result as { content: string }).content).toBe('hello world');
  });

  test('list directory', async () => {
    const { result } = await listDir({ path: tmpDir });
    const entries = (result as { entries: { name: string }[] }).entries;
    expect(entries.some((e) => e.name === 'test.txt')).toBe(true);
  });

  test('rejects files over max size', async () => {
    const bigFile = path.join(tmpDir, 'big.txt');
    fs.writeFileSync(bigFile, 'x'.repeat(2048));
    expect(readFile({ path: bigFile })).rejects.toThrow('exceeds max size');
  });

  test('rejects blocked paths', async () => {
    expect(readFile({ path: '/etc/shadow' })).rejects.toThrow('blocked');
  });
});
