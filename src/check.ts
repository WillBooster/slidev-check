import { defaultRules, type RuleSetting } from './config.ts';
import { renderDeck, type RenderOptions } from './renderer.ts';
import { allRules } from './rules/index.ts';
import type { Rule, Severity, Violation } from './types.ts';

export interface CheckOptions extends RenderOptions {
  rules?: readonly Rule[];
  /** Overrides of the default rule severities. */
  severities?: Partial<Record<string, Severity>>;
}

const settingOf = (rule: Rule): RuleSetting | undefined => defaultRules[rule.id as keyof typeof defaultRules];

export async function check(options: CheckOptions): Promise<Violation[]> {
  const severityOf = (rule: Rule): Severity => {
    const setting = settingOf(rule);
    return options.severities?.[rule.id] ?? (typeof setting === 'string' ? setting : (setting?.[0] ?? 'error'));
  };
  const optionsOf = (rule: Rule): Record<string, unknown> | undefined => {
    const setting = settingOf(rule);
    return typeof setting === 'string' ? undefined : setting?.[1];
  };
  const rules = (options.rules ?? allRules).filter((rule) => severityOf(rule) !== 'off');
  const deck = await renderDeck(options);
  try {
    const violations: Violation[] = [];
    for (const { source, ...slide } of deck.slides) {
      const containerSelector = `.print-slide-container[id^="${String(slide.no).padStart(3, '0')}-"]`;
      if ((await deck.page.locator(containerSelector).count()) === 0) continue; // hidden slide
      for (const rule of rules) {
        if (process.env['SLIDEV_CHECK_DEBUG']) console.error(`[check-debug] slide ${slide.no} rule ${rule.id}`);
        const findings = await rule.check({
          page: deck.page,
          slide,
          source,
          containerSelector,
          width: deck.width,
          height: deck.height,
          options: optionsOf(rule),
        });
        violations.push(
          ...findings.map((finding) => ({
            ruleId: rule.id,
            severity: severityOf(rule) as Exclude<Severity, 'off'>,
            slide,
            ...finding,
          }))
        );
      }
    }
    return violations;
  } finally {
    await deck.close();
  }
}
