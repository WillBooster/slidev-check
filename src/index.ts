export { check, type CheckOptions } from './check.ts';
export { defaultRules, type RuleId, type RuleSetting } from './config.ts';
export { applyFixes } from './fix.ts';
export { formatViolations } from './report.ts';
export { allRules } from './rules/index.ts';
export type { Fix, Rule, RuleContext, RuleFinding, Severity, SlideLocation, Violation } from './types.ts';
