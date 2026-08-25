import type { Rule } from '../types.ts';
import { noOverflow } from './no-overflow.ts';
import { noOverlap } from './no-overlap.ts';

export const rules: readonly Rule[] = [noOverflow, noOverlap];
