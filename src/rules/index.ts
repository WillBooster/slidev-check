import type { Rule } from '../types.ts';
import { maxBodyCharacters, maxListDepth, maxTableRows } from './contentLimits.ts';
import { minFontScale, minHeadingScale } from './fontScale.ts';
import { maxHeadingLines } from './max-heading-lines.ts';
import { minFontSize } from './min-font-size.ts';
import { minListItems } from './minListItems.ts';
import { noOverflow } from './no-overflow.ts';
import { noOverlap } from './no-overlap.ts';
import { optimalZoom } from './optimal-zoom.ts';

/** The built-in rules, in the order their violations on one slide are reported. */
export const allRules = [
  noOverflow,
  noOverlap,
  maxHeadingLines,
  minHeadingScale,
  minFontSize,
  minFontScale,
  optimalZoom,
  maxBodyCharacters,
  maxListDepth,
  maxTableRows,
  minListItems,
] as const satisfies readonly Rule[];

export type RuleId = (typeof allRules)[number]['id'];

/**
 * Default setting of every built-in rule.
 *
 * - `error`: reported and makes the check fail (exit code 1).
 * - `warn`: reported but does not make the check fail.
 * - `off`: the rule is not run.
 */
export const defaultRules = Object.fromEntries(allRules.map((rule) => [rule.id, rule.defaultSetting])) as {
  readonly [R in (typeof allRules)[number] as R['id']]: R['defaultSetting'];
};
