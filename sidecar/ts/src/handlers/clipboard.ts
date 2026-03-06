import { exec } from 'node:child_process';
import * as os from 'node:os';
import type { RPCHandler } from '../types.js';

function run(cmd: string, input?: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = exec(cmd, { timeout: 5000 }, (err, stdout) => {
      if (err) reject(err);
      else resolve(stdout);
    });
    if (input !== undefined) {
      proc.stdin?.write(input);
      proc.stdin?.end();
    }
  });
}

export function createGetClipboardHandler(): RPCHandler {
  return async () => {
    const platform = os.platform();
    let content: string;
    if (platform === 'darwin') {
      content = await run('pbpaste');
    } else if (platform === 'win32') {
      content = await run('powershell -command "Get-Clipboard"');
    } else {
      content = await run('xclip -selection clipboard -o');
    }
    return { result: { content } };
  };
}

export function createSetClipboardHandler(): RPCHandler {
  return async (params) => {
    const content = params.content as string;
    if (content === undefined) throw new Error('Missing required parameter: content');

    const platform = os.platform();
    if (platform === 'darwin') {
      await run('pbcopy', content);
    } else if (platform === 'win32') {
      await run(`powershell -command "Set-Clipboard -Value '${content.replace(/'/g, "''")}'"`);
    } else {
      await run('xclip -selection clipboard', content);
    }
    return { result: { success: true } };
  };
}
