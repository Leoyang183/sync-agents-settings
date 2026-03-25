import { describe, it, expect, vi, beforeEach } from "vitest";
import { reconcileTargets } from "../reconcile.js";
import * as reader from "../reader.js";
import * as validation from "../validation.js";
import * as doctor from "../doctor.js";
import * as geminiWriter from "../writers/gemini.js";
import * as codexWriter from "../writers/codex.js";
import * as opencodeWriter from "../writers/opencode.js";
import * as kiroWriter from "../writers/kiro.js";
import * as cursorWriter from "../writers/cursor.js";
import * as backup from "../backup.js";
import type { UnifiedMcpServer } from "../types.js";

vi.mock("../reader.js");
vi.mock("../validation.js");
vi.mock("../doctor.js");
vi.mock("../writers/gemini.js");
vi.mock("../writers/codex.js");
vi.mock("../writers/opencode.js");
vi.mock("../writers/kiro.js");
vi.mock("../writers/cursor.js");
vi.mock("../backup.js");

const mockReadClaudeMcpServers = vi.mocked(reader.readClaudeMcpServers);
const mockValidateServersForTargets = vi.mocked(validation.validateServersForTargets);
const mockRunDoctor = vi.mocked(doctor.runDoctor);
const mockWriteToGemini = vi.mocked(geminiWriter.writeToGemini);
const mockWriteToCodex = vi.mocked(codexWriter.writeToCodex);
const mockWriteToOpenCode = vi.mocked(opencodeWriter.writeToOpenCode);
const mockWriteToKiro = vi.mocked(kiroWriter.writeToKiro);
const mockWriteToCursor = vi.mocked(cursorWriter.writeToCursor);
const mockCreateBackup = vi.mocked(backup.createBackup);
const mockGetFilesToBackup = vi.mocked(backup.getFilesToBackup);

function makeServer(name: string): UnifiedMcpServer {
  return {
    name,
    source: "claude-config",
    transport: "stdio",
    command: "npx",
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockValidateServersForTargets.mockReturnValue({ issues: [], errorCount: 0, warningCount: 0 });
  mockWriteToGemini.mockReturnValue({ added: [], skipped: [] });
  mockWriteToCodex.mockReturnValue({
    added: [],
    skipped: [],
    configPath: "/tmp/.codex/config.toml",
  });
  mockWriteToOpenCode.mockReturnValue({ added: [], skipped: [] });
  mockWriteToKiro.mockReturnValue({ added: [], skipped: [] });
  mockWriteToCursor.mockReturnValue({ added: [], skipped: [] });
  mockCreateBackup.mockReturnValue("/tmp/backup");
  mockGetFilesToBackup.mockReturnValue(["/tmp/a"]);
});

describe("reconcileTargets", () => {
  it("stops when validation has errors", () => {
    mockReadClaudeMcpServers.mockReturnValue([makeServer("a")]);
    mockValidateServersForTargets.mockReturnValue({
      issues: [
        {
          target: "gemini",
          server: "a",
          severity: "error",
          code: "INVALID_STDIO_COMMAND_REQUIRED",
          message: "broken",
        },
      ],
      errorCount: 1,
      warningCount: 0,
    });

    const result = reconcileTargets(["gemini"]);

    expect(result.status).toBe("validation_failed");
    expect(mockRunDoctor).not.toHaveBeenCalled();
    expect(mockWriteToGemini).not.toHaveBeenCalled();
  });

  it("syncs only missing servers for drift targets", () => {
    mockReadClaudeMcpServers.mockReturnValue([makeServer("a"), makeServer("b"), makeServer("c")]);
    mockRunDoctor.mockReturnValue({
      sourceCount: 3,
      sourceNames: ["a", "b", "c"],
      hasDrift: true,
      hasErrors: false,
      results: [
        { target: "gemini", status: "drift", missing: ["a", "b"], extra: [] },
        { target: "codex", status: "ok", missing: [], extra: [] },
      ],
    });

    const result = reconcileTargets(["gemini", "codex"], {
      dryRun: true,
      codexHome: "/tmp/.codex",
    });

    expect(result.status).toBe("reconciled");
    expect(mockWriteToGemini).toHaveBeenCalledWith(
      [expect.objectContaining({ name: "a" }), expect.objectContaining({ name: "b" })],
      true
    );
    expect(mockWriteToCodex).not.toHaveBeenCalled();
  });

  it("creates backup when changes will be written", () => {
    mockReadClaudeMcpServers.mockReturnValue([makeServer("a")]);
    mockRunDoctor.mockReturnValue({
      sourceCount: 1,
      sourceNames: ["a"],
      hasDrift: true,
      hasErrors: false,
      results: [{ target: "gemini", status: "drift", missing: ["a"], extra: [] }],
    });

    reconcileTargets(["gemini"], { dryRun: false, skipBackup: false });

    expect(mockGetFilesToBackup).toHaveBeenCalled();
    expect(mockCreateBackup).toHaveBeenCalled();
  });

  it("skipOAuth keeps non-oauth-only servers in validation input", () => {
    mockReadClaudeMcpServers.mockReturnValue([
      {
        ...makeServer("oauth-with-command"),
        oauth: { clientId: "abc" },
      },
    ]);
    mockRunDoctor.mockReturnValue({
      sourceCount: 1,
      sourceNames: ["oauth-with-command"],
      hasDrift: false,
      hasErrors: false,
      results: [{ target: "gemini", status: "ok", missing: [], extra: [] }],
    });

    reconcileTargets(["gemini"], { skipOAuth: true });

    expect(mockValidateServersForTargets).toHaveBeenCalledWith(
      [expect.objectContaining({ name: "oauth-with-command" })],
      ["gemini"],
      { skipOAuth: true }
    );
  });
});
