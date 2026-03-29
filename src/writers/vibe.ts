import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join, dirname, resolve } from "node:path";
import TOML from "@iarna/toml";
import type { UnifiedMcpServer } from "../types.js";
import { expandEnvVars } from "../env.js";

const DEFAULT_VIBE_HOME = join(homedir(), ".vibe");

export function resolveVibeConfigPath(vibeHome?: string): string {
  const dir = resolve(vibeHome ?? DEFAULT_VIBE_HOME);
  return join(dir, "config.toml");
}

interface VibeTomlServer {
  name: string;
  transport: "stdio" | "http" | "streamable-http";
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  url?: string;
}

interface VibeTomlConfig {
  mcp_servers?: VibeTomlServer[];
  [key: string]: unknown;
}

export function writeToVibe(
  servers: UnifiedMcpServer[],
  dryRun: boolean,
  vibeHome?: string
): { added: string[]; skipped: string[]; configPath: string } {
  const added: string[] = [];
  const skipped: string[] = [];
  const configPath = resolveVibeConfigPath(vibeHome);
  const vibeDir = dirname(configPath);

  if (!existsSync(vibeDir)) {
    return {
      added: [],
      skipped: [
        `all ${servers.length} server(s) (${vibeDir} does not exist, please install Vibe CLI or use --vibe-home)`,
      ],
      configPath,
    };
  }

  let config: VibeTomlConfig = {};
  if (existsSync(configPath)) {
    const raw = readFileSync(configPath, "utf-8");
    if (raw.trim()) {
      config = TOML.parse(raw) as unknown as VibeTomlConfig;
    }
  }

  if (!config.mcp_servers || !Array.isArray(config.mcp_servers)) {
    config.mcp_servers = [];
  }

  const existingNames = new Set(config.mcp_servers.map((s) => s.name));

  for (const server of servers) {
    if (server.oauth && !server.command && !server.url) {
      skipped.push(`${server.name} (requires manual OAuth)`);
      continue;
    }

    if (existingNames.has(server.name)) {
      skipped.push(`${server.name} (already exists)`);
      continue;
    }

    const vibeServer = toVibeServer(server);
    if (!vibeServer) {
      skipped.push(`${server.name} (cannot convert)`);
      continue;
    }

    config.mcp_servers.push(vibeServer);
    added.push(server.name);
  }

  if (!dryRun && added.length > 0) {
    writeFileSync(configPath, TOML.stringify(config as TOML.JsonMap));
  }

  return { added, skipped, configPath };
}

function toVibeServer(server: UnifiedMcpServer): VibeTomlServer | null {
  if (server.transport === "stdio" && server.command) {
    const result: VibeTomlServer = {
      name: server.name,
      transport: "stdio",
      command: server.command,
    };
    if (server.args) result.args = server.args;
    if (server.env) result.env = server.env;
    return result;
  }

  if (server.transport === "http" && server.url) {
    return {
      name: server.name,
      transport: "streamable-http",
      url: expandEnvVars(server.url),
    };
  }

  if (server.transport === "sse" && server.url) {
    return {
      name: server.name,
      transport: "http",
      url: expandEnvVars(server.url),
    };
  }

  return null;
}
