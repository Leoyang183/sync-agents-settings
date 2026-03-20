import { createInterface } from "node:readline";

export type ConflictAction = "overwrite" | "append" | "skip";

/**
 * Ask user how to handle an existing target file.
 * Returns the chosen action.
 */
export async function askConflictAction(targetPath: string): Promise<ConflictAction> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });

  return new Promise((resolve) => {
    console.log(`\n⚠️  Target file already exists: ${targetPath}`);
    console.log("   [o] Overwrite — replace with CLAUDE.md content");
    console.log("   [a] Append   — keep existing content + add CLAUDE.md below");
    console.log("   [s] Skip     — do nothing");

    rl.question("   Choose action (o/a/s): ", (answer) => {
      rl.close();
      const normalized = answer.trim().toLowerCase();
      if (normalized === "o" || normalized === "overwrite") {
        resolve("overwrite");
      } else if (normalized === "a" || normalized === "append") {
        resolve("append");
      } else {
        resolve("skip");
      }
    });
  });
}
