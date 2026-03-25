import { createBackup, getFilesToBackup } from "./backup.js";
import { runDoctor, type DoctorReport } from "./doctor.js";
import { readClaudeMcpServers } from "./reader.js";
import {
  validateServersForTargets,
  type ValidationIssue,
  type ValidationReport,
} from "./validation.js";
import { isOAuthOnlyServer } from "./oauth.js";
import type { SyncTarget, UnifiedMcpServer } from "./types.js";
import { writeToGemini } from "./writers/gemini.js";
import { writeToCodex, resolveCodexConfigPath } from "./writers/codex.js";
import { writeToOpenCode } from "./writers/opencode.js";
import { writeToKiro } from "./writers/kiro.js";
import { writeToCursor } from "./writers/cursor.js";
import { writeToKimi, resolveKimiMcpConfigPath } from "./writers/kimi.js";

export interface ReconcileOptions {
  dryRun?: boolean;
  skipBackup?: boolean;
  skipOAuth?: boolean;
  codexHome?: string;
  kimiHome?: string;
}

type ReconcileStatus = "validation_failed" | "doctor_failed" | "noop" | "reconciled";

export interface ReconcileTargetResult {
  target: SyncTarget;
  missing: string[];
  added: string[];
  skipped: string[];
}

export interface ReconcileResult {
  status: ReconcileStatus;
  validation: ValidationReport;
  doctor?: DoctorReport;
  syncResults: ReconcileTargetResult[];
  backupDir?: string;
}

export function reconcileTargets(
  targets: SyncTarget[],
  options: ReconcileOptions = {}
): ReconcileResult {
  let servers = readClaudeMcpServers();
  if (options.skipOAuth) {
    servers = servers.filter((server) => !isOAuthOnlyServer(server));
  }

  const validation = validateServersForTargets(servers, targets, { skipOAuth: options.skipOAuth });
  if (validation.errorCount > 0) {
    return {
      status: "validation_failed",
      validation,
      syncResults: [],
    };
  }

  const doctor = runDoctor(targets, {
    skipOAuth: options.skipOAuth,
    codexHome: options.codexHome,
    kimiHome: options.kimiHome,
  });
  if (doctor.hasErrors) {
    return {
      status: "doctor_failed",
      validation,
      doctor,
      syncResults: [],
    };
  }

  if (!doctor.hasDrift) {
    return {
      status: "noop",
      validation,
      doctor,
      syncResults: [],
    };
  }

  const mapByName = new Map<string, UnifiedMcpServer>(
    servers.map((server) => [server.name, server])
  );
  const targetsToSync: SyncTarget[] = [];
  const plan = new Map<SyncTarget, UnifiedMcpServer[]>();
  const syncResults: ReconcileTargetResult[] = [];

  for (const result of doctor.results) {
    if (result.status !== "drift" || result.missing.length === 0) continue;
    targetsToSync.push(result.target);

    const neededServers = result.missing
      .map((name) => mapByName.get(name))
      .filter((server): server is UnifiedMcpServer => Boolean(server));
    plan.set(result.target, neededServers);
  }

  let backupDir: string | undefined;
  if (!options.dryRun && !options.skipBackup && targetsToSync.length > 0) {
    const codexConfigPath = resolveCodexConfigPath(options.codexHome);
    const kimiConfigPath = resolveKimiMcpConfigPath(options.kimiHome);
    backupDir = createBackup(getFilesToBackup(targetsToSync, codexConfigPath, kimiConfigPath));
  }

  for (const result of doctor.results) {
    if (result.status !== "drift" || result.missing.length === 0) continue;
    const neededServers = plan.get(result.target) ?? [];
    const writeResult = writeTarget(
      result.target,
      neededServers,
      Boolean(options.dryRun),
      options.codexHome,
      options.kimiHome
    );
    syncResults.push({
      target: result.target,
      missing: result.missing,
      added: writeResult.added,
      skipped: writeResult.skipped,
    });
  }

  return {
    status: "reconciled",
    validation,
    doctor,
    syncResults,
    backupDir,
  };
}

function writeTarget(
  target: SyncTarget,
  servers: UnifiedMcpServer[],
  dryRun: boolean,
  codexHome?: string,
  kimiHome?: string
): { added: string[]; skipped: string[] } {
  if (target === "gemini") {
    return writeToGemini(servers, dryRun);
  }
  if (target === "codex") {
    const { added, skipped } = writeToCodex(servers, dryRun, codexHome);
    return { added, skipped };
  }
  if (target === "opencode") {
    return writeToOpenCode(servers, dryRun);
  }
  if (target === "kiro") {
    return writeToKiro(servers, dryRun);
  }
  if (target === "kimi") {
    const { added, skipped } = writeToKimi(servers, dryRun, kimiHome);
    return { added, skipped };
  }
  return writeToCursor(servers, dryRun);
}

export function groupValidationByTarget(
  issues: ValidationIssue[],
  targets: SyncTarget[]
): Record<SyncTarget, ValidationIssue[]> {
  const grouped: Record<SyncTarget, ValidationIssue[]> = {
    gemini: [],
    codex: [],
    opencode: [],
    kiro: [],
    kimi: [],
    cursor: [],
  };
  for (const target of targets) {
    grouped[target] ??= [];
  }
  for (const issue of issues) {
    grouped[issue.target].push(issue);
  }
  return grouped;
}
