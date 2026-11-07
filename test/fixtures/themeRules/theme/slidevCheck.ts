import type { AnyRule, DeckRule, Rule } from '../../../../src/index.ts';

// A rule may carry properties of its own.
const noMarker: Rule & { documentationUrl: string } = {
  id: 'fixture-no-marker',
  documentationUrl: 'https://example.com/no-marker',
  description: 'Slides must not contain the marker word.',
  defaultSetting: ['warn', { word: 'TODO' }],
  check: async ({ page, containerSelector, options }) => {
    const word = String(options?.['word']);
    const text = await page
      .locator(`${containerSelector} .slidev-layout`)
      .evaluate((layout) => {
        const copy = layout.cloneNode(true) as Element;
        for (const ignored of copy.querySelectorAll('[data-slidev-check-ignore]')) ignored.remove();
        return copy.textContent ?? '';
      });
    return text.includes(word) ? [{ message: `The slide contains \`${word}\`.`, help: 'Consider resolving it.' }] : [];
  },
};

const uniqueTitles: DeckRule = {
  id: 'fixture-unique-titles',
  description: 'Slide headings must differ from those of earlier slides.',
  defaultSetting: 'error',
  checkDeck: async ({ page, slides }) => {
    const headings = await Promise.all(
      slides.map(({ containerSelector }) => page.locator(`${containerSelector} .slidev-layout h1`).innerText())
    );
    return slides
      .filter((_, index) => headings.indexOf(headings[index] ?? '') < index)
      .map(({ slide }) => ({ slide, message: `The heading \`${slide.title}\` repeats.`, help: 'Consider renaming it.' }));
  },
};

export default [noMarker, uniqueTitles] satisfies AnyRule[];
