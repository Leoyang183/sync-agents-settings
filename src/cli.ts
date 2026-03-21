#!/usr/bin/env node
import { readFileSync, existsSync } from "node:fs";
import { Command } from "commander";
import { readClaudeMcpServers } from "./reader.js";
import { writeToGemini } from "./writers/gemini.js";
import { writeToCodex, resolveCodexConfigPath } from "./writers/codex.js";
import { writeToOpenCode } from "./writers/opencode.js";
import { writeToKiro } from "./writers/kiro.js";
import { writeToCursor } from "./writers/cursor.js";
import { createBackup, getFilesToBackup } from "./backup.js";
import { PATHS } from "./paths.js";
import type { SyncTarget, UnifiedMcpServer } from "./types.js";
import {
  syncInstructions,
  getGlobalSyncPairs,
  getLocalSyncPairs,
  getUnsupportedGlobalTargets,
  type InstructionsTarget,
} from "./instructions.js";
import type { ConflictAction } from "./prompt.js";

const program = new Command();

program
  .name("sync-agents")
  .description("Sync Claude Code MCP settings to Gemini CLI / Codex CLI / OpenCode / Kiro CLI")
  .version("0.3.0");

program
  .command("sync")
  .description("Sync MCP settings from Claude Code to other CLIs")
  .option("-t, --target <targets...>", "sync targets (gemini, codex, opencode, kiro, cursor)", [
    "gemini",
    "codex",
    "opencode",
    "kiro",
    "cursor",
  ])
  .option("--dry-run", "preview mode, no files will be written", false)
  .option("--no-backup", "skip backup")
  .option("--skip-oauth", "skip MCP servers that require OAuth", false)
  .option(
    "--codex-home <path>",
    "Codex config directory (default: ~/.codex, or specify project-level .codex/)"
  )
  .option("-v, --verbose", "show detailed output", false)
  .action(async (opts) => {
    const targets = opts.target as SyncTarget[];
    const dryRun = opts.dryRun as boolean;
    const skipBackup = !opts.backup;
    const verbose = opts.verbose as boolean;
    const skipOAuth = opts.skipOauth as boolean;
    const codexHome = opts.codexHome as string | undefined;

    if (dryRun) {
      console.log("🔍 Dry-run mode — no files will be written\n");
    }

    // 1. Read Claude MCP servers
    console.log("📖 Reading Claude Code MCP settings...");
    let servers = readClaudeMcpServers();

    if (skipOAuth) {
      servers = servers.filter((s) => !s.oauth);
    }

    console.log(`  Found ${servers.length} MCP server(s)\n`);

    if (verbose) {
      printServers(servers);
    }

    if (servers.length === 0) {
      console.log("No MCP servers found, exiting.");
      return;
    }

    // 2. Backup
    const codexConfigPath = resolveCodexConfigPath(codexHome);
    if (!skipBackup && !dryRun) {
      console.log("💾 Backing up config files...");
      const backupDir = createBackup(getFilesToBackup(targets, codexConfigPath));
      console.log(`  Backup directory: ${backupDir}\n`);
    }

    // 3. Sync to targets
    for (const target of targets) {
      console.log(`🔄 Syncing to ${target.toUpperCase()}...`);

      if (target === "gemini") {
        const result = writeToGemini(servers, dryRun);
        printResult(result.added, result.skipped);
      } else if (target === "codex") {
        const result = writeToCodex(servers, dryRun, codexHome);
        console.log(`  Target: ${result.configPath}`);
        printResult(result.added, result.skipped);
      } else if (target === "opencode") {
        const result = writeToOpenCode(servers, dryRun);
        printResult(result.added, result.skipped);
      } else if (target === "kiro") {
        const result = writeToKiro(servers, dryRun);
        printResult(result.added, result.skipped);
      } else if (target === "cursor") {
        const result = writeToCursor(servers, dryRun);
        printResult(result.added, result.skipped);
      }
      console.log();
    }

    console.log("✅ Sync complete!");
  });

program
  .command("list")
  .description("List all MCP servers from Claude Code")
  .action(() => {
    console.log("📖 Reading Claude Code MCP settings...\n");
    const servers = readClaudeMcpServers();
    printServers(servers);
    console.log(`\nTotal: ${servers.length} MCP server(s)`);
  });

program
  .command("diff")
  .description("Compare MCP settings between Claude Code and other CLIs")
  .option(
    "-t, --target <targets...>",
    "comparison targets (gemini, codex, opencode, kiro, cursor)",
    ["gemini", "codex", "opencode", "kiro", "cursor"]
  )
  .action((opts) => {
    const targets = opts.target as SyncTarget[];
    const servers = readClaudeMcpServers();
    const claudeNames = new Set(servers.map((s) => s.name));

    console.log(`Claude Code: ${servers.length} MCP server(s)\n`);

    const diffConfigs: Record<string, { path: string; key?: "mcpServers" | "mcp" }> = {
      gemini: { path: PATHS.geminiSettings },
      opencode: { path: PATHS.openCodeConfig, key: "mcp" },
      kiro: { path: PATHS.kiroMcpConfig },
      cursor: { path: PATHS.cursorMcpConfig },
    };

    for (const target of targets) {
      if (target === "codex") {
        console.log(`  Codex: use 'codex mcp list' to view`);
      } else if (Object.hasOwn(diffConfigs, target)) {
        const { path, key } = diffConfigs[target];
        const names = readExistingServerNames(path, key);
        printDiff(target.charAt(0).toUpperCase() + target.slice(1), claudeNames, names);
      }
    }
  });

