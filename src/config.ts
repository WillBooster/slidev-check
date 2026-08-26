import type { Severity } from './types.ts';

/** A rule setting: a severity, optionally with rule-specific options (like ESLint/oxlint). */
export type RuleSetting = Severity | readonly [Severity, Record<string, unknown>];

/**
 * Default setting of every rule.
 *
 * - `error`: reported and makes the audit fail (exit code 1).
 * - `warn`: reported but does not make the audit fail.
 * - `off`: the rule is not run.
 */
export const defaultRules = {
  'no-overflow': 'error',
  'no-overlap': 'error',
  'max-heading-lines': ['warn', { max: 1 }],
  'min-font-size': ['warn', { min: 14 }],
} as const satisfies Record<string, RuleSetting>;

export type RuleId = keyof typeof defaultRules;
