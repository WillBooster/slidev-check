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
  if (!layout) return [];
  const walker = document.createTreeWalker(layout, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const parent = node.parentElement;
    if (parent && globalThis.slidevCheck.isChecked(parent) && node.textContent?.includes(word))
      return [{ message: `The slide contains \`${word}\`.`, help: 'Consider resolving it.' }];
  }
  return [];
}

const uniqueTitles: Rule = {
  id: 'fixture-unique-titles',
  description: 'Slide headings must differ from those of earlier slides.',
  defaultSetting: 'error',
  check: async ({ page, slides }) => {
    const headings = await Promise.all(
      slides.map(({ containerSelector }) => page.locator(`${containerSelector} .slidev-layout h1`).innerText())
    );
    return slides
      .filter((_, index) => headings.indexOf(headings[index] ?? '') < index)
      .map(({ slide }) => ({ slide, message: `The heading \`${slide.title}\` repeats.`, help: 'Consider renaming it.' }));
  },
};

export default [noMarker, uniqueTitles] satisfies Rule[];
