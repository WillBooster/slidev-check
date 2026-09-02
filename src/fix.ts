import fs from 'node:fs';
import type { Fix, Violation } from './types.ts';

/** Rewrites the slide files with the fixes attached to the violations and returns how many were applied. */
export function applyFixes(violations: Violation[]): number {
  const fixesByFile = new Map<string, Fix[]>();
  for (const violation of violations) {
    if (!violation.fix) continue;
    const fixes = fixesByFile.get(violation.slide.filepath) ?? [];
    fixes.push(violation.fix);
    fixesByFile.set(violation.slide.filepath, fixes);
  }
  let applied = 0;
  for (const [filepath, fixes] of fixesByFile) {
    const lines = fs.readFileSync(filepath, 'utf8').split('\n');
    for (const fix of fixes) {
      const line = lines[fix.line - 1];
      // The file may have changed since it was rendered; only rewrite what still matches.
      if (line === undefined || !line.includes(fix.from)) continue;
      lines[fix.line - 1] = line.replace(fix.from, fix.to);
      applied++;
    }
    fs.writeFileSync(filepath, lines.join('\n'));
  }
  return applied;
}
