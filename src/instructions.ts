import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { PATHS } from "./paths.js";
import { askConflictAction, type ConflictAction } from "./prompt.js";

export type InstructionsTarget = "gemini" | "codex" | "opencode" | "kiro" | "cursor";

interface SyncPair {
  source: string;
  target: string;
  targetLabel: string;
  /** Optional content transform before writing (e.g. Kiro frontmatter injection) */
  transform?: (content: string) => string;
}

/**
 * Strip existing YAML frontmatter (--- ... ---) from content.
 * Returns the body without the frontmatter block.
 */
function stripExistingFrontmatter(content: string): string {
  if (content.trimStart().startsWith("---")) {
    const lines = content.trimStart().split("\n");
    const endIdx = lines.indexOf("---", 1);
    if (endIdx !== -1) {
      return lines
        .slice(endIdx + 1)
        .join("\n")
        .trimStart();
    }
  }
  return content;
}

/** Wrap content with Kiro steering frontmatter (inclusion: always). */
export function wrapForKiro(content: string): string {
  return "---\ninclusion: always\n---\n\n" + stripExistingFrontmatter(content);
}

/** Wrap content with Cursor .mdc frontmatter (alwaysApply: true). */
export function wrapForCursor(content: string): string {
  return (
    '---\ndescription: "Project instructions synced from CLAUDE.md"\nalwaysApply: true\n---\n\n' +
    stripExistingFrontmatter(content)
  );
}

/**
 * Build source→target pairs for global instruction sync.
 * Note: Cursor global rules are stored in SQLite — not supported.
 */
export function getGlobalSyncPairs(targets: InstructionsTarget[]): SyncPair[] {
  const pairs: SyncPair[] = [];
  for (const target of targets) {
    if (target === "gemini") {
      pairs.push({
        source: PATHS.claudeMdGlobal,
        target: PATHS.geminiMdGlobal,
        targetLabel: "Gemini CLI (~/.gemini/GEMINI.md)",
      });
    } else if (target === "codex") {
      pairs.push({
        source: PATHS.claudeMdGlobal,
        target: PATHS.codexMdGlobal,
        targetLabel: "Codex CLI (~/.codex/AGENTS.md)",
      });
    } else if (target === "opencode") {
      pairs.push({
        source: PATHS.claudeMdGlobal,
        target: PATHS.openCodeMdGlobal,
        targetLabel: "OpenCode (~/.config/opencode/AGENTS.md)",
      });
    } else if (target === "kiro") {
      pairs.push({
        source: PATHS.claudeMdGlobal,
        target: PATHS.kiroSteeringGlobal,
        targetLabel: "Kiro CLI (~/.kiro/steering/claude-instructions.md)",
        transform: wrapForKiro,
      });
    }
    // Cursor global rules are stored in SQLite, not supported for global sync
  }
  return pairs;
}

/**
 * Returns targets that don't support global instruction sync.
 */
export function getUnsupportedGlobalTargets(targets: InstructionsTarget[]): string[] {
  const unsupported: string[] = [];
  if (targets.includes("cursor")) {
    unsupported.push("Cursor (global rules stored in SQLite, use Cursor Settings UI instead)");
  }
  return unsupported;
}

/**
 * Build source→target pairs for local (project-level) instruction sync.
 * Looks for CLAUDE.md in the current working directory.
 */
