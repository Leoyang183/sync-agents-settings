import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { convertEnvVarSyntax } from "../env.js";
import type { QwenMcpServer, QwenSettings, UnifiedMcpServer } from "../types.js";

const DEFAULT_QWEN_HOME = join(homedir(), ".qwen");

export function resolveQwenSettingsPath(qwenHome?: string): string {
  const dir = resolve(qwenHome ?? DEFAULT_QWEN_HOME);
  return join(dir, "settings.json");
}

export function writeToQwen(
  servers: UnifiedMcpServer[],
  dryRun: boolean,
  qwenHome?: string
): { added: string[]; skipped: string[]; configPath: string } {
  const added: string[] = [];
  const skipped: string[] = [];
  const configPath = resolveQwenSettingsPath(qwenHome);
  const qwenDir = dirname(configPath);

  if (!existsSync(qwenDir)) {
    return {
      added: [],
      skipped: [
        `all ${servers.length} server(s) (${qwenDir} does not exist, please install Qwen Code or use --qwen-home)`,
      ],
      configPath,
    };
  }

  let settings: QwenSettings = {};
  if (existsSync(configPath)) {
    try {
      settings = JSON.parse(readFileSync(configPath, "utf-8"));
    } catch {
      // skip malformed settings
    }
  }

  const existing = settings.mcpServers ?? {};

  for (const server of servers) {
    if (server.oauth && !server.command && !server.url) {
      skipped.push(`${server.name} (requires manual OAuth)`);
      continue;
    }

    const qwenServer = toQwenServer(server);
    if (!qwenServer) {
      skipped.push(`${server.name} (cannot convert)`);
      continue;
    }

    if (existing[server.name]) {
      skipped.push(`${server.name} (already exists)`);
      continue;
    }

    existing[server.name] = qwenServer;
    added.push(server.name);
  }

  settings.mcpServers = existing;

  if (!dryRun && added.length > 0) {
    writeFileSync(configPath, JSON.stringify(settings, null, 2) + "\n");
  }

  return { added, skipped, configPath };
}

function toQwenServer(server: UnifiedMcpServer): QwenMcpServer | null {
  if (server.transport === "stdio" && server.command) {
    return {
      command: server.command,
      ...(server.args && { args: server.args }),
      ...(server.env && { env: convertEnvVarSyntax(server.env, (v) => `$${v}`) }),
    };
  }

  if (server.transport === "http" && server.url) {
    return {
      httpUrl: server.url,
      ...(server.headers && { headers: server.headers }),
    };
  }

  if (server.transport === "sse" && server.url) {
    return {
      url: server.url,
      ...(server.headers && { headers: server.headers }),
    };
  }

  return null;
}
