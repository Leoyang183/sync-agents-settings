import { homedir } from "node:os";
import { join } from "node:path";

const HOME = homedir();

export const PATHS = {
  // Claude Code
  claudeJson: join(HOME, ".claude.json"),
  claudeSettings: join(HOME, ".claude", "settings.json"),
  claudePluginCache: join(HOME, ".claude", "plugins", "cache"),

  // Gemini CLI
  geminiSettings: join(HOME, ".gemini", "settings.json"),

  // Codex CLI
  codexDir: join(HOME, ".codex"),
  codexConfig: join(HOME, ".codex", "config.toml"),

  // OpenCode
  openCodeConfig: join(HOME, ".config", "opencode", "opencode.json"),

  // Kiro CLI
  kiroMcpConfig: join(HOME, ".kiro", "settings", "mcp.json"),

  // Kimi CLI
  kimiMcpConfig: join(HOME, ".kimi", "mcp.json"),

  // Cursor
  cursorMcpConfig: join(HOME, ".cursor", "mcp.json"),

  // Vibe CLI (Mistral)
  vibeDir: join(HOME, ".vibe"),
  vibeConfig: join(HOME, ".vibe", "config.toml"),

  // Instructions (global)
  claudeMdGlobal: join(HOME, ".claude", "CLAUDE.md"),
  geminiMdGlobal: join(HOME, ".gemini", "GEMINI.md"),
  codexMdGlobal: join(HOME, ".codex", "AGENTS.md"),
  openCodeMdGlobal: join(HOME, ".config", "opencode", "AGENTS.md"),
  kiroSteeringGlobal: join(HOME, ".kiro", "steering", "claude-instructions.md"),
  kimiMdGlobal: join(HOME, ".kimi", "AGENTS.md"),
  vibeMdGlobal: join(HOME, ".vibe", "AGENTS.md"),
  aiderConventionsGlobal: join(HOME, ".aider", "CONVENTIONS.md"),
  aiderConfigGlobal: join(HOME, ".aider.conf.yml"),

  // Backups
  backupDir: join(HOME, ".sync-agents-backup"),
} as const;
