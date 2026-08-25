import { renderDeck, type RenderOptions } from './renderer.ts';
import { rules as allRules } from './rules/index.ts';
import type { Rule, Violation } from './types.ts';

export interface AuditOptions extends RenderOptions {
  rules?: readonly Rule[];
}

export async function audit(options: AuditOptions): Promise<Violation[]> {
  const rules = options.rules ?? allRules;
  const deck = await renderDeck(options);
  try {
    const violations: Violation[] = [];
    for (const slide of deck.slides) {
      const containerSelector = `.print-slide-container[id^="${String(slide.no).padStart(3, '0')}-"]`;
      if ((await deck.page.locator(containerSelector).count()) === 0) continue; // hidden slide
      for (const rule of rules) {
        const findings = await rule.check({
          page: deck.page,
          slide,
          containerSelector,
          width: deck.width,
          height: deck.height,
        });
        violations.push(...findings.map((finding) => ({ ruleId: rule.id, slide, ...finding })));
      }
    }
    return violations;
  } finally {
    await deck.close();
  }
}
