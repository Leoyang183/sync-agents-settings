import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import TOML from "@iarna/toml";

const TEST_DIR = join(tmpdir(), `sync-agents-e2e-${Date.now()}`);
const FAKE_HOME = join(TEST_DIR, "home");

// Directories
const claudeDir = join(FAKE_HOME, ".claude");
const geminiDir = join(FAKE_HOME, ".gemini");
const codexDir = join(FAKE_HOME, ".codex");
const aiderDir = join(FAKE_HOME, ".aider");
const projectDir = join(TEST_DIR, "project");
const pluginCacheDir = join(claudeDir, "plugins", "cache", "test-mkt", "my-plugin", "1.0.0");
const TSX_BIN = join(process.cwd(), "node_modules", ".bin", "tsx");
const CLI_ENTRY = join(process.cwd(), "src", "cli.ts");

function runCli(...args: string[]): string {
  return execFileSync(TSX_BIN, [CLI_ENTRY, ...args], {
    encoding: "utf-8",
    env: {
      ...process.env,
      HOME: FAKE_HOME,
      // Override paths used by the tool
    },
    stdio: ["pipe", "pipe", "pipe"],
  });
}

function runCliAt(cwd: string, ...args: string[]): string {
  return execFileSync(TSX_BIN, [CLI_ENTRY, ...args], {
    encoding: "utf-8",
    cwd,
    env: {
      ...process.env,
      HOME: FAKE_HOME,
    },
    stdio: ["pipe", "pipe", "pipe"],
  });
}

