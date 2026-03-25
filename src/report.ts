import type { DoctorReport } from "./doctor.js";
import type { ReconcileResult } from "./reconcile.js";
import type { ValidationReport } from "./validation.js";
import type { SyncTarget } from "./types.js";
import type { SyncInstructionsResult } from "./instructions.js";

const REPORT_SCHEMA_VERSION = 1;

interface ReconcileReportPayload {
  schemaVersion: number;
  command: "reconcile";
  status: ReconcileResult["status"];
  validation: ReconcileResult["validation"];
  doctor?: ReconcileResult["doctor"];
  syncResults: ReconcileResult["syncResults"];
  backupDir?: string;
}

interface DoctorReportPayload extends DoctorReport {
  schemaVersion: number;
  command: "doctor";
  resultCount: number;
}

interface ValidationReportPayload extends ValidationReport {
  schemaVersion: number;
  command: "validate";
}

interface SyncTargetReport {
  target: SyncTarget;
  added: string[];
  skipped: string[];
  configPath?: string;
}

interface SyncReportPayload {
  schemaVersion: number;
  command: "sync";
  sourceCount: number;
  dryRun: boolean;
  skipOAuth: boolean;
  targets: SyncTargetReport[];
}

interface SyncInstructionsReportPayload {
  schemaVersion: number;
  command: "sync-instructions";
  unsupportedGlobalTargets: string[];
  global?: SyncInstructionsResult;
  local?: SyncInstructionsResult;
}

interface DiffTargetReport {
  target: string;
  shared: string[];
  onlyInSource: string[];
  onlyInTarget: string[];
  note?: string;
}

interface DiffReportPayload {
  schemaVersion: number;
  command: "diff";
  sourceCount: number;
  sourceNames: string[];
  targets: DiffTargetReport[];
}

export function formatReconcileReport(result: ReconcileResult): string {
  const payload: ReconcileReportPayload = {
    schemaVersion: REPORT_SCHEMA_VERSION,
    command: "reconcile",
    status: result.status,
    validation: result.validation,
    doctor: result.doctor,
    syncResults: result.syncResults,
    backupDir: result.backupDir,
  };
  return JSON.stringify(payload, null, 2);
}

export function formatDoctorReport(report: DoctorReport): string {
  const payload: DoctorReportPayload = {
    schemaVersion: REPORT_SCHEMA_VERSION,
    command: "doctor",
    resultCount: report.results.length,
    ...report,
  };
  return JSON.stringify(payload, null, 2);
}

export function formatValidationReport(report: ValidationReport): string {
  const payload: ValidationReportPayload = {
    schemaVersion: REPORT_SCHEMA_VERSION,
    command: "validate",
    ...report,
  };
  return JSON.stringify(payload, null, 2);
}

export function formatSyncReport(
  report: Omit<SyncReportPayload, "command" | "schemaVersion">
): string {
  const payload: SyncReportPayload = {
    schemaVersion: REPORT_SCHEMA_VERSION,
    command: "sync",
    ...report,
  };
  return JSON.stringify(payload, null, 2);
}

export function formatSyncInstructionsReport(
  report: Omit<SyncInstructionsReportPayload, "command" | "schemaVersion">
): string {
  const payload: SyncInstructionsReportPayload = {
    schemaVersion: REPORT_SCHEMA_VERSION,
    command: "sync-instructions",
    ...report,
  };
  return JSON.stringify(payload, null, 2);
}

export function formatDiffReport(
  report: Omit<DiffReportPayload, "command" | "schemaVersion">
): string {
  const payload: DiffReportPayload = {
    schemaVersion: REPORT_SCHEMA_VERSION,
    command: "diff",
    ...report,
  };
  return JSON.stringify(payload, null, 2);
}
