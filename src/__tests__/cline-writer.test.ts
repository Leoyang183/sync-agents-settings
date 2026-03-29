import { describe, it, expect, vi, beforeEach } from "vitest";
import { writeToCline, resolveClineMcpConfigPath } from "../writers/cline.js";
import * as fs from "node:fs";
import type { UnifiedMcpServer } from "../types.js";

vi.mock("node:fs");
const mockFs = vi.mocked(fs);

beforeEach(() => {
  vi.clearAllMocks();
});

function makeServer(overrides: Partial<UnifiedMcpServer> & { name: string }): UnifiedMcpServer {
  return {
    transport: "stdio",
    source: "claude-config",
    ...overrides,
  };
}

describe("resolveClineMcpConfigPath", () => {
  it("defaults to ~/.cline/data/settings/cline_mcp_settings.json", () => {
    const path = resolveClineMcpConfigPath();
    expect(path).toMatch(/\.cline\/data\/settings\/cline_mcp_settings\.json$/);
  });

  it("uses custom cline home", () => {
    const path = resolveClineMcpConfigPath("/tmp/my-cline");
    expect(path).toBe("/tmp/my-cline/data/settings/cline_mcp_settings.json");
  });
});

describe("writeToCline", () => {
  it("converts stdio servers with command/args/env", () => {
    let written = "";
    const configPath = resolveClineMcpConfigPath("/tmp/cline-home");
    const configDir = configPath.replace(/\/[^/]+$/, "");
    mockFs.existsSync.mockImplementation((p) => {
      if (String(p) === configDir) return true;
      return false;
    });
    mockFs.writeFileSync.mockImplementation((_p, data) => {
      written = String(data);
    });

    const servers: UnifiedMcpServer[] = [
      makeServer({
        name: "context7",
        command: "npx",
        args: ["-y", "@upstash/context7-mcp"],
        env: { KEY: "value" },
      }),
    ];

    const result = writeToCline(servers, false, "/tmp/cline-home");

    expect(result.configPath).toBe(configPath);
    expect(result.added).toEqual(["context7"]);
    const parsed = JSON.parse(written);
    expect(parsed.mcpServers.context7.command).toBe("npx");
    expect(parsed.mcpServers.context7.args).toEqual(["-y", "@upstash/context7-mcp"]);
    expect(parsed.mcpServers.context7.env).toEqual({ KEY: "value" });
  });

  it("converts http/sse servers to url with headers", () => {
    let written = "";
    const configPath = resolveClineMcpConfigPath("/tmp/cline-home");
    const configDir = configPath.replace(/\/[^/]+$/, "");
    mockFs.existsSync.mockImplementation((p) => {
      if (String(p) === configDir) return true;
      return false;
    });
    mockFs.writeFileSync.mockImplementation((_p, data) => {
      written = String(data);
    });

    const servers: UnifiedMcpServer[] = [
      makeServer({
        name: "sentry",
        transport: "http",
        url: "https://mcp.sentry.dev/mcp",
        headers: { Authorization: "Bearer abc" },
      }),
    ];

    writeToCline(servers, false, "/tmp/cline-home");

    const parsed = JSON.parse(written);
    expect(parsed.mcpServers.sentry.url).toBe("https://mcp.sentry.dev/mcp");
    expect(parsed.mcpServers.sentry.headers).toEqual({ Authorization: "Bearer abc" });
  });

  it("skips existing servers", () => {
    const configPath = resolveClineMcpConfigPath("/tmp/cline-home");
    const configDir = configPath.replace(/\/[^/]+$/, "");
    mockFs.existsSync.mockImplementation((p) => {
      if (String(p) === configDir) return true;
      if (String(p) === configPath) return true;
      return false;
    });
    mockFs.readFileSync.mockReturnValue(
      JSON.stringify({ mcpServers: { context7: { command: "npx" } } })
    );

    const servers: UnifiedMcpServer[] = [makeServer({ name: "context7", command: "npx" })];

    const result = writeToCline(servers, false, "/tmp/cline-home");
    expect(result.added).toEqual([]);
    expect(result.skipped).toEqual(["context7 (already exists)"]);
  });

  it("does not write in dry-run mode", () => {
    const configPath = resolveClineMcpConfigPath("/tmp/cline-home");
    const configDir = configPath.replace(/\/[^/]+$/, "");
    mockFs.existsSync.mockImplementation((p) => {
      if (String(p) === configDir) return true;
      return false;
    });

    const servers: UnifiedMcpServer[] = [makeServer({ name: "test", command: "node" })];

    writeToCline(servers, true, "/tmp/cline-home");
    expect(mockFs.writeFileSync).not.toHaveBeenCalled();
  });

  it("skips when cline config directory does not exist", () => {
    mockFs.existsSync.mockReturnValue(false);

    const servers: UnifiedMcpServer[] = [makeServer({ name: "test", command: "node" })];

    const result = writeToCline(servers, false, "/tmp/missing-cline");
    expect(result.added).toEqual([]);
    expect(result.skipped[0]).toContain("does not exist");
    expect(result.skipped[0]).toContain("Cline CLI");
  });

  it("skips OAuth-only servers", () => {
    const configPath = resolveClineMcpConfigPath("/tmp/cline-home");
    const configDir = configPath.replace(/\/[^/]+$/, "");
    mockFs.existsSync.mockImplementation((p) => {
      if (String(p) === configDir) return true;
      return false;
    });

    const servers: UnifiedMcpServer[] = [
      makeServer({
        name: "oauth-only",
        transport: "http",
        oauth: { clientId: "abc" },
      }),
    ];

    const result = writeToCline(servers, false, "/tmp/cline-home");
    expect(result.added).toEqual([]);
    expect(result.skipped[0]).toContain("requires manual OAuth");
  });
});
