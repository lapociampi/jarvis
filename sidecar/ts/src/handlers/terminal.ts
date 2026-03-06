import { exec } from 'node:child_process';
import type { RPCHandler, SidecarConfig } from '../types.js';

export function createTerminalHandler(config: SidecarConfig): RPCHandler {
  return async (params) => {
    const command = params.command as string;
    if (!command) throw new Error('Missing required parameter: command');

    const cwd = (params.cwd as string) || process.cwd();
    const timeout = (params.timeout as number) || config.terminal.timeout_ms;

    // Check blocked commands
    for (const blocked of config.terminal.blocked_commands) {
      if (command.includes(blocked)) {
        return { result: { stdout: '', stderr: `Command blocked: ${blocked}`, exit_code: 1 } };
      }
    }

    const shell = config.terminal.default_shell || undefined;

    return new Promise((resolve) => {
      exec(command, { cwd, timeout, shell, maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
        resolve({
          result: {
            stdout: stdout || '',
            stderr: stderr || '',
            exit_code: error ? (error.code ?? 1) : 0,
          },
        });
      });
    });
  };
}
