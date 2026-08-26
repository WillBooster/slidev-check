import type { Violation } from './types.ts';

export interface ReportStats {
  durationMs: number;
  ruleCount: number;
}

const count = (n: number, noun: string): string => `${n} ${noun}${n === 1 ? '' : 's'}`;

/**
 * Formats violations in an oxlint-like single-line format, e.g.
 * `2: error no-overflow: Element `<p>...` overflows the slide by 8px at the bottom. help: Consider splitting the content into multiple slides.`
 */
export function formatViolations(violations: Violation[], stats: ReportStats): string {
  if (violations.length === 0) return '';
  const lines = violations.map(
    (v) => `${v.slide.no}: ${v.severity === 'warn' ? 'warning' : 'error'} ${v.ruleId}: ${v.message} help: ${v.help}`,
  );
  const warnings = violations.filter((v) => v.severity === 'warn').length;
  lines.push(
    '',
    `Found ${count(warnings, 'warning')} and ${count(violations.length - warnings, 'error')}.`,
    `Finished in ${Math.round(stats.durationMs)}ms with ${count(stats.ruleCount, 'rule')}.`,
  );
  return lines.join('\n');
}
