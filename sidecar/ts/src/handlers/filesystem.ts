import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type { RPCHandler, SidecarConfig } from '../types.js';

function isBlocked(filePath: string, blockedPaths: string[]): boolean {
  const resolved = path.resolve(filePath);
  return blockedPaths.some((bp) => resolved.startsWith(path.resolve(bp)));
}

export function createReadFileHandler(config: SidecarConfig): RPCHandler {
  return async (params) => {
    const filePath = params.path as string;
    if (!filePath) throw new Error('Missing required parameter: path');
    if (isBlocked(filePath, config.filesystem.blocked_paths)) {
      throw new Error(`Path is blocked: ${filePath}`);
    }

    const stat = await fs.stat(filePath);
    if (stat.size > config.filesystem.max_file_size_kb * 1024) {
      throw new Error(`File exceeds max size of ${config.filesystem.max_file_size_kb}KB`);
    }

    const content = await fs.readFile(filePath, 'utf-8');
    return { result: { content } };
  };
}

export function createWriteFileHandler(config: SidecarConfig): RPCHandler {
  return async (params) => {
    const filePath = params.path as string;
    const content = params.content as string;
    if (!filePath) throw new Error('Missing required parameter: path');
    if (content === undefined) throw new Error('Missing required parameter: content');
    if (isBlocked(filePath, config.filesystem.blocked_paths)) {
      throw new Error(`Path is blocked: ${filePath}`);
    }

    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, content, 'utf-8');
    return { result: { success: true } };
  };
}

export function createListDirectoryHandler(config: SidecarConfig): RPCHandler {
  return async (params) => {
    const dirPath = params.path as string;
    if (!dirPath) throw new Error('Missing required parameter: path');
    if (isBlocked(dirPath, config.filesystem.blocked_paths)) {
      throw new Error(`Path is blocked: ${dirPath}`);
    }

    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    const results = await Promise.all(
      entries.map(async (entry) => {
        const fullPath = path.join(dirPath, entry.name);
        try {
          const stat = await fs.stat(fullPath);
          return {
            name: entry.name,
            type: entry.isDirectory() ? 'directory' : 'file',
            size: stat.size,
          };
        } catch {
          return { name: entry.name, type: entry.isDirectory() ? 'directory' : 'file', size: 0 };
        }
      }),
    );
    return { result: { entries: results } };
  };
}
