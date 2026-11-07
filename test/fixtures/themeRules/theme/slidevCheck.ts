import { perSlide, type Rule, type SlideFinding } from '../../../../src/index.ts';

// A rule may carry properties of its own.
const noMarker: Rule & { documentationUrl: string } = {
  id: 'fixture-no-marker',
  documentationUrl: 'https://example.com/no-marker',
  description: 'Slides must not contain the marker word.',
  defaultSetting: ['warn', { word: 'TODO' }],
  check: perSlide(({ page, containerSelector, options }) =>
    page.evaluate(findMarker, { containerSelector, word: String(options?.['word']) })
  ),
};

function findMarker({ containerSelector, word }: { containerSelector: string; word: string }): SlideFinding[] {
  const layout = document.querySelector(`${containerSelector} .slidev-layout`);
  return layout && globalThis.slidevCheck.checkedText(layout).includes(word)
    ? [{ message: `The slide contains \`${word}\`.`, help: 'Consider resolving it.' }]
    : [];
}

const uniqueTitles: Rule = {
  id: 'fixture-unique-titles',
  description: 'Slide headings must differ from those of earlier slides.',
  defaultSetting: 'error',
  check: async ({ page, slides }) => {
    const headings = await page.evaluate(
      (selectors) =>
        selectors.map((selector) => {
          const { checkedText, isChecked } = globalThis.slidevCheck;
          const heading = document.querySelector(`${selector} .slidev-layout h1`);
          return heading && isChecked(heading) ? checkedText(heading) : '';
        }),
      slides.map(({ containerSelector }) => containerSelector)
    );
    return slides
      .filter((_, index) => headings[index] && headings.indexOf(headings[index]) < index)
      .map(({ slide }) => ({ slide, message: `The heading \`${slide.title}\` repeats.`, help: 'Consider renaming it.' }));
  },
};

export default [noMarker, uniqueTitles] satisfies Rule[];
