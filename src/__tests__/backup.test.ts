import { describe, it, expect, vi, beforeEach } from "vitest";
import { createBackup, getFilesToBackup } from "../backup.js";
import * as fs from "node:fs";
import { PATHS } from "../paths.js";

vi.mock("node:fs");
const mockFs = vi.mocked(fs);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("createBackup", () => {
  it("copies existing files preserving directory structure", () => {
    const copied: Array<{ src: string; dest: string }> = [];
    mockFs.existsSync.mockReturnValue(true);
    mockFs.mkdirSync.mockReturnValue(undefined as any);
    mockFs.copyFileSync.mockImplementation((src, dest) => {
      copied.push({ src: String(src), dest: String(dest) });
    });

    const dir = createBackup([PATHS.claudeJson, PATHS.geminiSettings]);

    expect(dir).toContain(".sync-agents-backup");
    expect(copied).toHaveLength(2);
    // Should preserve relative path structure
    expect(copied[0]!.dest).toContain(".claude.json");
    expect(copied[1]!.dest).toContain(".gemini");
  });

  it("skips non-existent files", () => {
    mockFs.existsSync.mockReturnValue(false);
    mockFs.mkdirSync.mockReturnValue(undefined as any);

    createBackup(["/nonexistent/file.json"]);

    expect(mockFs.copyFileSync).not.toHaveBeenCalled();
  });
});

describe("getFilesToBackup", () => {
  it("always includes claude files", () => {
    const files = getFilesToBackup([]);
    expect(files).toContain(PATHS.claudeJson);
    expect(files).toContain(PATHS.claudeSettings);
  });

  it("includes gemini when targeted", () => {
    const files = getFilesToBackup(["gemini"]);
    expect(files).toContain(PATHS.geminiSettings);
  });

  it("includes codex when targeted", () => {
    const files = getFilesToBackup(["codex"]);
    expect(files).toContain(PATHS.codexConfig);
  });

  it("uses custom codex config path", () => {
    const files = getFilesToBackup(["codex"], "/custom/.codex/config.toml");
    expect(files).toContain("/custom/.codex/config.toml");
    expect(files).not.toContain(PATHS.codexConfig);
  });

  it("includes kimi when targeted", () => {
    const files = getFilesToBackup(["kimi"]);
    expect(files).toContain(PATHS.kimiMcpConfig);
  });
});
