import { describe, it, expect, vi, beforeEach } from "vitest";
import { writeToKimi, resolveKimiMcpConfigPath } from "../writers/kimi.js";
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

describe("resolveKimiMcpConfigPath", () => {
  it("defaults to ~/.kimi/mcp.json", () => {
    const path = resolveKimiMcpConfigPath();
    expect(path).toMatch(/\.kimi\/mcp\.json$/);
  });

  it("uses custom kimi home", () => {
    const path = resolveKimiMcpConfigPath("/tmp/my-kimi");
    expect(path).toBe("/tmp/my-kimi/mcp.json");
  });
});

describe("writeToKimi", () => {
  it("converts stdio servers with command/args/env", () => {
    let written = "";
    const configPath = resolveKimiMcpConfigPath("/tmp/kimi-home");
    const kimiDir = "/tmp/kimi-home";
    mockFs.existsSync.mockImplementation((p) => {
      if (String(p) === kimiDir) return true;
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

    const result = writeToKimi(servers, false, "/tmp/kimi-home");

    expect(result.configPath).toBe(configPath);
    expect(result.added).toEqual(["context7"]);
    const parsed = JSON.parse(written);
    expect(parsed.mcpServers.context7.command).toBe("npx");
    expect(parsed.mcpServers.context7.args).toEqual(["-y", "@upstash/context7-mcp"]);
    expect(parsed.mcpServers.context7.env).toEqual({ KEY: "value" });
  });

  it("skips when kimi directory does not exist", () => {
    mockFs.existsSync.mockReturnValue(false);

    const servers: UnifiedMcpServer[] = [makeServer({ name: "test", command: "node" })];

    const result = writeToKimi(servers, false, "/tmp/missing-kimi");
    expect(result.added).toEqual([]);
    expect(result.skipped[0]).toContain("does not exist");
    expect(result.skipped[0]).toContain("Kimi CLI");
  });
});
