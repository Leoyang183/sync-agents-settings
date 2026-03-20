import { describe, it, expect, vi, beforeEach } from "vitest";
import * as fs from "node:fs";
import {
  filterClaudeSpecificSyntax,
  syncInstructions,
  getGlobalSyncPairs,
  getLocalSyncPairs,
  getUnsupportedGlobalTargets,
  wrapForKiro,
  wrapForCursor,
} from "../instructions.js";
import { PATHS } from "../paths.js";

vi.mock("node:fs");
const mockFs = vi.mocked(fs);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("filterClaudeSpecificSyntax", () => {
  it("removes standalone @import lines", () => {
    const input = [
      "# My Project",
      "@README.md",
      "@~/.claude/my-rules.md",
      "Some text with @mention inside",
      "@src/components/guide.md",
      "## Commands",
    ].join("\n");

    const result = filterClaudeSpecificSyntax(input);
    expect(result).toBe(
      ["# My Project", "Some text with @mention inside", "## Commands"].join("\n")
    );
  });

  it("keeps inline @mentions", () => {
    const input = "See @README for overview and @package.json for commands.";
    expect(filterClaudeSpecificSyntax(input)).toBe(input);
  });

  it("returns empty content unchanged", () => {
    expect(filterClaudeSpecificSyntax("")).toBe("");
  });
});

describe("getGlobalSyncPairs", () => {
  it("returns gemini pair", () => {
    const pairs = getGlobalSyncPairs(["gemini"]);
    expect(pairs).toHaveLength(1);
    expect(pairs[0].source).toBe(PATHS.claudeMdGlobal);
    expect(pairs[0].target).toBe(PATHS.geminiMdGlobal);
  });

  it("returns codex pair", () => {
    const pairs = getGlobalSyncPairs(["codex"]);
    expect(pairs).toHaveLength(1);
    expect(pairs[0].source).toBe(PATHS.claudeMdGlobal);
    expect(pairs[0].target).toBe(PATHS.codexMdGlobal);
  });

  it("returns both pairs", () => {
    const pairs = getGlobalSyncPairs(["gemini", "codex"]);
    expect(pairs).toHaveLength(2);
  });

  it("returns opencode pair", () => {
    const pairs = getGlobalSyncPairs(["opencode"]);
    expect(pairs).toHaveLength(1);
    expect(pairs[0].source).toBe(PATHS.claudeMdGlobal);
    expect(pairs[0].target).toBe(PATHS.openCodeMdGlobal);
  });

  it("returns kiro pair with transform", () => {
    const pairs = getGlobalSyncPairs(["kiro"]);
    expect(pairs).toHaveLength(1);
    expect(pairs[0].source).toBe(PATHS.claudeMdGlobal);
    expect(pairs[0].target).toBe(PATHS.kiroSteeringGlobal);
    expect(pairs[0].transform).toBeDefined();
  });

  it("returns all four pairs (cursor excluded from global)", () => {
    const pairs = getGlobalSyncPairs(["gemini", "codex", "opencode", "kiro", "cursor"]);
    // Cursor global is not supported (SQLite), so only 4 pairs
    expect(pairs).toHaveLength(4);
  });
});

describe("getUnsupportedGlobalTargets", () => {
  it("returns cursor as unsupported for global", () => {
    const unsupported = getUnsupportedGlobalTargets(["gemini", "cursor"]);
    expect(unsupported).toHaveLength(1);
    expect(unsupported[0]).toContain("Cursor");
    expect(unsupported[0]).toContain("SQLite");
  });

  it("returns empty when no unsupported targets", () => {
    const unsupported = getUnsupportedGlobalTargets(["gemini", "codex"]);
    expect(unsupported).toHaveLength(0);
  });
});

