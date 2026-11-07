export type { BrowserHelpers } from './browser.ts';
export { check, type CheckOptions } from './check.ts';
export { applyFixes } from './fix.ts';
export { perSlide, type SlideContext, type SlideFinding } from './perSlide.ts';
export { formatViolations } from './report.ts';
export { allRules } from './rules/index.ts';
export type {
  CheckContext,
  DeckSlide,
  Finding,
  Fix,
  Rule,
  RuleSetting,
  Severity,
  SlideLocation,
  Violation,
} from './types.ts';
