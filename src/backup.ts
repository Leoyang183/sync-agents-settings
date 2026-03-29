import { existsSync, mkdirSync, copyFileSync, chmodSync } from "node:fs";
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
      mkdirSync(dirname(dest), { recursive: true, mode: 0o700 });
      copyFileSync(filePath, dest);
      chmodSync(dest, 0o600);
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
  kimiConfigPath?: string,
  vibeConfigPath?: string,
  qwenConfigPath?: string,
  ampConfigPath?: string,
  clineConfigPath?: string
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
  if (targets.includes("vibe")) {
    files.push(vibeConfigPath ?? PATHS.vibeConfig);
  }
  if (targets.includes("qwen")) {
    files.push(qwenConfigPath ?? PATHS.qwenSettings);
  }
  if (targets.includes("amp")) {
    files.push(ampConfigPath ?? PATHS.ampSettings);
  }
  if (targets.includes("cline")) {
    files.push(clineConfigPath ?? PATHS.clineMcpConfig);
  }

  return files;
}
