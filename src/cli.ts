#!/usr/bin/env node
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { Command } from "commander";
import { readClaudeMcpServers } from "./reader.js";
import { writeToGemini } from "./writers/gemini.js";
import { writeToCodex, resolveCodexConfigPath } from "./writers/codex.js";
import { writeToOpenCode } from "./writers/opencode.js";
import { writeToKiro } from "./writers/kiro.js";
import { writeToCursor } from "./writers/cursor.js";
import { writeToKimi, resolveKimiMcpConfigPath } from "./writers/kimi.js";
import { writeToVibe, resolveVibeConfigPath } from "./writers/vibe.js";
import { writeToQwen, resolveQwenSettingsPath } from "./writers/qwen.js";
import { writeToAmp, resolveAmpSettingsPath } from "./writers/amp.js";
import { writeToCline, resolveClineMcpConfigPath } from "./writers/cline.js";
import { writeToWindsurf, resolveWindsurfMcpConfigPath } from "./writers/windsurf.js";
import { createBackup, getFilesToBackup } from "./backup.js";
import { PATHS } from "./paths.js";
import type { SyncTarget, UnifiedMcpServer } from "./types.js";
import { runDoctor } from "./doctor.js";
import { validateServersForTargets } from "./validation.js";
import { isOAuthOnlyServer } from "./oauth.js";
import { reconcileTargets, groupValidationByTarget } from "./reconcile.js";
import { runAutoFix } from "./fix.js";
import { compareNameSets } from "./diff.js";
import {
  formatReconcileReport,
  formatDoctorReport,
  formatValidationReport,
  formatSyncReport,
  formatSyncInstructionsReport,
  formatDiffReport,
} from "./report.js";
import { generateReportSchemaDocument } from "./report-schema-renderer.js";
import { checkReportSchemaUpToDate } from "./report-schema-sync.js";
import {
  syncInstructions,
  getGlobalSyncPairs,
  getLocalSyncPairs,
  getUnsupportedGlobalTargets,
  type InstructionsTarget,
  type ImportMode,
} from "./instructions.js";
import type { ConflictAction } from "./prompt.js";

const program = new Command();

program
  .name("sync-agents")
  .description(
    "Sync Claude Code MCP settings to Gemini CLI / Codex CLI / OpenCode / Kiro / Cursor / Kimi / Vibe / Qwen Code / Amp / Cline / Windsurf"
  )
  .version("0.5.0");

