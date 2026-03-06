/**
 * Sidecar Client Protocol Types
 *
 * Mirrors brain's src/sidecar/protocol.ts + types.ts
 */

// ---- Capabilities ----

export type SidecarCapability =
  | 'terminal'
  | 'filesystem'
  | 'desktop'
  | 'browser'
  | 'clipboard'
  | 'screenshot'
  | 'system_info';

// ---- JWT Claims ----

export interface SidecarTokenClaims {
  sub: string;
  jti: string;
  sid: string;
  name: string;
  /** WebSocket URL for the brain */
  brain: string;
  /** JWKS public key URL */
  jwks: string;
  iat: number;
}

// ---- Brain → Sidecar ----

export interface RPCRequest {
  type: 'rpc_request';
  id: string;
  method: string;
  params: Record<string, unknown>;
}

// ---- Sidecar → Brain ----

export type EventPriority = 'critical' | 'high' | 'normal' | 'low';

export interface BinaryDataInline {
  type: 'inline';
  mime_type: string;
  data: string;
}

export interface SidecarEvent {
  type: 'rpc_result' | 'rpc_progress' | 'sidecar_event';
  event_type: string;
  timestamp: number;
  payload: Record<string, unknown>;
  priority?: EventPriority;
  binary?: BinaryDataInline;
}

// ---- Registration ----

export interface SidecarRegistration {
  type: 'register';
  hostname: string;
  os: string;
  platform: string;
  capabilities: SidecarCapability[];
}

// ---- Config ----

export interface SidecarConfig {
  token: string;
  capabilities: SidecarCapability[];
  terminal: {
    blocked_commands: string[];
    default_shell: string | null;
    timeout_ms: number;
  };
  filesystem: {
    blocked_paths: string[];
    max_file_size_kb: number;
  };
  browser: {
    cdp_port: number;
    profile_dir: string | null;
  };
}

// ---- Handler ----

export interface RPCResult {
  result: unknown;
  binary?: BinaryDataInline;
}

export type RPCHandler = (params: Record<string, unknown>) => Promise<RPCResult>;
