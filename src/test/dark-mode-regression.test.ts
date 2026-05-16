import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "fs";
import { join, extname } from "path";

/**
 * Dark-mode regression guard.
 *
 * Scans the src/ tree for color patterns that are known to break in dark mode
 * when used without a `dark:` counterpart:
 *   - light pastel surfaces (bg-{gray,slate,zinc}-{50,100,200})
 *   - dark text on light bg without dark variant (text-{gray,slate,zinc}-{700,800,900})
 *
 * Saturated color families (red, green, blue, amber, …) are intentionally
 * excluded: they're typically used in semitransparent /10–/15 patterns or as
 * vivid accents with white text, both already dark-mode safe.
 *
 * If this test fails, add a `dark:` variant next to the offending class.
 */

const ROOT = join(process.cwd(), "src");
const EXTS = new Set([".ts", ".tsx"]);
const IGNORE_DIRS = new Set(["test", "__tests__", "node_modules"]);

// Files allowed to keep raw light colors (visual reference, ext docs, …)
const ALLOWLIST: ReadonlySet<string> = new Set([
  "src/pages/StyleGuide.tsx",
]);

const FORBIDDEN = [
  /\bbg-(?:gray|slate|zinc)-(?:50|100|200)\b/,
  /\btext-(?:gray|slate|zinc)-(?:700|800|900)\b/,
];

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (IGNORE_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, out);
    else if (EXTS.has(extname(entry))) out.push(full);
  }
  return out;
}

function hasDarkNeighbor(line: string): boolean {
  return /\bdark:/.test(line);
}

describe("dark mode color hygiene", () => {
  it("no light-only neutral surfaces or text without a dark: variant", () => {
    const offenders: string[] = [];

    for (const file of walk(ROOT)) {
      const rel = file.replace(process.cwd() + "/", "");
      if (ALLOWLIST.has(rel)) continue;

      const lines = readFileSync(file, "utf8").split("\n");
      lines.forEach((line, i) => {
        for (const pat of FORBIDDEN) {
          if (pat.test(line) && !hasDarkNeighbor(line)) {
            offenders.push(`${rel}:${i + 1}  ${line.trim().slice(0, 140)}`);
            break;
          }
        }
      });
    }

    expect(offenders, `Found ${offenders.length} dark-mode regressions:\n${offenders.join("\n")}`).toEqual([]);
  });
});
