import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname } from "node:path";
import { PATHS } from "../paths.js";
import { convertEnvVarSyntax } from "../env.js";
import type { GeminiMcpServer, GeminiSettings, UnifiedMcpServer } from "../types.js";

export function writeToGemini(
  servers: UnifiedMcpServer[],
  dryRun: boolean
): { added: string[]; skipped: string[] } {
  const added: string[] = [];
  const skipped: string[] = [];

  // Check if Gemini CLI directory exists
  const geminiDir = dirname(PATHS.geminiSettings);
  if (!existsSync(geminiDir)) {
    return {
      added: [],
      skipped: [
        `all ${servers.length} server(s) (${geminiDir} does not exist, please install Gemini CLI first)`,
      ],
    };
  }

  // Read existing Gemini settings
  let settings: GeminiSettings = {};
  if (existsSync(PATHS.geminiSettings)) {
    try {
      settings = JSON.parse(readFileSync(PATHS.geminiSettings, "utf-8"));
    } catch {
      // skip malformed settings
    }
  }

  const existing = settings.mcpServers ?? {};

  for (const server of servers) {
    // Skip OAuth-only servers (need manual auth)
    if (server.oauth && !server.command && !server.url) {
      skipped.push(`${server.name} (requires manual OAuth)`);
      continue;
    }

    const geminiServer = toGeminiServer(server);
    if (!geminiServer) {
      skipped.push(`${server.name} (cannot convert)`);
      continue;
    }

    // Don't overwrite existing config
    if (existing[server.name]) {
      skipped.push(`${server.name} (already exists)`);
      continue;
    }

    existing[server.name] = geminiServer;
    added.push(server.name);
  }

  settings.mcpServers = existing;

  if (!dryRun && added.length > 0) {
    writeFileSync(PATHS.geminiSettings, JSON.stringify(settings, null, 2) + "\n");
  }

  return { added, skipped };
}

function toGeminiServer(server: UnifiedMcpServer): GeminiMcpServer | null {
  if (server.transport === "stdio" && server.command) {
    return {
      command: server.command,
      ...(server.args && { args: server.args }),
      ...(server.env && { env: convertEnvVarSyntax(server.env, (v) => `$${v}`) }),
    };
  }

  if (server.transport === "http" && server.url) {
    // Gemini uses httpUrl for HTTP streamable transport
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
