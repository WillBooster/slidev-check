import type { CheckContext, DeckSlide, Finding, Rule } from './types.ts';

/** What the function given to `perSlide` receives: the check context narrowed to one slide. */
export interface SlideContext extends Omit<CheckContext, 'slides'>, DeckSlide {}

/** A finding of `perSlide`'s function, which `perSlide` attributes to the slide being checked. */
export type SlideFinding = Omit<Finding, 'slide'>;

/**
 * Builds `Rule.check` from a function that checks one slide. Slides are checked one after another,
 * because the function may change the shared page between its awaits.
 */
export function perSlide(checkSlide: (context: SlideContext) => Promise<SlideFinding[]>): Rule['check'] {
  return async ({ slides, ...context }) => {
    const findings: Finding[] = [];
    for (const target of slides) {
      for (const finding of await checkSlide({ ...context, ...target }))
        findings.push({ slide: target.slide, ...finding });
    }
    return findings;
  };
}