program
  .command("sync-instructions")
  .description("Sync CLAUDE.md instruction files to other AI agent formats")
  .option("-t, --target <targets...>", "sync targets (gemini, codex, opencode, kiro, cursor)", [
    "gemini",
    "codex",
    "opencode",
    "kiro",
    "cursor",
  ])
  .option("--global", "sync global config (~/.claude/CLAUDE.md)", false)
  .option("--local", "sync project-level CLAUDE.md in current directory", false)
  .option("--dry-run", "preview mode, no files will be written", false)
  .option("--no-backup", "skip backup")
  .option(
    "--on-conflict <action>",
    "action when target exists: overwrite, append, skip (skips interactive prompt)"
  )
  .action(async (opts) => {
    const targets = opts.target as InstructionsTarget[];
    const syncGlobal = opts.global as boolean;
    const syncLocal = opts.local as boolean;
    const dryRun = opts.dryRun as boolean;
    const skipBackup = !opts.backup;
    const onConflict = opts.onConflict as ConflictAction | undefined;

    // Default: sync both if neither flag is set
    const doGlobal = syncGlobal || (!syncGlobal && !syncLocal);
    const doLocal = syncLocal || (!syncGlobal && !syncLocal);

    if (dryRun) {
      console.log("🔍 Dry-run mode — no files will be written\n");
    }

    // Global sync
    if (doGlobal) {
      console.log("📋 Syncing global instructions (~/.claude/CLAUDE.md)...\n");

      const unsupported = getUnsupportedGlobalTargets(targets);
      for (const msg of unsupported) {
        console.log(`  ⚠  ${msg}`);
      }

      const pairs = getGlobalSyncPairs(targets);
      backupTargets(pairs, skipBackup, dryRun);
      const result = await syncInstructions(pairs, { dryRun, force: onConflict });
      printInstructionsResult(result);
    }

    // Local sync
    if (doLocal) {
      console.log("📋 Syncing local instructions (./CLAUDE.md)...\n");
      const pairs = getLocalSyncPairs(targets, process.cwd());
      backupTargets(pairs, skipBackup, dryRun);
      const result = await syncInstructions(pairs, { dryRun, force: onConflict });
      printInstructionsResult(result);
    }

    console.log("✅ Instructions sync complete!");
  });

function backupTargets(pairs: { target: string }[], skipBackup: boolean, dryRun: boolean): void {
  if (skipBackup || dryRun) return;
  const filesToBackup = pairs.map((p) => p.target).filter((f) => existsSync(f));
  if (filesToBackup.length > 0) {
    console.log("💾 Backing up existing files...");
    const backupDir = createBackup(filesToBackup);
    console.log(`  Backup directory: ${backupDir}\n`);
  }
}

function printInstructionsResult(result: {
  synced: string[];
  skipped: string[];
  appended: string[];
}) {
  if (result.synced.length > 0) {
    console.log(`  ✅ Synced: ${result.synced.join(", ")}`);
  }
  if (result.appended.length > 0) {
    console.log(`  📎 Appended: ${result.appended.join(", ")}`);
  }
  if (result.skipped.length > 0) {
    console.log(`  ⏭  Skipped: ${result.skipped.join(", ")}`);
  }
  console.log();
}

function readExistingServerNames(
  configPath: string,
  key: "mcpServers" | "mcp" = "mcpServers"
): Set<string> {
  try {
    if (!existsSync(configPath)) {
      return new Set();
    }
    const config = JSON.parse(readFileSync(configPath, "utf-8"));
    return new Set(Object.keys(config[key] ?? {}));
  } catch {
    return new Set();
  }
}

function printDiff(targetName: string, claudeNames: Set<string>, targetNames: Set<string>) {
  const onlyInClaude = [...claudeNames].filter((n) => !targetNames.has(n));
  const onlyInTarget = [...targetNames].filter((n) => !claudeNames.has(n));
  const shared = [...claudeNames].filter((n) => targetNames.has(n));

  console.log(`--- ${targetName} comparison ---`);
  if (shared.length > 0) {
    console.log(`  Shared: ${shared.join(", ")}`);
  }
  if (onlyInClaude.length > 0) {
    console.log(`  Only in Claude: ${onlyInClaude.join(", ")}`);
  }
  if (onlyInTarget.length > 0) {
    console.log(`  Only in ${targetName}: ${onlyInTarget.join(", ")}`);
  }
  console.log();
}

function printServers(servers: UnifiedMcpServer[]) {
  for (const s of servers) {
    const transport = s.transport.toUpperCase().padEnd(5);
    const source = s.source === "claude-plugin" ? "plugin" : "config";
    const endpoint =
      s.transport === "stdio" ? `${s.command} ${(s.args ?? []).join(" ")}` : (s.url ?? "?");
    console.log(`  [${transport}] ${s.name} (${source})`);
    console.log(`         ${endpoint}`);
    if (s.oauth) {
      console.log(`         ⚠ Requires OAuth`);
    }
  }
}

function printResult(added: string[], skipped: string[]) {
  if (added.length > 0) {
    console.log(`  ✅ Added: ${added.join(", ")}`);
  }
  if (skipped.length > 0) {
    console.log(`  ⏭  Skipped: ${skipped.join(", ")}`);
  }
  if (added.length === 0 && skipped.length === 0) {
    console.log("  No servers to sync");
  }
}

program.parse();