describe("getLocalSyncPairs", () => {
  it("builds pairs from cwd", () => {
    const pairs = getLocalSyncPairs(["gemini", "codex"], "/projects/myapp");
    expect(pairs).toHaveLength(2);
    expect(pairs[0].source).toBe("/projects/myapp/CLAUDE.md");
    expect(pairs[0].target).toBe("/projects/myapp/GEMINI.md");
    expect(pairs[1].target).toBe("/projects/myapp/AGENTS.md");
  });

  it("deduplicates AGENTS.md for codex and opencode", () => {
    const pairs = getLocalSyncPairs(["codex", "opencode"], "/projects/myapp");
    // Both Codex and OpenCode target ./AGENTS.md, should deduplicate
    expect(pairs).toHaveLength(1);
    expect(pairs[0].target).toBe("/projects/myapp/AGENTS.md");
  });

  it("builds kiro pair with .kiro/steering/ path", () => {
    const pairs = getLocalSyncPairs(["kiro"], "/projects/myapp");
    expect(pairs).toHaveLength(1);
    expect(pairs[0].target).toBe("/projects/myapp/.kiro/steering/claude-instructions.md");
    expect(pairs[0].transform).toBeDefined();
  });

  it("builds cursor pair with .cursor/rules/ path", () => {
    const pairs = getLocalSyncPairs(["cursor"], "/projects/myapp");
    expect(pairs).toHaveLength(1);
    expect(pairs[0].target).toBe("/projects/myapp/.cursor/rules/claude-instructions.mdc");
    expect(pairs[0].transform).toBeDefined();
  });

  it("builds all targets without duplicate AGENTS.md", () => {
    const pairs = getLocalSyncPairs(
      ["gemini", "codex", "opencode", "kiro", "cursor"],
      "/projects/myapp"
    );
    // gemini=GEMINI.md, codex=AGENTS.md, opencode=deduplicated, kiro=.kiro/steering/, cursor=.cursor/rules/
    expect(pairs).toHaveLength(4);
    const targets = pairs.map((p) => p.target);
    expect(targets).toContain("/projects/myapp/GEMINI.md");
    expect(targets).toContain("/projects/myapp/AGENTS.md");
    expect(targets).toContain("/projects/myapp/.kiro/steering/claude-instructions.md");
    expect(targets).toContain("/projects/myapp/.cursor/rules/claude-instructions.mdc");
  });
});

describe("syncInstructions", () => {
  it("writes content to new target file", async () => {
    let written = "";
    mockFs.existsSync.mockImplementation((p) => {
      if (String(p) === "/src/CLAUDE.md") return true;
      // target does not exist
      return false;
    });
    mockFs.readFileSync.mockImplementation((p) => {
      if (String(p) === "/src/CLAUDE.md") return "# Instructions\n\npnpm build";
      return "";
    });
    mockFs.writeFileSync.mockImplementation((_p, data) => {
      written = String(data);
    });
    mockFs.mkdirSync.mockReturnValue(undefined as unknown as string);

    const result = await syncInstructions(
      [{ source: "/src/CLAUDE.md", target: "/dst/GEMINI.md", targetLabel: "Gemini" }],
      { dryRun: false }
    );

    expect(result.synced).toEqual(["Gemini"]);
    expect(result.skipped).toEqual([]);
    expect(written).toContain("# Instructions");
    expect(written).toContain("pnpm build");
  });

  it("skips when source file not found", async () => {
    mockFs.existsSync.mockReturnValue(false);

    const result = await syncInstructions(
      [{ source: "/no/CLAUDE.md", target: "/dst/GEMINI.md", targetLabel: "Gemini" }],
      { dryRun: false }
    );

    expect(result.skipped).toHaveLength(1);
    expect(result.skipped[0]).toContain("source not found");
  });

  it("skips when source is empty", async () => {
    mockFs.existsSync.mockImplementation((p) => String(p) === "/src/CLAUDE.md");
    mockFs.readFileSync.mockReturnValue("   \n  ");

    const result = await syncInstructions(
      [{ source: "/src/CLAUDE.md", target: "/dst/GEMINI.md", targetLabel: "Gemini" }],
      { dryRun: false }
    );

    expect(result.skipped).toHaveLength(1);
    expect(result.skipped[0]).toContain("source is empty");
  });

  it("overwrites existing file with force=overwrite", async () => {
    let written = "";
    mockFs.existsSync.mockReturnValue(true);
    mockFs.readFileSync.mockImplementation((p) => {
      if (String(p) === "/src/CLAUDE.md") return "# New content";
      return "# Old content";
    });
    mockFs.writeFileSync.mockImplementation((_p, data) => {
      written = String(data);
    });
    mockFs.mkdirSync.mockReturnValue(undefined as unknown as string);

    const result = await syncInstructions(
      [{ source: "/src/CLAUDE.md", target: "/dst/GEMINI.md", targetLabel: "Gemini" }],
      { dryRun: false, force: "overwrite" }
    );

    expect(result.synced).toEqual(["Gemini"]);
    expect(written).toContain("# New content");
    expect(written).not.toContain("# Old content");
  });

  it("appends to existing file with force=append", async () => {
    let written = "";
    mockFs.existsSync.mockReturnValue(true);
    mockFs.readFileSync.mockImplementation((p) => {
      if (String(p) === "/src/CLAUDE.md") return "# Claude rules";
      if (String(p) === "/dst/GEMINI.md") return "# Existing gemini config";
      return "";
    });
    mockFs.writeFileSync.mockImplementation((_p, data) => {
      written = String(data);
    });
    mockFs.mkdirSync.mockReturnValue(undefined as unknown as string);

    const result = await syncInstructions(
      [{ source: "/src/CLAUDE.md", target: "/dst/GEMINI.md", targetLabel: "Gemini" }],
      { dryRun: false, force: "append" }
    );

    expect(result.appended).toEqual(["Gemini"]);
    expect(written).toContain("# Existing gemini config");
    expect(written).toContain("# Claude rules");
    expect(written).toContain("Synced from CLAUDE.md");
  });

  it("skips existing file with force=skip", async () => {
    mockFs.existsSync.mockReturnValue(true);
    mockFs.readFileSync.mockImplementation((p) => {
      if (String(p) === "/src/CLAUDE.md") return "# Content";
      return "";
    });

    const result = await syncInstructions(
      [{ source: "/src/CLAUDE.md", target: "/dst/GEMINI.md", targetLabel: "Gemini" }],
      { dryRun: false, force: "skip" }
    );

    expect(result.skipped).toEqual(["Gemini (skipped by user)"]);
    expect(mockFs.writeFileSync).not.toHaveBeenCalled();
  });

  it("filters @import lines from content", async () => {
    let written = "";
    mockFs.existsSync.mockImplementation((p) => String(p) === "/src/CLAUDE.md");
    mockFs.readFileSync.mockReturnValue("# Project\n@README.md\n## Build\npnpm build");
    mockFs.writeFileSync.mockImplementation((_p, data) => {
      written = String(data);
    });
    mockFs.mkdirSync.mockReturnValue(undefined as unknown as string);

    await syncInstructions(
      [{ source: "/src/CLAUDE.md", target: "/dst/GEMINI.md", targetLabel: "Gemini" }],
      { dryRun: false }
    );

    expect(written).toContain("# Project");
    expect(written).toContain("pnpm build");
    expect(written).not.toContain("@README.md");
  });

  it("dry-run does not write files", async () => {
    mockFs.existsSync.mockImplementation((p) => String(p) === "/src/CLAUDE.md");
    mockFs.readFileSync.mockReturnValue("# Content");

    const result = await syncInstructions(
      [{ source: "/src/CLAUDE.md", target: "/dst/GEMINI.md", targetLabel: "Gemini" }],
      { dryRun: true }
    );

    expect(result.synced).toEqual(["Gemini"]);
    expect(mockFs.writeFileSync).not.toHaveBeenCalled();
  });

  it("applies transform function when provided", async () => {
    let written = "";
    mockFs.existsSync.mockImplementation((p) => String(p) === "/src/CLAUDE.md");
    mockFs.readFileSync.mockReturnValue("# My Instructions");
    mockFs.writeFileSync.mockImplementation((_p, data) => {
      written = String(data);
    });
    mockFs.mkdirSync.mockReturnValue(undefined as unknown as string);

    await syncInstructions(
      [
        {
          source: "/src/CLAUDE.md",
          target: "/dst/steering/claude-instructions.md",
          targetLabel: "Kiro",
          transform: wrapForKiro,
        },
      ],
      { dryRun: false }
    );

    expect(written).toContain("---\ninclusion: always\n---");
    expect(written).toContain("# My Instructions");
  });
});

