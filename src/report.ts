import pc from 'picocolors';
import type { Violation } from './types.ts';

export interface ReportStats {
  durationMs: number;
  ruleCount: number;
}

const count = (n: number, noun: string): string => `${n} ${noun}${n === 1 ? '' : 's'}`;

/** Emphasizes the variable parts of a message: backquoted element descriptions, numeric values, and overflow sides. */
const emphasize = (message: string): string =>
  message.replaceAll(/`[^`]*`|\d+(?:×\d+)?(?:px)?|\b(?:top|right|bottom|left)\b/g, (match) => pc.blue(match));

/**
 * Formats violations in an oxlint-like single-line format, e.g.
 * `2: error no-overflow: Element `<p>...` overflows the slide by 8px at the bottom. help: Consider splitting the content into multiple slides.`
 */
export function formatViolations(violations: Violation[], stats: ReportStats): string {
  if (violations.length === 0) return '';
  const lines = violations.map((v) => {
    const severity = v.severity === 'warn' ? pc.yellow('warning') : pc.red('error');
    return `${v.slide.no}: ${severity} ${v.ruleId}: ${emphasize(v.message)} help: ${v.help}`;
  });
  const warnings = violations.filter((v) => v.severity === 'warn').length;
  const errors = violations.length - warnings;
  const summary = `Found ${count(warnings, 'warning')} and ${count(errors, 'error')}.`;
  lines.push(
    '',
    errors > 0 ? pc.red(summary) : warnings > 0 ? pc.yellow(summary) : summary,
    `Finished in ${Math.round(stats.durationMs)}ms with ${count(stats.ruleCount, 'rule')}.`
  );
  return lines.join('\n');
}
