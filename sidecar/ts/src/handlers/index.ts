import type { RPCHandler, SidecarConfig, SidecarCapability } from '../types.js';
import { createTerminalHandler } from './terminal.js';
import { createReadFileHandler, createWriteFileHandler, createListDirectoryHandler } from './filesystem.js';
import { createGetClipboardHandler, createSetClipboardHandler } from './clipboard.js';
import { createScreenshotHandler } from './screenshot.js';
import { createSystemInfoHandler } from './system-info.js';

export function createHandlerRegistry(
  config: SidecarConfig,
): Map<string, RPCHandler> {
  const caps = new Set<SidecarCapability>(config.capabilities);
  const registry = new Map<string, RPCHandler>();

  if (caps.has('terminal')) {
    registry.set('run_command', createTerminalHandler(config));
  }
  if (caps.has('filesystem')) {
    registry.set('read_file', createReadFileHandler(config));
    registry.set('write_file', createWriteFileHandler(config));
    registry.set('list_directory', createListDirectoryHandler(config));
  }
  if (caps.has('clipboard')) {
    registry.set('get_clipboard', createGetClipboardHandler());
    registry.set('set_clipboard', createSetClipboardHandler());
  }
  if (caps.has('screenshot')) {
    registry.set('capture_screen', createScreenshotHandler());
  }
  if (caps.has('system_info')) {
    registry.set('get_system_info', createSystemInfoHandler());
  }

  return registry;
}
