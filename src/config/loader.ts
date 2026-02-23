import YAML from 'yaml';
import { join } from 'node:path';
import { homedir } from 'node:os';
import type { JarvisConfig } from './types.ts';
import { DEFAULT_CONFIG } from './types.ts';

function expandTilde(filepath: string): string {
  if (filepath.startsWith('~/')) {
    return join(homedir(), filepath.slice(2));
  }
  return filepath;
}

function deepMerge(target: any, source: any): any {
  if (!source || typeof source !== 'object') {
    return source !== undefined ? source : target;
  }

  if (Array.isArray(source)) {
    return source;
  }

  const result = { ...target };

  for (const key in source) {
    if (source.hasOwnProperty(key)) {
      if (
        source[key] &&
        typeof source[key] === 'object' &&
        !Array.isArray(source[key]) &&
        target[key] &&
        typeof target[key] === 'object' &&
        !Array.isArray(target[key])
      ) {
        result[key] = deepMerge(target[key], source[key]);
      } else {
        result[key] = source[key];
      }
    }
  }

  return result;
}

export async function loadConfig(configPath?: string): Promise<JarvisConfig> {
  const path = configPath || expandTilde('~/.jarvis/config.yaml');

  try {
    const file = Bun.file(path);
    const exists = await file.exists();

    if (!exists) {
      console.warn(`Config file not found at ${path}, using defaults`);
      const config = structuredClone(DEFAULT_CONFIG);
      config.daemon.data_dir = expandTilde(config.daemon.data_dir);
      config.daemon.db_path = expandTilde(config.daemon.db_path);
      return config;
    }

    const text = await file.text();
    const parsed = YAML.parse(text);

    // Deep merge with defaults to ensure all required fields exist
    const config = deepMerge(DEFAULT_CONFIG, parsed) as JarvisConfig;

    // Expand tilde in paths
    config.daemon.data_dir = expandTilde(config.daemon.data_dir);
    config.daemon.db_path = expandTilde(config.daemon.db_path);

    return config;
  } catch (err) {
    console.error(`Failed to load config from ${path}:`, err);
    return DEFAULT_CONFIG;
  }
}

export async function saveConfig(
  config: JarvisConfig,
  configPath?: string
): Promise<void> {
  const path = configPath || expandTilde('~/.jarvis/config.yaml');

  try {
    const yaml = YAML.stringify(config, {
      indent: 2,
      lineWidth: 100,
      defaultStringType: 'QUOTE_DOUBLE',
    });

    await Bun.write(path, yaml);
    console.log(`Config saved to ${path}`);
  } catch (err) {
    throw new Error(`Failed to save config to ${path}: ${err}`);
  }
}
