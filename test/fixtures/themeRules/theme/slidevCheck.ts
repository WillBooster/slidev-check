import type { DeckRule, Rule, SlideRule } from '../../../../src/index.ts';

const noMarker: SlideRule = {
  id: 'fixture-no-marker',
  description: 'Slides must not contain the marker word.',
  defaultSetting: ['warn', { word: 'TODO' }],
  check: async ({ page, containerSelector, options }) => {
    const word = String(options?.['word']);
    const text = await page.locator(`${containerSelector} .slidev-layout`).innerText();
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

export default [noMarker, uniqueTitles] satisfies Rule[];
