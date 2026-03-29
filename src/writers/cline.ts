import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import type { UnifiedMcpServer } from "../types.js";
import { writeClaudeFormat } from "./claude-format.js";

const DEFAULT_CLINE_HOME = join(homedir(), ".cline");

export function resolveClineMcpConfigPath(clineHome?: string): string {
  const dir = resolve(clineHome ?? DEFAULT_CLINE_HOME);
  return join(dir, "data", "settings", "cline_mcp_settings.json");
}

export function writeToCline(
  servers: UnifiedMcpServer[],
  dryRun: boolean,
  clineHome?: string
): { added: string[]; skipped: string[]; configPath: string } {
  const configPath = resolveClineMcpConfigPath(clineHome);
  const configDir = dirname(configPath);

  if (!existsSync(configDir)) {
    return {
      added: [],
      skipped: [
        `all ${servers.length} server(s) (${configDir} does not exist, please install Cline CLI or use --cline-home)`,
      ],
      configPath,
    };
  }

  const result = writeClaudeFormat(servers, dryRun, configPath, "Cline CLI");
  return { ...result, configPath };
}
