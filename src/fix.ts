import { runDoctor } from "./doctor.js";
import { readClaudeMcpServers } from "./reader.js";
import { reconcileTargets, type ReconcileResult } from "./reconcile.js";
import { validateServersForTargets, type ValidationReport } from "./validation.js";
import { isOAuthOnlyServer } from "./oauth.js";
import type { SyncTarget } from "./types.js";

export interface AutoFixOptions {
  mode: "doctor" | "validate";
  targets: SyncTarget[];
  dryRun?: boolean;
  skipBackup?: boolean;
  skipOAuth?: boolean;
  codexHome?: string;
  kimiHome?: string;
  vibeHome?: string;
}

export interface AutoFixResult {
  status: "noop" | "reconciled" | "failed";
  reason?: "validation" | "doctor_parse";
  validation?: ValidationReport;
  reconcile?: ReconcileResult;
}

export function runAutoFix(options: AutoFixOptions): AutoFixResult {
  if (options.mode === "doctor") {
    const doctor = runDoctor(options.targets, {
      skipOAuth: options.skipOAuth,
      codexHome: options.codexHome,
      kimiHome: options.kimiHome,
      vibeHome: options.vibeHome,
    });

    if (doctor.hasErrors) {
      return { status: "failed", reason: "doctor_parse" };
    }
    if (!doctor.hasDrift) {
      return { status: "noop" };
    }

    const reconcile = reconcileTargets(options.targets, {
      dryRun: options.dryRun,
      skipBackup: options.skipBackup,
      skipOAuth: options.skipOAuth,
      codexHome: options.codexHome,
      kimiHome: options.kimiHome,
      vibeHome: options.vibeHome,
    });
    const mapped = mapReconcileOutcome(reconcile.status);
    return {
      status: mapped.status,
      reason: mapped.reason,
      reconcile,
    };
  }

  let servers = readClaudeMcpServers();
  if (options.skipOAuth) {
    servers = servers.filter((server) => !isOAuthOnlyServer(server));
  }
  const validation = validateServersForTargets(servers, options.targets, {
    skipOAuth: options.skipOAuth,
  });

  if (validation.errorCount > 0) {
    return {
      status: "failed",
      reason: "validation",
      validation,
    };
  }

  const reconcile = reconcileTargets(options.targets, {
    dryRun: options.dryRun,
    skipBackup: options.skipBackup,
    skipOAuth: options.skipOAuth,
    codexHome: options.codexHome,
    kimiHome: options.kimiHome,
    vibeHome: options.vibeHome,
  });
  const mapped = mapReconcileOutcome(reconcile.status);
  return {
    status: mapped.status,
    reason: mapped.reason,
    validation,
    reconcile,
  };
}

function mapReconcileOutcome(
  status: ReconcileResult["status"]
): Pick<AutoFixResult, "status" | "reason"> {
  if (status === "noop") return { status: "noop" };
  if (status === "reconciled") return { status: "reconciled" };
  if (status === "validation_failed") return { status: "failed", reason: "validation" };
  return { status: "failed", reason: "doctor_parse" };
}