describe("wrapForKiro", () => {
  it("adds inclusion: always frontmatter to plain content", () => {
    const result = wrapForKiro("# My Rules\n\npnpm build");
    expect(result).toBe("---\ninclusion: always\n---\n\n# My Rules\n\npnpm build");
  });

  it("replaces existing frontmatter", () => {
    const input = "---\ntitle: old\n---\n\n# Content";
    const result = wrapForKiro(input);
    expect(result).toBe("---\ninclusion: always\n---\n\n# Content");
    expect(result).not.toContain("title: old");
  });

  it("handles content with no trailing newline", () => {
    const result = wrapForKiro("simple content");
    expect(result.startsWith("---\ninclusion: always\n---\n\n")).toBe(true);
    expect(result).toContain("simple content");
  });
});

describe("wrapForCursor", () => {
  it("adds alwaysApply frontmatter to plain content", () => {
    const result = wrapForCursor("# My Rules\n\npnpm build");
    expect(result).toContain("alwaysApply: true");
    expect(result).toContain('description: "Project instructions synced from CLAUDE.md"');
    expect(result).toContain("# My Rules");
    expect(result).toContain("pnpm build");
  });

  it("replaces existing frontmatter", () => {
    const input = "---\ntitle: old\n---\n\n# Content";
    const result = wrapForCursor(input);
    expect(result).toContain("alwaysApply: true");
    expect(result).toContain("# Content");
    expect(result).not.toContain("title: old");
  });

  it("produces valid .mdc format", () => {
    const result = wrapForCursor("Use TypeScript strict mode");
    // Should start with frontmatter delimiter
    expect(result.startsWith("---\n")).toBe(true);
    // Should have closing delimiter
    expect(result).toContain("\n---\n");
    expect(result).toContain("Use TypeScript strict mode");
  });
});