program
  .command("sync")
  .description("Sync MCP settings from Claude Code to other CLIs")
  .option(
    "-t, --target <targets...>",
    "sync targets (gemini, codex, opencode, kiro, cursor, kimi, vibe, qwen, amp, cline, windsurf, aider)",
    [
      "gemini",
      "codex",
      "opencode",
      "kiro",
      "cursor",
      "kimi",
      "vibe",
      "qwen",
      "amp",
      "cline",
      "windsurf",
      "aider",
    ]
  )
  .option("--dry-run", "preview mode, no files will be written", false)
  .option("--no-backup", "skip backup")
  .option("--skip-oauth", "skip MCP servers that require OAuth", false)
  .option("-s, --server <names...>", "sync only specified MCP servers by name")
  .option(
    "--codex-home <path>",
    "Codex config directory (default: ~/.codex, or specify project-level .codex/)"
  )
  .option(
    "--kimi-home <path>",
    "Kimi config directory (default: ~/.kimi, or specify project-level .kimi/)"
  )
  .option(
    "--vibe-home <path>",
    "Vibe config directory (default: ~/.vibe, or specify project-level .vibe/)"
  )
  .option(
    "--qwen-home <path>",
    "Qwen config directory (default: ~/.qwen, or specify project-level .qwen/)"
  )
  .option(
    "--amp-home <path>",
    "Amp config directory (default: ~/.config/amp, or specify project-level .amp/)"
  )
  .option(
    "--cline-home <path>",
    "Cline config directory (default: ~/.cline, or specify project-level .cline/)"
  )
  .option(
    "--windsurf-home <path>",
    "Windsurf config directory (default: ~/.codeium/windsurf, or specify project-level)"
  )
  .option("--report <format>", "output format: text or json", "text")
  .option("-v, --verbose", "show detailed output", false)
  .action(async (opts) => {
    const targets = opts.target as SyncTarget[];
    const dryRun = opts.dryRun as boolean;
    const skipBackup = !opts.backup;
    const verbose = opts.verbose as boolean;
    const skipOAuth = opts.skipOauth as boolean;
    const serverFilter = opts.server as string[] | undefined;
    const codexHome = opts.codexHome as string | undefined;
    const kimiHome = opts.kimiHome as string | undefined;
    const vibeHome = opts.vibeHome as string | undefined;
    const qwenHome = opts.qwenHome as string | undefined;
    const ampHome = opts.ampHome as string | undefined;
    const clineHome = opts.clineHome as string | undefined;
    const windsurfHome = opts.windsurfHome as string | undefined;
    const reportFormat = opts.report as string;
    const jsonReport = reportFormat === "json";

    if (reportFormat !== "text" && reportFormat !== "json") {
      console.error(`Invalid --report: ${reportFormat}. Use "text" or "json".`);
      process.exit(1);
    }

    if (!jsonReport && dryRun) {
      console.log("🔍 Dry-run mode — no files will be written\n");
    }

    // 1. Read Claude MCP servers
    if (!jsonReport) {
      console.log("📖 Reading Claude Code MCP settings...");
    }
    let servers = readClaudeMcpServers();

    if (skipOAuth) {
      servers = servers.filter((s) => !isOAuthOnlyServer(s));
    }

    if (serverFilter && serverFilter.length > 0) {
      const filterSet = new Set(serverFilter);
      servers = servers.filter((s) => filterSet.has(s.name));
    }

    if (!jsonReport) {
      console.log(`  Found ${servers.length} MCP server(s)\n`);
    }

    if (!jsonReport && verbose) {
      printServers(servers);
    }

    if (servers.length === 0) {
      if (jsonReport) {
        console.log(
          formatSyncReport({
            sourceCount: 0,
            dryRun,
            skipOAuth,
            targets: [],
          })
        );
      } else {
        console.log("No MCP servers found, exiting.");
      }
      return;
    }

    // 2. Backup
    const codexConfigPath = resolveCodexConfigPath(codexHome);
    const kimiConfigPath = resolveKimiMcpConfigPath(kimiHome);
    const vibeConfigPath = resolveVibeConfigPath(vibeHome);
    const qwenConfigPath = resolveQwenSettingsPath(qwenHome);
    const ampConfigPath = resolveAmpSettingsPath(ampHome);
    const clineConfigPath = resolveClineMcpConfigPath(clineHome);
    const windsurfConfigPath = resolveWindsurfMcpConfigPath(windsurfHome);
    if (!skipBackup && !dryRun) {
      if (!jsonReport) {
        console.log("💾 Backing up config files...");
      }
      const backupDir = createBackup(
        getFilesToBackup(
          targets,
          codexConfigPath,
          kimiConfigPath,
          vibeConfigPath,
          qwenConfigPath,
          ampConfigPath,
          clineConfigPath,
          windsurfConfigPath
        )
      );
      if (!jsonReport) {
        console.log(`  Backup directory: ${backupDir}\n`);
      }
    }

    // 3. Sync to targets
    const targetReports: Array<{
      target: SyncTarget;
      added: string[];
      skipped: string[];
      configPath?: string;
    }> = [];

    for (const target of targets) {
      if (!jsonReport) {
        console.log(`🔄 Syncing to ${target.toUpperCase()}...`);
      }

      if (target === "gemini") {
        const result = writeToGemini(servers, dryRun);
        targetReports.push({ target, added: result.added, skipped: result.skipped });
        if (!jsonReport) {
          printResult(result.added, result.skipped);
        }
      } else if (target === "codex") {
        const result = writeToCodex(servers, dryRun, codexHome);
        targetReports.push({
          target,
          added: result.added,
          skipped: result.skipped,
          configPath: result.configPath,
        });
        if (!jsonReport) {
          console.log(`  Target: ${result.configPath}`);
          printResult(result.added, result.skipped);
        }
      } else if (target === "opencode") {
        const result = writeToOpenCode(servers, dryRun);
        targetReports.push({ target, added: result.added, skipped: result.skipped });
        if (!jsonReport) {
          printResult(result.added, result.skipped);
        }
      } else if (target === "kiro") {
        const result = writeToKiro(servers, dryRun);
        targetReports.push({ target, added: result.added, skipped: result.skipped });
        if (!jsonReport) {
          printResult(result.added, result.skipped);
        }
      } else if (target === "cursor") {
        const result = writeToCursor(servers, dryRun);
        targetReports.push({ target, added: result.added, skipped: result.skipped });
        if (!jsonReport) {
          printResult(result.added, result.skipped);
        }
      } else if (target === "kimi") {
        const result = writeToKimi(servers, dryRun, kimiHome);
        targetReports.push({
          target,
          added: result.added,
          skipped: result.skipped,
          configPath: result.configPath,
        });
        if (!jsonReport) {
          console.log(`  Target: ${result.configPath}`);
          printResult(result.added, result.skipped);
        }
      } else if (target === "vibe") {
        const result = writeToVibe(servers, dryRun, vibeHome);
        targetReports.push({
          target,
          added: result.added,
          skipped: result.skipped,
          configPath: result.configPath,
        });
        if (!jsonReport) {
          console.log(`  Target: ${result.configPath}`);
          printResult(result.added, result.skipped);
        }
      } else if (target === "qwen") {
        const result = writeToQwen(servers, dryRun, qwenHome);
        targetReports.push({
          target,
          added: result.added,
          skipped: result.skipped,
          configPath: result.configPath,
        });
        if (!jsonReport) {
          console.log(`  Target: ${result.configPath}`);
          printResult(result.added, result.skipped);
        }
      } else if (target === "amp") {
        const result = writeToAmp(servers, dryRun, ampHome);
        targetReports.push({
          target,
          added: result.added,
          skipped: result.skipped,
          configPath: result.configPath,
        });
        if (!jsonReport) {
          console.log(`  Target: ${result.configPath}`);
          printResult(result.added, result.skipped);
        }
      } else if (target === "cline") {
        const result = writeToCline(servers, dryRun, clineHome);
        targetReports.push({
          target,
          added: result.added,
          skipped: result.skipped,
          configPath: result.configPath,
        });
        if (!jsonReport) {
          console.log(`  Target: ${result.configPath}`);
          printResult(result.added, result.skipped);
        }
      } else if (target === "windsurf") {
        const result = writeToWindsurf(servers, dryRun, windsurfHome);
        targetReports.push({
          target,
          added: result.added,
          skipped: result.skipped,
          configPath: result.configPath,
        });
        if (!jsonReport) {
          console.log(`  Target: ${result.configPath}`);
          printResult(result.added, result.skipped);
        }
      }
      if (!jsonReport) {
        console.log();
      }
    }

    if (jsonReport) {
      console.log(
        formatSyncReport({
          sourceCount: servers.length,
          dryRun,
          skipOAuth,
          targets: targetReports,
        })
      );
    } else {
      console.log("✅ Sync complete!");
    }
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
  .command("report-schema")
  .description("Print report JSON schema markdown (or write to a file)")
  .option("--check", "exit non-zero if target schema file is missing or outdated", false)
  .option("--write <path>", "write markdown to a file path instead of stdout")
  .action((opts) => {
    const content = generateReportSchemaDocument();
    const checkOnly = opts.check as boolean;
    const outputPath = opts.write as string | undefined;

    if (checkOnly) {
      const targetPath = outputPath ?? "docs/report-schema.md";
      const check = checkReportSchemaUpToDate(targetPath);
      if (check.upToDate) {
        console.log(`✅ Report schema is up to date: ${targetPath}`);
        return;
      }

      if (check.reason === "missing") {
        console.error(`❌ Report schema file is missing: ${targetPath}`);
      } else {
        console.error(`❌ Report schema file is outdated: ${targetPath}`);
      }
      process.exit(1);
    }

    if (!outputPath) {
      console.log(content);
      return;
    }

    mkdirSync(dirname(outputPath), { recursive: true });
    writeFileSync(outputPath, content);
    console.log(`✅ Report schema written: ${outputPath}`);
  });

program
  .command("diff")
  .description("Compare MCP settings between Claude Code and other CLIs")
  .option(
    "-t, --target <targets...>",
    "comparison targets (gemini, codex, opencode, kiro, cursor, kimi, vibe, qwen, amp, cline, windsurf)",
    [
      "gemini",
      "codex",
      "opencode",
      "kiro",
      "cursor",
      "kimi",
      "vibe",
      "qwen",
      "amp",
      "cline",
      "windsurf",
    ]
  )
  .option(
    "--kimi-home <path>",
    "Kimi config directory (default: ~/.kimi, or specify project-level .kimi/)"
  )
  .option(
    "--qwen-home <path>",
    "Qwen config directory (default: ~/.qwen, or specify project-level .qwen/)"
  )
  .option(
    "--amp-home <path>",
    "Amp config directory (default: ~/.config/amp, or specify project-level .amp/)"
  )
  .option(
    "--cline-home <path>",
    "Cline config directory (default: ~/.cline, or specify project-level .cline/)"
  )
  .option(
    "--windsurf-home <path>",
    "Windsurf config directory (default: ~/.codeium/windsurf, or specify project-level)"
  )
  .option("--report <format>", "output format: text or json", "text")
  .action((opts) => {
    const targets = opts.target as SyncTarget[];
    const kimiHome = opts.kimiHome as string | undefined;
    const qwenHome = opts.qwenHome as string | undefined;
    const ampHome = opts.ampHome as string | undefined;
    const clineHome = opts.clineHome as string | undefined;
    const windsurfHome = opts.windsurfHome as string | undefined;
    const reportFormat = opts.report as string;
    const jsonReport = reportFormat === "json";

    if (reportFormat !== "text" && reportFormat !== "json") {
      console.error(`Invalid --report: ${reportFormat}. Use "text" or "json".`);
      process.exit(1);
    }

    const servers = readClaudeMcpServers();
    const claudeNames = new Set(servers.map((s) => s.name));
    const sourceNames = [...claudeNames].sort();

    if (!jsonReport) {
      console.log(`Claude Code: ${servers.length} MCP server(s)\n`);
    }

    const diffConfigs: Record<string, { path: string; key?: string }> = {
      gemini: { path: PATHS.geminiSettings },
      opencode: { path: PATHS.openCodeConfig, key: "mcp" },
      kiro: { path: PATHS.kiroMcpConfig },
      cursor: { path: PATHS.cursorMcpConfig },
      kimi: { path: resolveKimiMcpConfigPath(kimiHome) },
      qwen: { path: resolveQwenSettingsPath(qwenHome) },
      amp: { path: resolveAmpSettingsPath(ampHome), key: "amp.mcpServers" },
      cline: { path: resolveClineMcpConfigPath(clineHome) },
      windsurf: { path: resolveWindsurfMcpConfigPath(windsurfHome) },
    };
    const targetReports: Array<{
      target: string;
      shared: string[];
      onlyInSource: string[];
      onlyInTarget: string[];
      note?: string;
    }> = [];

    for (const target of targets) {
      if (target === "codex") {
        const codexNote = "use 'codex mcp list' to view";
        if (!jsonReport) {
          console.log(`  Codex: ${codexNote}`);
        }
        targetReports.push({
          target: "codex",
          shared: [],
          onlyInSource: [],
          onlyInTarget: [],
          note: codexNote,
        });
      } else if (target === "vibe") {
        const vibeNote = "use 'vibe' to view (TOML array format)";
        if (!jsonReport) {
          console.log(`  Vibe: ${vibeNote}`);
        }
        targetReports.push({
          target: "vibe",
          shared: [],
          onlyInSource: [],
          onlyInTarget: [],
          note: vibeNote,
        });
      } else if (Object.hasOwn(diffConfigs, target)) {
        const { path, key } = diffConfigs[target];
        const names = readExistingServerNames(path, key);
        const compared = compareNameSets(claudeNames, names);
        targetReports.push({
          target,
          shared: compared.shared,
          onlyInSource: compared.onlyInSource,
          onlyInTarget: compared.onlyInTarget,
        });
        if (!jsonReport) {
          printDiff(
            target.charAt(0).toUpperCase() + target.slice(1),
            compared.shared,
            compared.onlyInSource,
            compared.onlyInTarget
          );
        }
      }
    }

    if (jsonReport) {
      console.log(
        formatDiffReport({
          sourceCount: servers.length,
          sourceNames,
          targets: targetReports,
        })
      );
    }
  });

program
  .command("doctor")
  .description("Detect MCP config drift between Claude Code and target CLIs")
  .option(
    "-t, --target <targets...>",
    "doctor targets (gemini, codex, opencode, kiro, cursor, kimi, vibe, qwen, amp, cline, windsurf)",
    [
      "gemini",
      "codex",
      "opencode",
      "kiro",
      "cursor",
      "kimi",
      "vibe",
      "qwen",
      "amp",
      "cline",
      "windsurf",
    ]
  )
  .option("--skip-oauth", "ignore OAuth-only Claude servers", false)
  .option("--fix", "auto-run reconcile when drift is detected", false)
  .option("--dry-run", "when used with --fix, preview without writing", false)
  .option("--no-backup", "when used with --fix, skip backup")
  .option("--report <format>", "output format: text or json", "text")
  .option(
    "--codex-home <path>",
    "Codex config directory (default: ~/.codex, or specify project-level .codex/)"
  )
  .option(
    "--kimi-home <path>",
    "Kimi config directory (default: ~/.kimi, or specify project-level .kimi/)"
  )
  .option(
    "--vibe-home <path>",
    "Vibe config directory (default: ~/.vibe, or specify project-level .vibe/)"
  )
  .option(
    "--qwen-home <path>",
    "Qwen config directory (default: ~/.qwen, or specify project-level .qwen/)"
  )
  .option(
    "--amp-home <path>",
    "Amp config directory (default: ~/.config/amp, or specify project-level .amp/)"
  )
  .option(
    "--cline-home <path>",
    "Cline config directory (default: ~/.cline, or specify project-level .cline/)"
  )
  .option(
    "--windsurf-home <path>",
    "Windsurf config directory (default: ~/.codeium/windsurf, or specify project-level)"
  )
  .action((opts) => {
    const targets = opts.target as SyncTarget[];
    const skipOAuth = opts.skipOauth as boolean;
    const fix = opts.fix as boolean;
    const dryRun = opts.dryRun as boolean;
    const skipBackup = !opts.backup;
    const reportFormat = opts.report as string;
    const codexHome = opts.codexHome as string | undefined;
    const kimiHome = opts.kimiHome as string | undefined;
    const vibeHome = opts.vibeHome as string | undefined;
    const qwenHome = opts.qwenHome as string | undefined;
    const ampHome = opts.ampHome as string | undefined;
    const clineHome = opts.clineHome as string | undefined;
    const windsurfHome = opts.windsurfHome as string | undefined;
    const jsonReport = reportFormat === "json";

    if (reportFormat !== "text" && reportFormat !== "json") {
      console.error(`Invalid --report: ${reportFormat}. Use "text" or "json".`);
      process.exit(1);
    }

    if (fix) {
      if (jsonReport) {
        console.error(
          "--report json is not supported with --fix for doctor. Use reconcile --report json."
        );
        process.exit(1);
      }
      const fixed = runAutoFix({
        mode: "doctor",
        targets,
        dryRun,
        skipBackup,
        skipOAuth,
        codexHome,
        kimiHome,
        vibeHome,
        qwenHome,
        ampHome,
        clineHome,
        windsurfHome,
      });
      if (fixed.status === "failed") {
        if (fixed.reason === "doctor_parse") {
          console.error(
            "❌ Auto-fix failed: target config parse error. Fix target config and retry."
          );
        } else if (fixed.reason === "validation") {
          console.error("❌ Auto-fix failed: validation errors detected.");
        } else {
          console.error("❌ Auto-fix failed.");
        }
        process.exit(2);
      }
      if (fixed.status === "noop") {
        console.log("✅ No drift detected. Nothing to fix.");
        return;
      }
      console.log("✅ Auto-fix completed via reconcile.");
      return;
    }

    const report = runDoctor(targets, {
      skipOAuth,
      codexHome,
      kimiHome,
      vibeHome,
      qwenHome,
      ampHome,
      clineHome,
      windsurfHome,
    });

    if (jsonReport) {
      console.log(formatDoctorReport(report));
      if (report.hasErrors) process.exit(2);
      if (report.hasDrift) process.exit(1);
      return;
    }

    console.log("🩺 MCP drift doctor\n");
    console.log(`Claude Code source servers: ${report.sourceCount}\n`);

    for (const result of report.results) {
      const label = getTargetLabel(result.target);
      console.log(`--- ${label} ---`);

      if (result.status === "unavailable") {
        console.log(`  ⚠ Unavailable: ${result.note ?? "target directory not found"}`);
      } else if (result.status === "error") {
        console.log(`  ❌ Parse error: ${result.note ?? "unable to read target config"}`);
      } else if (result.status === "ok") {
        console.log("  ✅ No drift");
      } else {
        if (result.missing.length > 0) {
          console.log(`  Missing in ${label}: ${result.missing.join(", ")}`);
        }
        if (result.extra.length > 0) {
          console.log(`  Extra in ${label}: ${result.extra.join(", ")}`);
        }
      }

      console.log();
    }

    if (report.hasErrors) {
      console.error("Config parse error detected. Please fix target config file(s) and retry.");
      process.exit(2);
    }

    if (report.hasDrift) {
      console.error("Drift detected. Run sync to reconcile.");
      process.exit(1);
    }

    console.log("✅ All checked targets are in sync.");
  });

program
  .command("validate")
  .description("Validate MCP schema and target capability compatibility")
  .option(
    "-t, --target <targets...>",
    "validation targets (gemini, codex, opencode, kiro, cursor, kimi, vibe, qwen, amp, cline, windsurf)",
    [
      "gemini",
      "codex",
      "opencode",
      "kiro",
      "cursor",
      "kimi",
      "vibe",
      "qwen",
      "amp",
      "cline",
      "windsurf",
    ]
  )
  .option("--skip-oauth", "ignore OAuth-only Claude servers", false)
  .option("--fix", "auto-run reconcile after validation passes", false)
  .option("--dry-run", "when used with --fix, preview without writing", false)
  .option("--no-backup", "when used with --fix, skip backup")
  .option("--report <format>", "output format: text or json", "text")
  .option("--codex-home <path>", "Codex config directory (used by --fix for reconcile)")
  .option("--kimi-home <path>", "Kimi config directory (used by --fix for reconcile)")
  .option("--vibe-home <path>", "Vibe config directory (used by --fix for reconcile)")
  .option("--qwen-home <path>", "Qwen config directory (used by --fix for reconcile)")
  .option("--amp-home <path>", "Amp config directory (used by --fix for reconcile)")
  .option("--cline-home <path>", "Cline config directory (used by --fix for reconcile)")
  .option("--windsurf-home <path>", "Windsurf config directory (used by --fix for reconcile)")
  .action((opts) => {
    const targets = opts.target as SyncTarget[];
    const skipOAuth = opts.skipOauth as boolean;
    const fix = opts.fix as boolean;
    const dryRun = opts.dryRun as boolean;
    const skipBackup = !opts.backup;
    const reportFormat = opts.report as string;
    const codexHome = opts.codexHome as string | undefined;
    const kimiHome = opts.kimiHome as string | undefined;
    const vibeHome = opts.vibeHome as string | undefined;
    const qwenHome = opts.qwenHome as string | undefined;
    const ampHome = opts.ampHome as string | undefined;
    const clineHome = opts.clineHome as string | undefined;
    const windsurfHome = opts.windsurfHome as string | undefined;
    const jsonReport = reportFormat === "json";

    if (reportFormat !== "text" && reportFormat !== "json") {
      console.error(`Invalid --report: ${reportFormat}. Use "text" or "json".`);
      process.exit(1);
    }

    if (fix && jsonReport) {
      console.error(
        "--report json is not supported with --fix for validate. Use reconcile --report json."
      );
      process.exit(1);
    }

    const servers = readClaudeMcpServers();
    const report = validateServersForTargets(servers, targets, { skipOAuth });

    if (jsonReport) {
      console.log(formatValidationReport(report));
      if (report.errorCount > 0) {
        process.exit(2);
      }
      return;
    }

    console.log("🧪 MCP schema/capability validation\n");
    console.log(`Checked servers: ${skipOAuth ? "OAuth-skipped subset" : servers.length}`);
    console.log(`Targets: ${targets.join(", ")}\n`);

    if (report.issues.length === 0 && !fix) {
      console.log("✅ No schema/capability issues found.");
      return;
    }

    if (report.issues.length === 0) {
      console.log("✅ No schema/capability issues found.");
    }

    for (const target of targets) {
      const targetIssues = report.issues.filter((issue) => issue.target === target);
      if (targetIssues.length === 0) continue;

      const label = getTargetLabel(target);
      console.log(`--- ${label} ---`);
      for (const issue of targetIssues) {
        const icon = issue.severity === "error" ? "❌" : "⚠";
        console.log(`  ${icon} [${issue.code}] ${issue.server}: ${issue.message}`);
      }
      console.log();
    }

    if (report.issues.length > 0) {
      console.log(`Summary: ${report.errorCount} error(s), ${report.warningCount} warning(s)`);
    }

    if (report.errorCount > 0) {
      process.exit(2);
    }

    if (fix) {
      const fixed = runAutoFix({
        mode: "validate",
        targets,
        dryRun,
        skipBackup,
        skipOAuth,
        codexHome,
        kimiHome,
        vibeHome,
        qwenHome,
        ampHome,
        clineHome,
        windsurfHome,
      });
      if (fixed.status === "failed") {
        if (fixed.reason === "doctor_parse") {
          console.error(
            "❌ Auto-fix failed: target config parse error. Fix target config and retry."
          );
        } else if (fixed.reason === "validation") {
          console.error("❌ Auto-fix failed: validation errors detected.");
        } else {
          console.error("❌ Auto-fix failed.");
        }
        process.exit(2);
      }
      if (fixed.status === "noop") {
        console.log("✅ No drift detected. Nothing to fix.");
        return;
      }
      console.log("✅ Auto-fix completed via reconcile.");
    }
  });

program
  .command("reconcile")
  .description("Validate + detect drift + sync only missing MCP servers")
  .option(
    "-t, --target <targets...>",
    "reconcile targets (gemini, codex, opencode, kiro, cursor, kimi, vibe, qwen, amp, cline, windsurf)",
    [
      "gemini",
      "codex",
      "opencode",
      "kiro",
      "cursor",
      "kimi",
      "vibe",
      "qwen",
      "amp",
      "cline",
      "windsurf",
    ]
  )
  .option("--dry-run", "preview mode, no files will be written", false)
  .option("--no-backup", "skip backup")
  .option("--skip-oauth", "ignore OAuth-only Claude servers", false)
  .option("-s, --server <names...>", "reconcile only specified MCP servers by name")
  .option(
    "--codex-home <path>",
    "Codex config directory (default: ~/.codex, or specify project-level .codex/)"
  )
  .option(
    "--kimi-home <path>",
    "Kimi config directory (default: ~/.kimi, or specify project-level .kimi/)"
  )
  .option(
    "--vibe-home <path>",
    "Vibe config directory (default: ~/.vibe, or specify project-level .vibe/)"
  )
  .option(
    "--qwen-home <path>",
    "Qwen config directory (default: ~/.qwen, or specify project-level .qwen/)"
  )
  .option(
    "--amp-home <path>",
    "Amp config directory (default: ~/.config/amp, or specify project-level .amp/)"
  )
  .option(
    "--cline-home <path>",
    "Cline config directory (default: ~/.cline, or specify project-level .cline/)"
  )
  .option(
    "--windsurf-home <path>",
    "Windsurf config directory (default: ~/.codeium/windsurf, or specify project-level)"
  )
  .option("--report <format>", "output format: text or json", "text")
  .action((opts) => {
    const targets = opts.target as SyncTarget[];
    const dryRun = opts.dryRun as boolean;
    const skipBackup = !opts.backup;
    const skipOAuth = opts.skipOauth as boolean;
    const serverFilter = opts.server as string[] | undefined;
    const codexHome = opts.codexHome as string | undefined;
    const kimiHome = opts.kimiHome as string | undefined;
    const vibeHome = opts.vibeHome as string | undefined;
    const qwenHome = opts.qwenHome as string | undefined;
    const ampHome = opts.ampHome as string | undefined;
    const clineHome = opts.clineHome as string | undefined;
    const windsurfHome = opts.windsurfHome as string | undefined;
    const reportFormat = opts.report as string;
    const jsonReport = reportFormat === "json";

    if (reportFormat !== "text" && reportFormat !== "json") {
      console.error(`Invalid --report: ${reportFormat}. Use "text" or "json".`);
      process.exit(1);
    }

    if (!jsonReport && dryRun) {
      console.log("🔍 Dry-run mode — no files will be written\n");
    }

    const result = reconcileTargets(targets, {
      dryRun,
      skipBackup,
      skipOAuth,
      serverFilter,
      codexHome,
      kimiHome,
      vibeHome,
      qwenHome,
      ampHome,
      clineHome,
      windsurfHome,
    });

    if (jsonReport) {
      console.log(formatReconcileReport(result));
      if (result.status === "validation_failed" || result.status === "doctor_failed") {
        process.exit(2);
      }
      return;
    }

    if (result.status === "validation_failed") {
      console.error("❌ Validation failed. Fix schema errors before reconcile.\n");
      const grouped = groupValidationByTarget(result.validation.issues, targets);
      for (const target of targets) {
        const issues = grouped[target].filter((issue) => issue.severity === "error");
        if (issues.length === 0) continue;
        console.error(`--- ${getTargetLabel(target)} ---`);
        for (const issue of issues) {
          console.error(`  ❌ [${issue.code}] ${issue.server}: ${issue.message}`);
        }
        console.error();
      }
      process.exit(2);
    }

    if (result.status === "doctor_failed") {
      console.error("❌ Target config parse error detected. Fix target config and retry.");
      process.exit(2);
    }

    if (result.validation.warningCount > 0) {
      console.log(`⚠ Validation warnings: ${result.validation.warningCount}\n`);
    }

    if (result.status === "noop") {
      console.log("✅ No drift detected. Nothing to reconcile.");
      return;
    }

    if (result.backupDir) {
      console.log(`💾 Backup directory: ${result.backupDir}\n`);
    }

    console.log("🔄 Reconcile results\n");
    for (const syncResult of result.syncResults) {
      const label = getTargetLabel(syncResult.target);
      console.log(`--- ${label} ---`);
      console.log(`  Missing before reconcile: ${syncResult.missing.join(", ")}`);
      if (syncResult.added.length > 0) {
        console.log(`  ✅ Added: ${syncResult.added.join(", ")}`);
      }
      if (syncResult.skipped.length > 0) {
        console.log(`  ⏭  Skipped: ${syncResult.skipped.join(", ")}`);
      }
      console.log();
    }

    console.log("✅ Reconcile complete!");
  });

program
  .command("sync-instructions")
  .description("Sync CLAUDE.md instruction files to other AI agent formats")
  .option(
    "-t, --target <targets...>",
    "sync targets (gemini, codex, opencode, kiro, cursor, kimi, vibe, qwen, amp, cline, windsurf)",
    [
      "gemini",
      "codex",
      "opencode",
      "kiro",
      "cursor",
      "kimi",
      "vibe",
      "qwen",
      "amp",
      "cline",
      "windsurf",
    ]
  )
  .option("--global", "sync global config (~/.claude/CLAUDE.md)", false)
  .option(
    "--local",
    "sync project-level CLAUDE.md in current directory (prefers ./.claude/CLAUDE.md, falls back to ./CLAUDE.md)",
    false
  )
  .option("--dry-run", "preview mode, no files will be written", false)
  .option("--no-backup", "skip backup")
  .option("--import-mode <mode>", "how to handle standalone @imports: inline or strip", "inline")
  .option(
    "--allow-unsafe-imports",
    "allow standalone @imports to read files outside current project root",
    false
  )
  .option("--report <format>", "output format: text or json", "text")
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
    const importMode = opts.importMode as ImportMode;
    const allowUnsafeImports = opts.allowUnsafeImports as boolean;
    const reportFormat = opts.report as string;
    const jsonReport = reportFormat === "json";
    const forceAction = onConflict ?? (jsonReport ? "overwrite" : undefined);

    if (reportFormat !== "text" && reportFormat !== "json") {
      console.error(`Invalid --report: ${reportFormat}. Use "text" or "json".`);
      process.exit(1);
    }

    if (jsonReport && !dryRun && !skipBackup) {
      console.error("--report json requires --no-backup when not using --dry-run.");
      process.exit(1);
    }

    if (jsonReport && !dryRun && !onConflict) {
      console.error("--report json requires --on-conflict when not using --dry-run.");
      process.exit(1);
    }

    if (importMode !== "inline" && importMode !== "strip") {
      console.error(`Invalid --import-mode: ${importMode}. Use "inline" or "strip".`);
      process.exit(1);
    }

    // Default: sync both if neither flag is set
    const doGlobal = syncGlobal || (!syncGlobal && !syncLocal);
    const doLocal = syncLocal || (!syncGlobal && !syncLocal);

    if (!jsonReport && dryRun) {
      console.log("🔍 Dry-run mode — no files will be written\n");
    }

    const unsupported = doGlobal ? getUnsupportedGlobalTargets(targets) : [];
    let globalResult:
      | {
          synced: string[];
          skipped: string[];
          appended: string[];
        }
      | undefined;
    let localResult:
      | {
          synced: string[];
          skipped: string[];
          appended: string[];
        }
      | undefined;

    // Global sync
    if (doGlobal) {
      if (!jsonReport) {
        console.log("📋 Syncing global instructions (~/.claude/CLAUDE.md)...\n");
        for (const msg of unsupported) {
          console.log(`  ⚠  ${msg}`);
        }
      }

      const pairs = getGlobalSyncPairs(targets);
      if (!jsonReport) {
        backupTargets(pairs, skipBackup, dryRun);
      }
      globalResult = await syncInstructions(pairs, {
        dryRun,
        force: forceAction,
        importMode,
        allowUnsafeImports,
      });
      if (!jsonReport) {
        printInstructionsResult(globalResult);
      }
    }

    // Local sync
    if (doLocal) {
      if (!jsonReport) {
        console.log("📋 Syncing local instructions (./.claude/CLAUDE.md or ./CLAUDE.md)...\n");
      }
      const pairs = getLocalSyncPairs(targets, process.cwd());
      if (!jsonReport) {
        backupTargets(pairs, skipBackup, dryRun);
      }
      localResult = await syncInstructions(pairs, {
        dryRun,
        force: forceAction,
        importMode,
        allowUnsafeImports,
      });
      if (!jsonReport) {
        printInstructionsResult(localResult);
      }
    }

    if (jsonReport) {
      console.log(
        formatSyncInstructionsReport({
          unsupportedGlobalTargets: unsupported,
          global: globalResult,
          local: localResult,
        })
      );
      return;
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

function readExistingServerNames(configPath: string, key: string = "mcpServers"): Set<string> {
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

function printDiff(
  targetName: string,
  shared: string[],
  onlyInClaude: string[],
  onlyInTarget: string[]
) {
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

function getTargetLabel(target: SyncTarget): string {
  if (target === "opencode") return "OpenCode";
  if (target === "kimi") return "Kimi";
  if (target === "vibe") return "Vibe";
  if (target === "qwen") return "Qwen";
  if (target === "amp") return "Amp";
  if (target === "cline") return "Cline";
  if (target === "windsurf") return "Windsurf";
  return target.toUpperCase();
}

program.parse();
