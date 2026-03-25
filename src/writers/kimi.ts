import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import type { UnifiedMcpServer } from "../types.js";
import { writeClaudeFormat } from "./claude-format.js";

const DEFAULT_KIMI_HOME = join(homedir(), ".kimi");

export function resolveKimiMcpConfigPath(kimiHome?: string): string {
  const dir = resolve(kimiHome ?? DEFAULT_KIMI_HOME);
  return join(dir, "mcp.json");
}

export function writeToKimi(
  servers: UnifiedMcpServer[],
  dryRun: boolean,
  kimiHome?: string
): { added: string[]; skipped: string[]; configPath: string } {
  const configPath = resolveKimiMcpConfigPath(kimiHome);
  const kimiDir = dirname(configPath);

  if (!existsSync(kimiDir)) {
    return {
      added: [],
      skipped: [
        `all ${servers.length} server(s) (${kimiDir} does not exist, please install Kimi CLI or use --kimi-home)`,
      ],
      configPath,
    };
  }

  const result = writeClaudeFormat(servers, dryRun, configPath, "Kimi CLI");
  return { ...result, configPath };
}