function runCliWithStatus(...args: string[]): {
  status: number | null;
  stdout: string;
  stderr: string;
} {
  const result = spawnSync(TSX_BIN, [CLI_ENTRY, ...args], {
    encoding: "utf-8",
    env: {
      ...process.env,
      HOME: FAKE_HOME,
    },
    stdio: ["pipe", "pipe", "pipe"],
  });

  return {
    status: result.status,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
}

beforeEach(() => {
  // Create fake home structure
  mkdirSync(claudeDir, { recursive: true });
  mkdirSync(geminiDir, { recursive: true });
  mkdirSync(codexDir, { recursive: true });
  mkdirSync(aiderDir, { recursive: true });
  mkdirSync(join(projectDir, ".claude"), { recursive: true });
  mkdirSync(pluginCacheDir, { recursive: true });

  // Write .claude.json with MCP servers
  writeFileSync(
    join(FAKE_HOME, ".claude.json"),
    JSON.stringify({
      mcpServers: {
        "e2e-stdio": {
          command: "npx",
          args: ["-y", "test-mcp"],
          env: { KEY: "value" },
        },
        "e2e-http": {
          type: "http",
          url: "https://mcp.example.com",
        },
      },
    })
  );

  // Write settings.json with enabled plugins
  writeFileSync(
    join(claudeDir, "settings.json"),
    JSON.stringify({
      enabledPlugins: { "my-plugin@test-mkt": true },
    })
  );

  // Write plugin .mcp.json
  writeFileSync(
    join(pluginCacheDir, ".mcp.json"),
    JSON.stringify({
      "e2e-plugin": {
        command: "node",
        args: ["server.js"],
      },
    })
  );

  // Write existing gemini settings (should be preserved)
  writeFileSync(join(geminiDir, "settings.json"), JSON.stringify({ theme: "Dark", vimMode: true }));
  writeFileSync(join(claudeDir, "CLAUDE.md"), "# Global Instructions\nUse pnpm");
  writeFileSync(join(projectDir, ".claude", "CLAUDE.md"), "# Project Instructions\nUse pnpm");
});

afterEach(() => {
  rmSync(TEST_DIR, { recursive: true, force: true });
});

describe("E2E: CLI commands", () => {
  it("list shows all MCP servers", () => {
    const output = runCli("list");
    expect(output).toContain("e2e-stdio");
    expect(output).toContain("e2e-http");
    expect(output).toContain("e2e-plugin");
  });

  it("sync --dry-run does not modify files", () => {
    const geminiBefore = readFileSync(join(geminiDir, "settings.json"), "utf-8");

    runCli("sync", "--dry-run");

    const geminiAfter = readFileSync(join(geminiDir, "settings.json"), "utf-8");
    expect(geminiAfter).toBe(geminiBefore);
  });

  it("sync writes to gemini with correct format", () => {
    runCli("sync", "--target", "gemini", "--no-backup");

    const settings = JSON.parse(readFileSync(join(geminiDir, "settings.json"), "utf-8"));

    // Preserves existing settings
    expect(settings.theme).toBe("Dark");
    expect(settings.vimMode).toBe(true);

    // stdio → command/args
    expect(settings.mcpServers["e2e-stdio"]).toEqual({
      command: "npx",
      args: ["-y", "test-mcp"],
      env: { KEY: "value" },
    });

    // http → httpUrl
    expect(settings.mcpServers["e2e-http"]).toEqual({
      httpUrl: "https://mcp.example.com",
    });

    // plugin
    expect(settings.mcpServers["e2e-plugin"]).toEqual({
      command: "node",
      args: ["server.js"],
    });
  });

  it("sync writes to codex with correct TOML format", () => {
    runCli("sync", "--target", "codex", "--no-backup");

    const tomlContent = readFileSync(join(codexDir, "config.toml"), "utf-8");
    const parsed = TOML.parse(tomlContent) as any;

    // stdio
    expect(parsed.mcp_servers["e2e-stdio"].command).toBe("npx");
    expect(parsed.mcp_servers["e2e-stdio"].args).toEqual(["-y", "test-mcp"]);
    expect(parsed.mcp_servers["e2e-stdio"].env.KEY).toBe("value");

    // http → url
    expect(parsed.mcp_servers["e2e-http"].url).toBe("https://mcp.example.com");
  });

  it("sync creates backup preserving directory structure", () => {
    const output = runCli("sync", "--target", "gemini");

    // Find backup dir from output
    const backupMatch = output.match(/Backed up: (.+)/);
    expect(backupMatch).toBeTruthy();

    // Check backup dir exists with correct structure
    const backupBase = join(FAKE_HOME, ".sync-agents-backup");
    expect(existsSync(backupBase)).toBe(true);
  });

  it("sync is idempotent (re-run skips existing)", () => {
    runCli("sync", "--target", "gemini", "--no-backup");
    const output = runCli("sync", "--target", "gemini", "--no-backup");

    expect(output).toContain("already exists");
    expect(output).not.toContain("Added");
  });

  it("sync --codex-home writes to custom path", () => {
    const customDir = join(TEST_DIR, "custom-codex");
    mkdirSync(customDir, { recursive: true });

    runCli("sync", "--target", "codex", "--codex-home", customDir, "--no-backup");

    const tomlPath = join(customDir, "config.toml");
    expect(existsSync(tomlPath)).toBe(true);

    const parsed = TOML.parse(readFileSync(tomlPath, "utf-8")) as any;
    expect(parsed.mcp_servers["e2e-stdio"]).toBeDefined();
  });

  it("diff shows differences", () => {
    const output = runCli("diff", "--target", "gemini");
    expect(output).toContain("Only in Claude");
  });

  it("validate --fix --dry-run exits successfully (smoke)", () => {
    const result = runCliWithStatus("validate", "--fix", "--dry-run", "--target", "gemini");
    expect(result.status).toBe(0);
  });

  it("sync-instructions writes global aider conventions and updates .aider.conf.yml", () => {
    runCli(
      "sync-instructions",
      "--target",
      "aider",
      "--global",
      "--on-conflict",
      "overwrite",
      "--no-backup"
    );

    const conventions = readFileSync(join(aiderDir, "CONVENTIONS.md"), "utf-8");
    const aiderConf = readFileSync(join(FAKE_HOME, ".aider.conf.yml"), "utf-8");
    expect(conventions).toContain("Global Instructions");
    expect(aiderConf).toContain("read:");
    expect(aiderConf).toContain(join(aiderDir, "CONVENTIONS.md"));
  });

  it("sync-instructions writes project aider conventions and updates project .aider.conf.yml", () => {
    runCliAt(
      projectDir,
      "sync-instructions",
      "--target",
      "aider",
      "--local",
      "--on-conflict",
      "overwrite",
      "--no-backup"
    );

    const conventions = readFileSync(join(projectDir, ".aider", "CONVENTIONS.md"), "utf-8");
    const aiderConf = readFileSync(join(projectDir, ".aider.conf.yml"), "utf-8");
    expect(conventions).toContain("Project Instructions");
    expect(aiderConf).toContain("read:");
    expect(aiderConf).toContain(".aider/CONVENTIONS.md");
  });
});
