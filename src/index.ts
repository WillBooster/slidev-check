export { check, type CheckOptions } from './check.ts';
export { applyFixes } from './fix.ts';
export { formatViolations } from './report.ts';
export { allRules, defaultRules, type RuleId } from './rules/index.ts';
export type {
  AnyRule,
  DeckRule,
  DeckRuleContext,
  DeckRuleFinding,
  DeckSlide,
  Fix,
  Rule,
  RuleContext,
  RuleFinding,
  RuleSetting,
  Severity,
  SlideLocation,
  Violation,
} from './types.ts';
