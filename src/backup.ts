import { existsSync, mkdirSync, copyFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { homedir } from "node:os";
import { PATHS } from "./paths.js";

export function createBackup(filePaths: string[]): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupDir = join(PATHS.backupDir, timestamp);
  const home = homedir();

  let backedUp = 0;
  for (const filePath of filePaths) {
    if (existsSync(filePath)) {
      // Preserve original path structure relative to home
      const relativePath = filePath.startsWith(home) ? filePath.slice(home.length + 1) : filePath;
      const dest = join(backupDir, relativePath);
      mkdirSync(dirname(dest), { recursive: true });
      copyFileSync(filePath, dest);
      backedUp++;
      console.log(`  Backed up: ${filePath}`);
    }
  }

  if (backedUp === 0) {
    console.log("  No files to back up");
  }

  return backupDir;
}

export function getFilesToBackup(
  targets: string[],
  codexConfigPath?: string,
  kimiConfigPath?: string
): string[] {
  const files = [PATHS.claudeJson, PATHS.claudeSettings];

  if (targets.includes("gemini")) {
    files.push(PATHS.geminiSettings);
  }
  if (targets.includes("codex")) {
    files.push(codexConfigPath ?? PATHS.codexConfig);
  }
  if (targets.includes("opencode")) {
    files.push(PATHS.openCodeConfig);
  }
  if (targets.includes("kiro")) {
    files.push(PATHS.kiroMcpConfig);
  }
  if (targets.includes("kimi")) {
    files.push(kimiConfigPath ?? PATHS.kimiMcpConfig);
  }
  if (targets.includes("cursor")) {
    files.push(PATHS.cursorMcpConfig);
  }

  return files;
}
