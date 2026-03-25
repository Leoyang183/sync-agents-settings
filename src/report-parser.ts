export const SUPPORTED_REPORT_SCHEMA_VERSION = 1;

type ParsedReport = {
  schemaVersion: number;
  command?: string;
  [key: string]: unknown;
};

export type KnownReportCommand =
  | "sync"
  | "diff"
  | "doctor"
  | "validate"
  | "reconcile"
  | "sync-instructions";

export const KNOWN_REPORT_COMMANDS: KnownReportCommand[] = [
  "sync",
  "diff",
  "doctor",
  "validate",
  "reconcile",
  "sync-instructions",
];

type RequiredFieldType = "array" | "number" | "boolean" | "string";
interface RequiredFieldSpec {
  field: string;
  type: RequiredFieldType;
}

export interface ValidateReportV1 {
  schemaVersion: 1;
  command: "validate";
  issues: unknown[];
  errorCount: number;
  warningCount: number;
  [key: string]: unknown;
}

export interface DoctorReportV1 {
  schemaVersion: 1;
  command: "doctor";
  hasDrift: boolean;
  hasErrors: boolean;
  [key: string]: unknown;
}

export interface SyncReportV1 {
  schemaVersion: 1;
  command: "sync";
  targets: unknown[];
  [key: string]: unknown;
}

export interface DiffReportV1 {
  schemaVersion: 1;
  command: "diff";
  targets: unknown[];
  sourceNames: string[];
  [key: string]: unknown;
}

export interface ReconcileReportV1 {
  schemaVersion: 1;
  command: "reconcile";
  status: string;
  syncResults: unknown[];
  [key: string]: unknown;
}

export interface SyncInstructionsReportV1 {
  schemaVersion: 1;
  command: "sync-instructions";
  unsupportedGlobalTargets: string[];
  [key: string]: unknown;
}

export type KnownJsonReport =
  | ValidateReportV1
  | DoctorReportV1
  | SyncReportV1
  | DiffReportV1
  | ReconcileReportV1
  | SyncInstructionsReportV1;

type ParseErrorCode =
  | "INVALID_JSON"
  | "MISSING_SCHEMA_VERSION"
  | "UNSUPPORTED_SCHEMA_VERSION"
  | "INVALID_COMMAND_PAYLOAD"
  | "UNKNOWN_COMMAND";

export type ParseJsonReportResult =
  | { ok: true; data: ParsedReport }
  | { ok: false; error: { code: ParseErrorCode; message: string } };

export type ParseKnownJsonReportResult =
  | { ok: true; data: KnownJsonReport }
  | { ok: false; error: { code: ParseErrorCode; message: string } };

export function parseJsonReport(raw: string): ParseJsonReportResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return {
      ok: false,
      error: {
        code: "INVALID_JSON",
        message: "Input is not valid JSON.",
      },
    };
  }

  if (!parsed || typeof parsed !== "object") {
    return {
      ok: false,
      error: {
        code: "MISSING_SCHEMA_VERSION",
        message: "Report must be a JSON object with schemaVersion.",
      },
    };
  }

  const schemaVersion = (parsed as { schemaVersion?: unknown }).schemaVersion;
  if (typeof schemaVersion !== "number") {
    return {
      ok: false,
      error: {
        code: "MISSING_SCHEMA_VERSION",
        message: "schemaVersion is required.",
      },
    };
  }

  if (schemaVersion !== SUPPORTED_REPORT_SCHEMA_VERSION) {
    return {
      ok: false,
      error: {
        code: "UNSUPPORTED_SCHEMA_VERSION",
        message: `Unsupported schemaVersion ${schemaVersion}. Expected ${SUPPORTED_REPORT_SCHEMA_VERSION}.`,
      },
    };
  }

  const report = parsed as ParsedReport;
  if (!isValidCommandPayload(report)) {
    return {
      ok: false,
      error: {
        code: "INVALID_COMMAND_PAYLOAD",
        message: "Report payload does not match required fields for its command.",
      },
    };
  }

  return { ok: true, data: report };
}

export function parseKnownJsonReport(raw: string): ParseKnownJsonReportResult {
  const parsed = parseJsonReport(raw);
  if (!parsed.ok) {
    return parsed;
  }

  if (!isKnownReportCommand(parsed.data.command)) {
    return {
      ok: false,
      error: {
        code: "UNKNOWN_COMMAND",
        message: `Unsupported command in report: ${String(parsed.data.command)}`,
      },
    };
  }

  return { ok: true, data: parsed.data as KnownJsonReport };
}

function isValidCommandPayload(report: ParsedReport): boolean {
  if (typeof report.command !== "string") {
    return true;
  }

  if (isKnownReportCommand(report.command)) {
    return COMMAND_PAYLOAD_VALIDATORS[report.command](report);
  }

  // Unknown command: keep parser forward-compatible as long as schemaVersion matches.
  return true;
}

function isKnownReportCommand(value: unknown): value is KnownReportCommand {
  return typeof value === "string" && KNOWN_REPORT_COMMANDS.includes(value as KnownReportCommand);
}

export const COMMAND_REQUIRED_FIELDS: Record<KnownReportCommand, RequiredFieldSpec[]> = {
  sync: [{ field: "targets", type: "array" }],
  diff: [
    { field: "targets", type: "array" },
    { field: "sourceNames", type: "array" },
  ],
  doctor: [
    { field: "hasDrift", type: "boolean" },
    { field: "hasErrors", type: "boolean" },
  ],
  validate: [
    { field: "errorCount", type: "number" },
    { field: "warningCount", type: "number" },
  ],
  reconcile: [
    { field: "status", type: "string" },
    { field: "syncResults", type: "array" },
  ],
  "sync-instructions": [{ field: "unsupportedGlobalTargets", type: "array" }],
};

export const COMMAND_PAYLOAD_VALIDATORS: Record<
  KnownReportCommand,
  (report: ParsedReport) => boolean
> = {
  sync: (report) => hasRequiredFields(report, COMMAND_REQUIRED_FIELDS.sync),
  diff: (report) => hasRequiredFields(report, COMMAND_REQUIRED_FIELDS.diff),
  doctor: (report) => hasRequiredFields(report, COMMAND_REQUIRED_FIELDS.doctor),
  validate: (report) => hasRequiredFields(report, COMMAND_REQUIRED_FIELDS.validate),
  reconcile: (report) => hasRequiredFields(report, COMMAND_REQUIRED_FIELDS.reconcile),
  "sync-instructions": (report) =>
    hasRequiredFields(report, COMMAND_REQUIRED_FIELDS["sync-instructions"]),
};

function hasRequiredFields(report: ParsedReport, specs: RequiredFieldSpec[]): boolean {
  return specs.every((spec) => matchesFieldType(report[spec.field], spec.type));
}

function matchesFieldType(value: unknown, type: RequiredFieldType): boolean {
  if (type === "array") return Array.isArray(value);
  return typeof value === type;
}
