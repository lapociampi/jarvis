import * as os from 'node:os';
import type { RPCHandler } from '../types.js';

export function createSystemInfoHandler(): RPCHandler {
  return async () => {
    return {
      result: {
        hostname: os.hostname(),
        platform: os.platform(),
        arch: os.arch(),
        cpus: os.cpus().length,
        memory: {
          total: os.totalmem(),
          free: os.freemem(),
        },
        uptime: os.uptime(),
        node_version: process.version,
      },
    };
  };
}
