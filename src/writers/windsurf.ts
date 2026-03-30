import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { convertEnvVarSyntax } from "../env.js";
import type { UnifiedMcpServer } from "../types.js";

const DEFAULT_WINDSURF_HOME = join(homedir(), ".codeium", "windsurf");

export function resolveWindsurfMcpConfigPath(windsurfHome?: string): string {
  const dir = resolve(windsurfHome ?? DEFAULT_WINDSURF_HOME);
  return join(dir, "mcp_config.json");
}

interface WindsurfMcpServer {
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  serverUrl?: string;
  headers?: Record<string, string>;
}

interface WindsurfConfig {
  mcpServers?: Record<string, WindsurfMcpServer>;
  [key: string]: unknown;
}

export function writeToWindsurf(
  servers: UnifiedMcpServer[],
  dryRun: boolean,
  windsurfHome?: string
): { added: string[]; skipped: string[]; configPath: string } {
  const added: string[] = [];
  const skipped: string[] = [];
  const configPath = resolveWindsurfMcpConfigPath(windsurfHome);
  const wsDir = dirname(configPath);

  if (!existsSync(wsDir)) {
    return {
      added: [],
      skipped: [
        `all ${servers.length} server(s) (${wsDir} does not exist, please install Windsurf or use --windsurf-home)`,
      ],
      configPath,
    };
  }

  let config: WindsurfConfig = {};
  if (existsSync(configPath)) {
    try {
      config = JSON.parse(readFileSync(configPath, "utf-8"));
    } catch {
      // skip malformed config
    }
  }

  const existing = config.mcpServers ?? {};

  for (const server of servers) {
    if (server.oauth && !server.command && !server.url) {
      skipped.push(`${server.name} (requires manual OAuth)`);
      continue;
    }

    const wsServer = toWindsurfServer(server);
    if (!wsServer) {
      skipped.push(`${server.name} (cannot convert)`);
      continue;
    }

    if (existing[server.name]) {
      skipped.push(`${server.name} (already exists)`);
      continue;
    }

    existing[server.name] = wsServer;
    added.push(server.name);
  }

  config.mcpServers = existing;

  if (!dryRun && added.length > 0) {
    writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n");
  }

  return { added, skipped, configPath };
}

function toWindsurfServer(server: UnifiedMcpServer): WindsurfMcpServer | null {
  if (server.transport === "stdio" && server.command) {
    return {
      command: server.command,
      ...(server.args && { args: server.args }),
      ...(server.env && { env: convertEnvVarSyntax(server.env, (v) => `\${env:${v}}`) }),
    };
  }

  // Windsurf uses serverUrl for both HTTP and SSE remote servers
  if ((server.transport === "http" || server.transport === "sse") && server.url) {
    return {
      serverUrl: server.url,
      ...(server.headers && { headers: server.headers }),
    };
  }

  return null;
}
