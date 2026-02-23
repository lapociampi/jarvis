/**
 * Observer Service — The Eyes
 *
 * Wraps ObserverManager. Registers system observers (file watcher,
 * clipboard monitor, process monitor) and routes events to the vault.
 */

import type { Service, ServiceStatus } from './services.ts';
import type { ObserverEvent } from '../observers/index.ts';
import type { ObservationType } from '../vault/observations.ts';

import {
  ObserverManager,
  FileWatcher,
  ClipboardMonitor,
  ProcessMonitor,
} from '../observers/index.ts';
import { createObservation } from '../vault/observations.ts';

/**
 * Map observer event types to vault observation types.
 */
function mapEventType(eventType: string): ObservationType {
  switch (eventType) {
    case 'file_change':
      return 'file_change';
    case 'clipboard':
      return 'clipboard';
    case 'process_started':
    case 'process_stopped':
      return 'process';
    case 'notification':
      return 'notification';
    case 'calendar':
      return 'calendar';
    case 'email':
      return 'email';
    case 'browser':
      return 'browser';
    default:
      return 'app_activity';
  }
}

export class ObserverService implements Service {
  name = 'observers';
  private _status: ServiceStatus = 'stopped';
  private manager: ObserverManager;

  constructor() {
    this.manager = new ObserverManager();
  }

  async start(): Promise<void> {
    this._status = 'starting';

    try {
      // Register observers
      this.manager.register(new FileWatcher());
      this.manager.register(new ClipboardMonitor());
      this.manager.register(new ProcessMonitor());

      // Set event handler to store observations in vault
      this.manager.setEventHandler((event: ObserverEvent) => {
        try {
          const obsType = mapEventType(event.type);
          createObservation(obsType, event.data);
        } catch (err) {
          console.error('[ObserverService] Error storing observation:', err);
        }
      });

      // Start all observers (individual failures don't crash the service)
      await this.manager.startAll();

      this._status = 'running';
      console.log('[ObserverService] Started');
    } catch (error) {
      this._status = 'error';
      throw error;
    }
  }

  async stop(): Promise<void> {
    this._status = 'stopping';
    await this.manager.stopAll();
    this._status = 'stopped';
    console.log('[ObserverService] Stopped');
  }

  status(): ServiceStatus {
    return this._status;
  }
}
