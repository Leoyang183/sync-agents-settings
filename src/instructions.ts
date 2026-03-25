import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { basename, dirname, resolve, relative } from "node:path";
import { homedir } from "node:os";
import { PATHS } from "./paths.js";
import { askConflictAction, type ConflictAction } from "./prompt.js";

export type InstructionsTarget = "gemini" | "codex" | "opencode" | "kiro" | "cursor" | "kimi";
export type ImportMode = "inline" | "strip";

interface SyncPair {
  source: string;
  target: string;
  targetLabel: string;
  /** Optional content transform before writing (e.g. Kiro frontmatter injection) */
  transform?: (content: string) => string;
}

const STANDALONE_IMPORT_LINE = /^@(\S+)\s*$/;
const FRONTMATTER_BLOCK = /^---\n([\s\S]*?)\n---\n?/;

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
    } else if (target === "kimi") {
      pairs.push({
        source: PATHS.claudeMdGlobal,
        target: PATHS.kimiMdGlobal,
        targetLabel: "Kimi CLI (~/.kimi/AGENTS.md)",
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
  const modernSource = resolve(cwd, ".claude", "CLAUDE.md");
  const legacySource = resolve(cwd, "CLAUDE.md");
  const source = existsSync(modernSource) ? modernSource : legacySource;
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
    } else if (target === "kimi") {
      // Kimi reads ./AGENTS.md — shared path with Codex/OpenCode
      const targetPath = resolve(cwd, "AGENTS.md");
      if (!seenPaths.has(targetPath)) {
        pairs.push({ source, target: targetPath, targetLabel: "Kimi CLI (./AGENTS.md)" });
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
      if (STANDALONE_IMPORT_LINE.test(trimmed)) {
        return false;
      }
      return true;
    })
    .join("\n");
}

function resolveImportPath(importPath: string, currentFile: string): string {
  if (importPath.startsWith("~/")) {
    return resolve(homedir(), importPath.slice(2));
  }
  if (importPath.startsWith("/")) {
    return resolve(importPath);
  }
  return resolve(dirname(currentFile), importPath);
}

function expandStandaloneImports(
  filePath: string,
  ancestry: Set<string>,
  importedFiles: Set<string>
): string {
  const raw = readFileSync(filePath, "utf-8");
  const out: string[] = [];

  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    const match = trimmed.match(STANDALONE_IMPORT_LINE);
    if (!match) {
      out.push(line);
      continue;
    }

    const importPath = resolveImportPath(match[1], filePath);
    if (!existsSync(importPath) || ancestry.has(importPath)) {
      continue;
    }

    importedFiles.add(importPath);
    const nextAncestry = new Set(ancestry);
    nextAncestry.add(importPath);
    const imported = expandStandaloneImports(importPath, nextAncestry, importedFiles).trim();
    if (imported) {
      out.push(imported);
    }
  }

  return out.join("\n");
}

function getClaudeRulesDir(sourcePath: string): string {
  const sourceDir = dirname(sourcePath);
  if (basename(sourceDir) === ".claude") {
    return resolve(sourceDir, "rules");
  }
  return resolve(sourceDir, ".claude", "rules");
}

function getProjectRootFromSource(sourcePath: string): string {
  const sourceDir = dirname(sourcePath);
  if (basename(sourceDir) === ".claude") {
    return dirname(sourceDir);
  }
  return sourceDir;
}

function normalizePathSlashes(path: string): string {
  return path.replace(/\\/g, "/");
}

