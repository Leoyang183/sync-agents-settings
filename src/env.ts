/**
 * Expand shell-style env var syntax that some CLIs don't support.
 * - `${VAR:-default}` → resolved env value, or `default` if unset
 * - `${VAR}` → resolved env value, or empty string if unset
 */
export function expandEnvVars(value: string): string {
  return value.replace(/\$\{(\w+)(?::-([^}]*))?\}/g, (_match, name, fallback) => {
    return process.env[name] ?? fallback ?? "";
  });
}

const SIMPLE_ENV_VAR = /\$\{([^}:]+)\}/g;

/**
 * Convert Claude `${VAR}` env-var references to a target-specific syntax.
 * Leaves `${VAR:-default}` untouched (the `:` in the character class excludes it).
 */
export function convertEnvVarSyntax(
  env: Record<string, string>,
  replacer: (varName: string) => string
): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, val] of Object.entries(env)) {
    result[key] = val.replace(SIMPLE_ENV_VAR, (_match, name) => replacer(name));
  }
  return result;
}
