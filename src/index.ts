export { audit, type AuditOptions } from './audit.ts';
export { defaultRules, type RuleId, type RuleSetting } from './config.ts';
export { formatViolations } from './report.ts';
export { allRules } from './rules/index.ts';
export type { Rule, RuleContext, RuleFinding, Severity, SlideLocation, Violation } from './types.ts';
