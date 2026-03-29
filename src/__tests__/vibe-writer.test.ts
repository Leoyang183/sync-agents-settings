import { describe, it, expect, vi, beforeEach } from "vitest";
import { writeToVibe, resolveVibeConfigPath } from "../writers/vibe.js";
import * as fs from "node:fs";
import TOML from "@iarna/toml";
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

describe("resolveVibeConfigPath", () => {
  it("defaults to ~/.vibe/config.toml", () => {
    const path = resolveVibeConfigPath();
    expect(path).toMatch(/\.vibe\/config\.toml$/);
  });

  it("uses custom vibe home", () => {
    const path = resolveVibeConfigPath("/tmp/my-vibe");
    expect(path).toBe("/tmp/my-vibe/config.toml");
  });
});

describe("writeToVibe", () => {
  it("converts stdio servers to [[mcp_servers]] TOML format", () => {
    let written = "";
    const configPath = resolveVibeConfigPath();
    const vibeDir = configPath.replace(/\/config\.toml$/, "");

    mockFs.existsSync.mockImplementation((p) => {
      if (String(p) === vibeDir) return true;
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
      }),
    ];

    const result = writeToVibe(servers, false);

    expect(result.added).toEqual(["context7"]);
    const parsed = TOML.parse(written) as any;
    expect(parsed.mcp_servers).toBeInstanceOf(Array);
    expect(parsed.mcp_servers[0].name).toBe("context7");
    expect(parsed.mcp_servers[0].transport).toBe("stdio");
    expect(parsed.mcp_servers[0].command).toBe("npx");
    expect(parsed.mcp_servers[0].args).toEqual(["-y", "@upstash/context7-mcp"]);
  });

  it("converts http servers with transport streamable-http", () => {
    let written = "";
    const configPath = resolveVibeConfigPath();
    const vibeDir = configPath.replace(/\/config\.toml$/, "");

    mockFs.existsSync.mockImplementation((p) => {
      if (String(p) === vibeDir) return true;
      return false;
    });
    mockFs.writeFileSync.mockImplementation((_p, data) => {
      written = String(data);
    });

    const servers: UnifiedMcpServer[] = [
      makeServer({
        name: "supabase",
        transport: "http",
        url: "https://mcp.supabase.com/mcp",
      }),
    ];

    writeToVibe(servers, false);

    const parsed = TOML.parse(written) as any;
    expect(parsed.mcp_servers[0].name).toBe("supabase");
    expect(parsed.mcp_servers[0].transport).toBe("streamable-http");
    expect(parsed.mcp_servers[0].url).toBe("https://mcp.supabase.com/mcp");
  });

  it("converts sse servers with transport http", () => {
    let written = "";
    const configPath = resolveVibeConfigPath();
    const vibeDir = configPath.replace(/\/config\.toml$/, "");

    mockFs.existsSync.mockImplementation((p) => {
      if (String(p) === vibeDir) return true;
      return false;
    });
    mockFs.writeFileSync.mockImplementation((_p, data) => {
      written = String(data);
    });

    const servers: UnifiedMcpServer[] = [
      makeServer({
        name: "legacy-sse",
        transport: "sse",
        url: "https://example.com/sse",
      }),
    ];

    writeToVibe(servers, false);

    const parsed = TOML.parse(written) as any;
    expect(parsed.mcp_servers[0].transport).toBe("http");
    expect(parsed.mcp_servers[0].url).toBe("https://example.com/sse");
  });

  it("preserves env vars", () => {
    let written = "";
    const configPath = resolveVibeConfigPath();
    const vibeDir = configPath.replace(/\/config\.toml$/, "");

    mockFs.existsSync.mockImplementation((p) => {
      if (String(p) === vibeDir) return true;
      return false;
    });
    mockFs.writeFileSync.mockImplementation((_p, data) => {
      written = String(data);
    });

    const servers: UnifiedMcpServer[] = [
      makeServer({
        name: "n8n",
        command: "npx",
        args: ["n8n-mcp"],
        env: { API_KEY: "secret", URL: "https://example.com" },
      }),
    ];

    writeToVibe(servers, false);

    const parsed = TOML.parse(written) as any;
    expect(parsed.mcp_servers[0].env.API_KEY).toBe("secret");
    expect(parsed.mcp_servers[0].env.URL).toBe("https://example.com");
  });

  it("skips existing servers by name", () => {
    const configPath = resolveVibeConfigPath();
    const vibeDir = configPath.replace(/\/config\.toml$/, "");

    mockFs.existsSync.mockImplementation((p) => {
      if (String(p) === vibeDir) return true;
      if (String(p) === configPath) return true;
      return false;
    });
    mockFs.readFileSync.mockReturnValue(
      '[[mcp_servers]]\nname = "context7"\ntransport = "stdio"\ncommand = "npx"\n'
    );

    const servers: UnifiedMcpServer[] = [makeServer({ name: "context7", command: "npx" })];

    const result = writeToVibe(servers, false);
    expect(result.added).toEqual([]);
    expect(result.skipped).toEqual(["context7 (already exists)"]);
  });

  it("does not write in dry-run mode", () => {
    const configPath = resolveVibeConfigPath();
    const vibeDir = configPath.replace(/\/config\.toml$/, "");

    mockFs.existsSync.mockImplementation((p) => {
      if (String(p) === vibeDir) return true;
      return false;
    });

    const result = writeToVibe([makeServer({ name: "test", command: "node" })], true);
    expect(result.added).toEqual(["test"]);
    expect(mockFs.writeFileSync).not.toHaveBeenCalled();
  });

  it("skips when vibe directory does not exist", () => {
    mockFs.existsSync.mockReturnValue(false);

    const servers: UnifiedMcpServer[] = [makeServer({ name: "test", command: "node" })];

    const result = writeToVibe(servers, false);
    expect(result.added).toEqual([]);
    expect(result.skipped[0]).toContain("does not exist");
  });

  it("respects custom vibe-home", () => {
    const result = writeToVibe(
      [makeServer({ name: "test", command: "node" })],
      true,
      "/tmp/custom-vibe"
    );
    expect(result.configPath).toBe("/tmp/custom-vibe/config.toml");
  });

  it("expands ${VAR:-default} in URLs", () => {
    let written = "";
    const configPath = resolveVibeConfigPath();
    const vibeDir = configPath.replace(/\/config\.toml$/, "");

    mockFs.existsSync.mockImplementation((p) => {
      if (String(p) === vibeDir) return true;
      return false;
    });
    mockFs.writeFileSync.mockImplementation((_p, data) => {
      written = String(data);
    });

    const servers: UnifiedMcpServer[] = [
      makeServer({
        name: "posthog",
        transport: "http",
        url: "${POSTHOG_MCP_URL:-https://mcp.posthog.com/mcp}",
      }),
    ];

    writeToVibe(servers, false);

    const parsed = TOML.parse(written) as any;
    expect(parsed.mcp_servers[0].url).toBe("https://mcp.posthog.com/mcp");
  });

  it("skips OAuth-only servers", () => {
    const configPath = resolveVibeConfigPath();
    const vibeDir = configPath.replace(/\/config\.toml$/, "");

    mockFs.existsSync.mockImplementation((p) => {
      if (String(p) === vibeDir) return true;
      return false;
    });

    const servers: UnifiedMcpServer[] = [
      makeServer({
        name: "slack",
        transport: "http",
        oauth: { clientId: "abc" },
      }),
    ];

    const result = writeToVibe(servers, false);
    expect(result.added).toEqual([]);
    expect(result.skipped).toEqual(["slack (requires manual OAuth)"]);
  });
});
