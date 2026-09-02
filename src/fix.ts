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
    // Fixes on one line are applied from right to left so that earlier offsets stay valid,
    // and each is checked against the original text: the file may have changed since it was rendered.
    for (const fix of fixes.toSorted((a, b) => b.line - a.line || b.column - a.column)) {
      const line = lines[fix.line - 1];
      if (line === undefined || !line.startsWith(fix.from, fix.column)) continue;
      lines[fix.line - 1] = line.slice(0, fix.column) + fix.to + line.slice(fix.column + fix.from.length);
      applied++;
    }
    fs.writeFileSync(filepath, lines.join('\n'));
  }
  return applied;
}
