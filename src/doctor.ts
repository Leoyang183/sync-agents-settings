import { readFileSync, existsSync } from "node:fs";
import { dirname } from "node:path";
import TOML from "@iarna/toml";
import { PATHS } from "./paths.js";
import { readClaudeMcpServers } from "./reader.js";
import { isOAuthOnlyServer } from "./oauth.js";
import { resolveCodexConfigPath } from "./writers/codex.js";
import { resolveKimiMcpConfigPath } from "./writers/kimi.js";
import type { SyncTarget } from "./types.js";

type TargetStatus = "ok" | "drift" | "unavailable" | "error";

export interface TargetDoctorResult {
  target: SyncTarget;
  status: TargetStatus;
  missing: string[];
  extra: string[];
  note?: string;
}

export interface DoctorReport {
  sourceCount: number;
  sourceNames: string[];
  hasDrift: boolean;
  hasErrors: boolean;
  results: TargetDoctorResult[];
}

export interface DoctorOptions {
  skipOAuth?: boolean;
  codexHome?: string;
  kimiHome?: string;
}

interface ReadNamesResult {
  status: Exclude<TargetStatus, "drift">;
  names: Set<string>;
  note?: string;
}

export function runDoctor(targets: SyncTarget[], options: DoctorOptions = {}): DoctorReport {
  const sourceNames = getSourceNames(Boolean(options.skipOAuth));
  const expectedNames = new Set(sourceNames);
  const results: TargetDoctorResult[] = [];
  let hasDrift = false;
  let hasErrors = false;

  for (const target of targets) {
    const readResult = readTargetNames(target, options.codexHome, options.kimiHome);

    if (readResult.status === "error") {
      hasErrors = true;
      results.push({
        target,
        status: "error",
        missing: [],
        extra: [],
        note: readResult.note,
      });
      continue;
    }

    if (readResult.status === "unavailable") {
      results.push({
        target,
        status: "unavailable",
        missing: [],
        extra: [],
        note: readResult.note,
      });
      continue;
    }

    const missing = sourceNames.filter((name) => !readResult.names.has(name));
    const extra = [...readResult.names].filter((name) => !expectedNames.has(name));
    const status: TargetStatus = missing.length > 0 || extra.length > 0 ? "drift" : "ok";

    if (status === "drift") {
      hasDrift = true;
    }

    results.push({
      target,
      status,
      missing,
      extra: extra.sort(),
    });
  }

  return {
    sourceCount: sourceNames.length,
    sourceNames,
    hasDrift,
    hasErrors,
    results,
  };
}

function getSourceNames(skipOAuth: boolean): string[] {
  let servers = readClaudeMcpServers();
  if (skipOAuth) {
    servers = servers.filter((server) => !isOAuthOnlyServer(server));
  }
  return [...new Set(servers.map((server) => server.name))].sort();
}

function readTargetNames(
  target: SyncTarget,
  codexHome?: string,
  kimiHome?: string
): ReadNamesResult {
  if (target === "codex") {
    const configPath = resolveCodexConfigPath(codexHome);
    const targetDir = dirname(configPath);
    if (!existsSync(targetDir)) {
      return {
        status: "unavailable",
        names: new Set(),
        note: `${targetDir} does not exist`,
      };
    }

    if (!existsSync(configPath)) {
      return { status: "ok", names: new Set() };
    }

    try {
      const raw = readFileSync(configPath, "utf-8");
      if (!raw.trim()) {
        return { status: "ok", names: new Set() };
      }
      const parsed = TOML.parse(raw) as { mcp_servers?: Record<string, unknown> };
      return { status: "ok", names: new Set(Object.keys(parsed.mcp_servers ?? {})) };
    } catch (error) {
      return {
        status: "error",
        names: new Set(),
        note: error instanceof Error ? error.message : "failed to parse config.toml",
      };
    }
  }

  const targetConfig = getJsonTargetConfig(target, kimiHome);
  const targetDir = dirname(targetConfig.path);
  if (!existsSync(targetDir)) {
    return {
      status: "unavailable",
      names: new Set(),
      note: `${targetDir} does not exist`,
    };
  }

  if (!existsSync(targetConfig.path)) {
    return { status: "ok", names: new Set() };
  }

  try {
    const raw = readFileSync(targetConfig.path, "utf-8");
    if (!raw.trim()) {
      return { status: "ok", names: new Set() };
    }
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const section = parsed[targetConfig.key] as Record<string, unknown> | undefined;
    return { status: "ok", names: new Set(Object.keys(section ?? {})) };
  } catch (error) {
    return {
      status: "error",
      names: new Set(),
      note: error instanceof Error ? error.message : "failed to parse JSON config",
    };
  }
}

function getJsonTargetConfig(
  target: Exclude<SyncTarget, "codex">,
  kimiHome?: string
): {
  path: string;
  key: "mcpServers" | "mcp";
} {
  if (target === "gemini") {
    return { path: PATHS.geminiSettings, key: "mcpServers" };
  }
  if (target === "opencode") {
    return { path: PATHS.openCodeConfig, key: "mcp" };
  }
  if (target === "kiro") {
    return { path: PATHS.kiroMcpConfig, key: "mcpServers" };
  }
  if (target === "kimi") {
    return { path: resolveKimiMcpConfigPath(kimiHome), key: "mcpServers" };
  }
  return { path: PATHS.cursorMcpConfig, key: "mcpServers" };
}