function globToRegex(pattern: string): RegExp {
  const normalized = normalizePathSlashes(pattern).replace(/^\.\//, "");
  let out = "^";
  for (let i = 0; i < normalized.length; i += 1) {
    const ch = normalized[i];
    const next = normalized[i + 1];
    if (ch === "*" && next === "*") {
      out += ".*";
      i += 1;
      continue;
    }
    if (ch === "*") {
      out += "[^/]*";
      continue;
    }
    if (ch === "?") {
      out += "[^/]";
      continue;
    }
    if (/[[\]{}()+.^$|\\]/.test(ch)) {
      out += `\\${ch}`;
      continue;
    }
    out += ch;
  }
  out += "$";
  return new RegExp(out);
}

function parsePathsListValue(value: string): string[] {
  const trimmed = value.trim();
  if (!trimmed) return [];
  if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
    return trimmed
      .slice(1, -1)
      .split(",")
      .map((item) => item.trim().replace(/^['"]|['"]$/g, ""))
      .filter(Boolean);
  }
  return [trimmed.replace(/^['"]|['"]$/g, "")];
}

function parseFrontmatterPaths(content: string): string[] | null {
  const matched = content.match(FRONTMATTER_BLOCK);
  if (!matched) return null;

  const fm = matched[1].split("\n");
  const paths: string[] = [];

  for (let i = 0; i < fm.length; i += 1) {
    const line = fm[i].trim();
    if (!line.startsWith("paths:")) continue;

    const rest = line.slice("paths:".length).trim();
    if (rest) {
      paths.push(...parsePathsListValue(rest));
      continue;
    }

    for (let j = i + 1; j < fm.length; j += 1) {
      const item = fm[j].trim();
      if (!item.startsWith("- ")) break;
      const value = item.slice(2).trim().replace(/^['"]|['"]$/g, "");
      if (value) paths.push(value);
      i = j;
    }
  }

  return paths.length > 0 ? paths : null;
}

function matchesAnyPathPattern(patterns: string[], relativeFiles: string[]): boolean {
  const regexes = patterns.map(globToRegex);
  return relativeFiles.some((file) => regexes.some((re) => re.test(normalizePathSlashes(file))));
}

function listMarkdownFilesRecursively(dirPath: string): string[] {
  const files: string[] = [];
  let entries: { name: string; isDirectory: () => boolean; isFile: () => boolean }[];
  try {
    entries = readdirSync(dirPath, { withFileTypes: true }) as {
      name: string;
      isDirectory: () => boolean;
      isFile: () => boolean;
    }[];
  } catch {
    return files;
  }
  if (!Array.isArray(entries)) {
    return files;
  }
  for (const entry of entries) {
    const fullPath = resolve(dirPath, entry.name);
    if (entry.isDirectory()) {
      files.push(...listMarkdownFilesRecursively(fullPath));
      continue;
    }
    if (entry.isFile() && entry.name.endsWith(".md")) {
      files.push(fullPath);
    }
  }
  return files.sort();
}

function listProjectFilesRecursively(rootPath: string): string[] {
  const results: string[] = [];

  function walk(current: string): void {
    let entries: { name: string; isDirectory: () => boolean; isFile: () => boolean }[];
    try {
      entries = readdirSync(current, { withFileTypes: true }) as {
        name: string;
        isDirectory: () => boolean;
        isFile: () => boolean;
      }[];
    } catch {
      return;
    }
    if (!Array.isArray(entries)) return;

    for (const entry of entries) {
      const full = resolve(current, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === ".git" || entry.name === "node_modules") continue;
        walk(full);
        continue;
      }
      if (entry.isFile()) {
        results.push(relative(rootPath, full));
      }
    }
  }

  walk(rootPath);
  return results;
}

function loadSourceContentWithRules(sourcePath: string, importMode: ImportMode): string | null {
  const parts: string[] = [];
  const importedFiles = new Set<string>();
  const projectRoot = getProjectRootFromSource(sourcePath);
  const shouldFilterByPaths = resolve(sourcePath) !== resolve(PATHS.claudeMdGlobal);
  const projectFiles = shouldFilterByPaths ? listProjectFilesRecursively(projectRoot) : [];

  if (existsSync(sourcePath)) {
    const sourceBody =
      importMode === "inline"
        ? expandStandaloneImports(sourcePath, new Set([sourcePath]), importedFiles).trim()
        : readFileSync(sourcePath, "utf-8").trim();
    if (sourceBody) {
      parts.push(sourceBody);
    }
  }

  const rulesDir = getClaudeRulesDir(sourcePath);
  if (existsSync(rulesDir)) {
    const ruleFiles = listMarkdownFilesRecursively(rulesDir).filter(
      (ruleFile) => ruleFile !== sourcePath && !importedFiles.has(ruleFile)
    );

    for (const ruleFile of ruleFiles) {
      const ruleBody =
        importMode === "inline"
          ? expandStandaloneImports(ruleFile, new Set([ruleFile]), importedFiles).trim()
          : readFileSync(ruleFile, "utf-8").trim();
      if (!ruleBody) continue;
      const pathPatterns = parseFrontmatterPaths(ruleBody);
      if (
        shouldFilterByPaths &&
        pathPatterns &&
        pathPatterns.length > 0 &&
        !matchesAnyPathPattern(pathPatterns, projectFiles)
      ) {
        continue;
      }
      const ruleLabel = relative(rulesDir, ruleFile);
      parts.push(`<!-- Synced extra rule: ${ruleLabel} -->\n\n${stripExistingFrontmatter(ruleBody).trim()}`);
    }
  }

  if (parts.length === 0) {
    return null;
  }
  return filterClaudeSpecificSyntax(parts.join("\n\n"));
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
    importMode?: ImportMode;
  }
): Promise<SyncInstructionsResult> {
  const result: SyncInstructionsResult = { synced: [], skipped: [], appended: [] };
  const importMode = options.importMode ?? "inline";
  // Cache filtered source content to avoid re-reading the same file per target
  const sourceCache = new Map<string, string | null>();

  for (const pair of pairs) {
    if (!sourceCache.has(pair.source)) {
      sourceCache.set(pair.source, loadSourceContentWithRules(pair.source, importMode));
    }

    const filtered = sourceCache.get(pair.source);
    if (filtered === null || filtered === undefined) {
      const reason = !existsSync(pair.source) ? "source not found" : "source is empty";
      result.skipped.push(`${pair.targetLabel} (${reason}: ${pair.source})`);
      continue;
    }

    const content = pair.transform ? pair.transform(filtered) : filtered;

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
