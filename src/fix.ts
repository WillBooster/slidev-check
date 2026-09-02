import fs from 'node:fs';
import type { Fix, Violation } from './types.ts';

/**
 * Rewrites the slide files with the fixes attached to the violations. Fixes that no longer match
 * the file (it changed since it was rendered) are skipped; the count of the applied ones is returned.
 */
export function applyFixes(violations: Violation[]): number {
  const fixesByFile = new Map<string, Map<string, Fix | undefined>>();
  for (const { fix, slide } of violations) {
    if (!fix) continue;
    const fixes = fixesByFile.get(slide.filepath) ?? new Map<string, Fix | undefined>();
    const key = `${fix.line}:${fix.column}`;
    // A slide imported twice yields the same fix twice; it must be applied once. When the copies
    // disagree (their surroundings differ), neither can be right for both, so the spot is left alone.
    if (!fixes.has(key)) fixes.set(key, fix);
    else if (JSON.stringify(fixes.get(key)) !== JSON.stringify(fix)) fixes.set(key, undefined);
    fixesByFile.set(slide.filepath, fixes);
  }
  let applied = 0;
  // Every file is rewritten in memory first so that an unreadable file leaves nothing half-fixed.
  const rewritten = new Map<string, string>();
  for (const [filepath, fixes] of fixesByFile) {
    const lines = fs.readFileSync(filepath, 'utf8').split('\n');
    // Fixes on one line are applied from right to left so that earlier offsets stay valid,
    // and each is checked against the original text.
    let end = Number.POSITIVE_INFINITY;
    let endLine = 0;
    const candidates = [...fixes.values()].filter((fix) => fix !== undefined);
    for (const fix of candidates.toSorted((a, b) => b.line - a.line || b.column - a.column)) {
      const line = lines[fix.line - 1];
      if (fix.line !== endLine) end = Number.POSITIVE_INFINITY;
      if (line === undefined || !line.startsWith(fix.from, fix.column) || fix.column + fix.from.length > end) continue;
      lines[fix.line - 1] = line.slice(0, fix.column) + fix.to + line.slice(fix.column + fix.from.length);
      end = fix.column;
      endLine = fix.line;
      applied++;
    }
    rewritten.set(filepath, lines.join('\n'));
  }
  const written: string[] = [];
  try {
    for (const [filepath, content] of rewritten) {
      fs.writeFileSync(filepath, content);
      written.push(filepath);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`${message} (${written.length} of ${rewritten.size} files were already rewritten)`, {
      cause: error,
    });
  }
  return applied;
}
