import path from 'node:path';
import type { Violation } from './types.ts';

export function formatViolations(violations: Violation[], cwd = process.cwd()): string {
  if (violations.length === 0) return '';
  const lines: string[] = [];
  for (const violation of violations) {
    const file = path.relative(cwd, violation.slide.filepath) || violation.slide.filepath;
    const title = violation.slide.title ? ` "${violation.slide.title}"` : '';
    lines.push(
      `${file}:${violation.slide.line}  error  ${violation.message}  ${violation.ruleId}`,
      `  slide ${violation.slide.no}${title}: ${violation.element}`,
      `  hint: ${violation.hint}`,
      '',
    );
  }
  const noun = violations.length === 1 ? 'problem' : 'problems';
  lines.push(`✖ ${violations.length} ${noun}`);
  return lines.join('\n');
}