export function getLocalSyncPairs(targets: InstructionsTarget[], cwd: string): SyncPair[] {
  const pairs: SyncPair[] = [];
  const source = resolve(cwd, "CLAUDE.md");
  // Track targets that share the same output path to avoid duplicate writes
  const seenPaths = new Set<string>();

  for (const target of targets) {
    if (target === "gemini") {
      const targetPath = resolve(cwd, "GEMINI.md");
      pairs.push({ source, target: targetPath, targetLabel: "Gemini CLI (./GEMINI.md)" });
      seenPaths.add(targetPath);
    } else if (target === "codex") {
      const targetPath = resolve(cwd, "AGENTS.md");
      if (!seenPaths.has(targetPath)) {
        pairs.push({ source, target: targetPath, targetLabel: "Codex CLI (./AGENTS.md)" });
        seenPaths.add(targetPath);
      }
    } else if (target === "opencode") {
      // OpenCode reads ./AGENTS.md — same path as Codex, skip if already added
      const targetPath = resolve(cwd, "AGENTS.md");
      if (!seenPaths.has(targetPath)) {
        pairs.push({ source, target: targetPath, targetLabel: "OpenCode (./AGENTS.md)" });
        seenPaths.add(targetPath);
      }
    } else if (target === "kiro") {
      pairs.push({
        source,
        target: resolve(cwd, ".kiro", "steering", "claude-instructions.md"),
        targetLabel: "Kiro CLI (.kiro/steering/claude-instructions.md)",
        transform: wrapForKiro,
      });
    } else if (target === "cursor") {
      pairs.push({
        source,
        target: resolve(cwd, ".cursor", "rules", "claude-instructions.mdc"),
        targetLabel: "Cursor (.cursor/rules/claude-instructions.mdc)",
        transform: wrapForCursor,
      });
    }
  }
  return pairs;
}

/**
 * Filter out Claude-specific syntax that other tools won't understand.
 * - Removes `@filepath` import lines (lines that are just `@some/path.md`)
 * - Keeps `@mentions` inside sentences (those are fine as plain text)
 */
export function filterClaudeSpecificSyntax(content: string): string {
  return content
    .split("\n")
    .filter((line) => {
      const trimmed = line.trim();
      // Remove standalone @import lines: lines that are just "@path/to/file.md"
      if (/^@[\w.~\-/\\]+\.md\s*$/.test(trimmed)) {
        return false;
      }
      return true;
    })
    .join("\n");
}

const APPEND_SEPARATOR = "\n\n---\n\n<!-- Synced from CLAUDE.md by sync-agents-settings -->\n\n";

export interface SyncInstructionsResult {
  synced: string[];
  skipped: string[];
  appended: string[];
}

/**
 * Sync instruction files from CLAUDE.md to target agent files.
 */
export async function syncInstructions(
  pairs: SyncPair[],
  options: {
    dryRun: boolean;
    force?: ConflictAction;
  }
): Promise<SyncInstructionsResult> {
  const result: SyncInstructionsResult = { synced: [], skipped: [], appended: [] };
  // Cache filtered source content to avoid re-reading the same file per target
  const sourceCache = new Map<string, string | null>();

  for (const pair of pairs) {
    if (!sourceCache.has(pair.source)) {
      if (!existsSync(pair.source)) {
        sourceCache.set(pair.source, null);
      } else {
        const raw = readFileSync(pair.source, "utf-8");
        sourceCache.set(pair.source, raw.trim() ? filterClaudeSpecificSyntax(raw) : null);
      }
    }

    const filtered = sourceCache.get(pair.source);
    if (filtered === null || filtered === undefined) {
      const reason = !existsSync(pair.source) ? "source not found" : "source is empty";
      result.skipped.push(`${pair.targetLabel} (${reason}: ${pair.source})`);
      continue;
    }

    let content = pair.transform ? pair.transform(filtered) : filtered;

    let action: ConflictAction = "overwrite";

    if (existsSync(pair.target)) {
      if (options.force) {
        action = options.force;
      } else {
        action = await askConflictAction(pair.target);
      }

      if (action === "skip") {
        result.skipped.push(`${pair.targetLabel} (skipped by user)`);
        continue;
      }
    }

    if (!options.dryRun) {
      mkdirSync(dirname(pair.target), { recursive: true });

      if (action === "append") {
        const existing = readFileSync(pair.target, "utf-8");
        writeFileSync(pair.target, existing + APPEND_SEPARATOR + content + "\n");
        result.appended.push(pair.targetLabel);
      } else {
        writeFileSync(pair.target, content + "\n");
        result.synced.push(pair.targetLabel);
      }
    } else {
      if (action === "append") {
        result.appended.push(pair.targetLabel);
      } else {
        result.synced.push(pair.targetLabel);
      }
    }
  }

  return result;
}
