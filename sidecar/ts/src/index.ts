#!/usr/bin/env node

import { loadConfig, saveConfig } from './config.js';
import { SidecarClient } from './client.js';

function printUsage(): void {
  console.log(`
jarvis-sidecar — Jarvis sidecar client

Usage:
  jarvis-sidecar --token <jwt>    Enroll and start (saves token to config)
  jarvis-sidecar                  Start using saved token
  jarvis-sidecar --help           Show this help

Options:
  --token <jwt>    JWT enrollment token from the brain
  --help           Show help
`);
}

function main(): void {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    printUsage();
    process.exit(0);
  }

  const config = loadConfig();

  const tokenIdx = args.indexOf('--token');
  if (tokenIdx !== -1) {
    const token = args[tokenIdx + 1];
    if (!token) {
      console.error('Error: --token requires a value');
      process.exit(1);
    }
    config.token = token;
    saveConfig(config);
    console.log('[sidecar] Token saved to config');
  }

  if (!config.token) {
    console.error('Error: No token configured. Run with --token <jwt> first.');
    process.exit(1);
  }

  const client = new SidecarClient(config);

  process.on('SIGINT', () => {
    console.log('\n[sidecar] Shutting down...');
    client.stop();
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    client.stop();
    process.exit(0);
  });

  client.start();
}

main();
