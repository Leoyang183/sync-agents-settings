// ===== Claude Code MCP Config Types =====

export interface ClaudeMcpServer {
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  type?: "http" | "sse";
  url?: string;
  headers?: Record<string, string>;
  oauth?: {
    clientId: string;
    callbackPort?: number;
  };
  description?: string;
}

/** Plugin .mcp.json can be either flat or nested under mcpServers */
export type PluginMcpJson =
  | Record<string, ClaudeMcpServer>
  | { mcpServers: Record<string, ClaudeMcpServer> };

export interface ClaudeSettings {
  enabledPlugins?: Record<string, boolean>;
  mcpServers?: Record<string, ClaudeMcpServer>;
  [key: string]: unknown;
}

// ===== Gemini CLI MCP Config Types =====

export interface GeminiMcpServer {
  command?: string;
  args?: string[];
  cwd?: string;
  env?: Record<string, string>;
  url?: string; // SSE
  httpUrl?: string; // HTTP streamable
  headers?: Record<string, string>;
  timeout?: number;
  trust?: boolean;
  oauth?: {
    enabled?: boolean;
    clientId?: string;
    clientSecret?: string;
    authorizationUrl?: string;
    tokenUrl?: string;
    scopes?: string[];
    redirectUri?: string;
  };
}

export interface GeminiSettings {
  mcpServers?: Record<string, GeminiMcpServer>;
  [key: string]: unknown;
}

// ===== OpenCode MCP Config Types =====

export interface OpenCodeMcpServer {
  type: "local" | "remote";
  command?: string[];
  environment?: Record<string, string>;
  url?: string;
  headers?: Record<string, string>;
  oauth?: Record<string, unknown> | false;
  enabled?: boolean;
  timeout?: number;
}

export interface OpenCodeConfig {
  mcp?: Record<string, OpenCodeMcpServer>;
  [key: string]: unknown;
}

// ===== Unified MCP Server =====

export type McpTransport = "stdio" | "http" | "sse";

export interface UnifiedMcpServer {
  name: string;
  transport: McpTransport;
  source: "claude-config" | "claude-plugin";
  // stdio fields
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  // http/sse fields
  url?: string;
  headers?: Record<string, string>;
  oauth?: Record<string, unknown>;
}

// ===== Qwen Code MCP Config Types =====

export interface QwenMcpServer {
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  url?: string; // SSE
  httpUrl?: string; // HTTP streamable
  headers?: Record<string, string>;
}

export interface QwenSettings {
  mcpServers?: Record<string, QwenMcpServer>;
  [key: string]: unknown;
}

// ===== Amp MCP Config Types =====

export interface AmpMcpServer {
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  url?: string;
  headers?: Record<string, string>;
}

export interface AmpSettings {
  "amp.mcpServers"?: Record<string, AmpMcpServer>;
  [key: string]: unknown;
}

// ===== Sync Options =====

export type SyncTarget =
  | "gemini"
  | "codex"
  | "opencode"
  | "kiro"
  | "cursor"
  | "kimi"
  | "vibe"
  | "qwen"
  | "amp"
  | "cline";
