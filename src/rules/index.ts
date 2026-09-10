import type { Rule } from '../types.ts';
import { maxBodyCharacters, maxListDepth, maxTableRows } from './contentLimits.ts';
import { maxHeadingLines } from './max-heading-lines.ts';
import { minFontSize } from './min-font-size.ts';
import { noOverflow } from './no-overflow.ts';
import { noOverlap } from './no-overlap.ts';
import { optimalZoom } from './optimal-zoom.ts';

export const allRules: readonly Rule[] = [
  noOverflow,
  noOverlap,
  maxHeadingLines,
  minFontSize,
  optimalZoom,
  maxBodyCharacters,
  maxListDepth,
  maxTableRows,
];
