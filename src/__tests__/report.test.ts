import { describe, it, expect } from "vitest";
import {
  formatReconcileReport,
  formatDoctorReport,
  formatValidationReport,
  formatSyncReport,
  formatSyncInstructionsReport,
  formatDiffReport,
} from "../report.js";
import type { ReconcileResult } from "../reconcile.js";
import type { DoctorReport } from "../doctor.js";
import type { ValidationReport } from "../validation.js";
import type { SyncTarget } from "../types.js";

describe("formatReconcileReport", () => {
  it("returns machine-readable json payload", () => {
    const result: ReconcileResult = {
      status: "reconciled",
      validation: { issues: [], errorCount: 0, warningCount: 1 },
      doctor: {
        sourceCount: 2,
        sourceNames: ["a", "b"],
        hasDrift: true,
        hasErrors: false,
        results: [{ target: "gemini", status: "drift", missing: ["a"], extra: [] }],
      },
      syncResults: [{ target: "gemini", missing: ["a"], added: ["a"], skipped: [] }],
    };

    const text = formatReconcileReport(result);
    const payload = JSON.parse(text) as {
      schemaVersion: number;
      status: string;
      validation: { errorCount: number; warningCount: number };
      doctor: { hasDrift: boolean };
      syncResults: Array<{ target: string; added: string[] }>;
    };

    expect(payload.schemaVersion).toBe(1);
    expect(payload.status).toBe("reconciled");
    expect(payload.validation.warningCount).toBe(1);
    expect(payload.doctor.hasDrift).toBe(true);
    expect(payload.syncResults[0]?.target).toBe("gemini");
    expect(payload.syncResults[0]?.added).toEqual(["a"]);
  });
});

describe("formatDoctorReport", () => {
  it("returns machine-readable doctor payload", () => {
    const report: DoctorReport = {
      sourceCount: 2,
      sourceNames: ["a", "b"],
      hasDrift: true,
      hasErrors: false,
      results: [{ target: "gemini", status: "drift", missing: ["a"], extra: [] }],
    };

    const text = formatDoctorReport(report);
    const payload = JSON.parse(text) as {
      schemaVersion: number;
      command: string;
      hasDrift: boolean;
      resultCount: number;
      results: Array<{ target: string; status: string }>;
    };

    expect(payload.schemaVersion).toBe(1);
    expect(payload.command).toBe("doctor");
    expect(payload.hasDrift).toBe(true);
    expect(payload.resultCount).toBe(1);
    expect(payload.results[0]?.target).toBe("gemini");
  });
});

describe("formatValidationReport", () => {
  it("returns machine-readable validate payload", () => {
    const report: ValidationReport = {
      issues: [
        {
          target: "codex",
          server: "sentry",
          severity: "warning",
          code: "CODEX_UNSUPPORTED_HEADERS",
          message: "unsupported headers",
        },
      ],
      errorCount: 0,
      warningCount: 1,
    };

    const text = formatValidationReport(report);
    const payload = JSON.parse(text) as {
      schemaVersion: number;
      command: string;
      errorCount: number;
      warningCount: number;
      issues: Array<{ code: string }>;
    };

    expect(payload.schemaVersion).toBe(1);
    expect(payload.command).toBe("validate");
    expect(payload.errorCount).toBe(0);
    expect(payload.warningCount).toBe(1);
    expect(payload.issues[0]?.code).toBe("CODEX_UNSUPPORTED_HEADERS");
  });
});

describe("formatSyncReport", () => {
  it("returns machine-readable sync payload", () => {
    const report = {
      sourceCount: 2,
      dryRun: true,
      skipOAuth: false,
      targets: [
        {
          target: "gemini" as SyncTarget,
          added: ["a"],
          skipped: ["b (already exists)"],
          configPath: undefined,
        },
      ],
    };

    const text = formatSyncReport(report);
    const payload = JSON.parse(text) as {
      schemaVersion: number;
      command: string;
      sourceCount: number;
      dryRun: boolean;
      targets: Array<{ target: string; added: string[]; skipped: string[] }>;
    };

    expect(payload.schemaVersion).toBe(1);
    expect(payload.command).toBe("sync");
    expect(payload.sourceCount).toBe(2);
    expect(payload.dryRun).toBe(true);
    expect(payload.targets[0]?.target).toBe("gemini");
    expect(payload.targets[0]?.added).toEqual(["a"]);
  });
});

describe("formatSyncInstructionsReport", () => {
  it("returns machine-readable sync-instructions payload", () => {
    const text = formatSyncInstructionsReport({
      global: {
        synced: ["Gemini CLI (~/.gemini/GEMINI.md)"],
        skipped: [],
        appended: [],
      },
      local: {
        synced: [],
        skipped: ["Codex CLI (./AGENTS.md) (skipped by user)"],
        appended: ["Kiro CLI (.kiro/steering/claude-instructions.md)"],
      },
      unsupportedGlobalTargets: ["Cursor global unsupported"],
    });

    const payload = JSON.parse(text) as {
      schemaVersion: number;
      command: string;
      unsupportedGlobalTargets: string[];
      global?: { synced: string[] };
      local?: { appended: string[]; skipped: string[] };
    };

    expect(payload.schemaVersion).toBe(1);
    expect(payload.command).toBe("sync-instructions");
    expect(payload.unsupportedGlobalTargets).toEqual(["Cursor global unsupported"]);
    expect(payload.global?.synced).toEqual(["Gemini CLI (~/.gemini/GEMINI.md)"]);
    expect(payload.local?.appended).toEqual(["Kiro CLI (.kiro/steering/claude-instructions.md)"]);
    expect(payload.local?.skipped).toEqual(["Codex CLI (./AGENTS.md) (skipped by user)"]);
  });
});

describe("formatDiffReport", () => {
  it("returns machine-readable diff payload", () => {
    const text = formatDiffReport({
      sourceCount: 3,
      sourceNames: ["a", "b", "c"],
      targets: [
        {
          target: "gemini",
          shared: ["a"],
          onlyInSource: ["b", "c"],
          onlyInTarget: ["x"],
        },
      ],
    });

    const payload = JSON.parse(text) as {
      schemaVersion: number;
      command: string;
      sourceCount: number;
      targets: Array<{
        target: string;
        shared: string[];
        onlyInSource: string[];
        onlyInTarget: string[];
      }>;
    };

    expect(payload.schemaVersion).toBe(1);
    expect(payload.command).toBe("diff");
    expect(payload.sourceCount).toBe(3);
    expect(payload.targets[0]?.target).toBe("gemini");
    expect(payload.targets[0]?.shared).toEqual(["a"]);
    expect(payload.targets[0]?.onlyInSource).toEqual(["b", "c"]);
    expect(payload.targets[0]?.onlyInTarget).toEqual(["x"]);
  });
});
