import { debug } from './debug.ts';
import { renderDeck, type RenderedDeck, type RenderOptions } from './renderer.ts';
import { allRules } from './rules/index.ts';
import type { DeckRuleFinding, DeckSlide, Rule, RuleContext, RuleSetting, Severity, Violation } from './types.ts';

export interface CheckOptions extends RenderOptions {
  /** Rules to run instead of the built-in ones. The rules of the deck's theme are always added. */
  rules?: readonly Rule[];
  /** Overrides of the rules' default severities by rule id, including the theme's rules. */
  severities?: Partial<Record<string, Severity>>;
}

export interface CheckResult {
  violations: Violation[];
  /** The rules that were run (those not turned off). */
  rules: readonly Rule[];
}

interface EnabledRule {
  rule: Rule;
  severity: Exclude<Severity, 'off'>;
}

/** Renders the deck and returns the violations of the rules, sorted by slide and then by rule order. */
export async function check(options: CheckOptions): Promise<Violation[]> {
  const { violations } = await checkWithRules(options);
  return violations;
}

export async function checkWithRules(options: CheckOptions): Promise<CheckResult> {
  const deck = await renderDeck(options);
  try {
    const rules = [...(options.rules ?? allRules), ...deck.themeRules];
    assertUniqueIds(rules);
    const enabled = rules
      .map((rule) => ({ rule, severity: options.severities?.[rule.id] ?? severityOf(rule) }))
      .filter((entry): entry is EnabledRule => entry.severity !== 'off');
    const collected = await collectViolations(deck, enabled);
    const violations = collected
      .toSorted((a, b) => a.violation.slide.no - b.violation.slide.no || a.ruleIndex - b.ruleIndex)
      .map(({ violation }) => violation);
    return { violations, rules: enabled.map(({ rule }) => rule) };
  } finally {
    await deck.close();
  }
}

function assertUniqueIds(rules: readonly Rule[]): void {
  const seen = new Set<string>();
  for (const { id } of rules) {
    if (seen.has(id)) throw new Error(`More than one rule has the id "${id}".`);
    seen.add(id);
  }
}

const builtInSettings: ReadonlyMap<string, RuleSetting> = new Map(
  allRules.map((rule) => [rule.id, rule.defaultSetting])
);

function settingOf(rule: Rule): RuleSetting {
  return rule.defaultSetting ?? builtInSettings.get(rule.id) ?? 'error';
}

function severityOf(rule: Rule): Severity {
  const setting = settingOf(rule);
  return typeof setting === 'string' ? setting : setting[0];
}

/** Runs slide rules slide by slide, then deck rules, one rule at a time because rules may change the DOM. */
async function collectViolations(
  deck: RenderedDeck,
  rules: readonly EnabledRule[]
): Promise<{ ruleIndex: number; violation: Violation }[]> {
  const slides = await visibleSlides(deck);
  const results: { ruleIndex: number; violation: Violation }[] = [];
  const add = (ruleIndex: number, { rule, severity }: EnabledRule, findings: DeckRuleFinding[]): void => {
    for (const { slide, ...finding } of findings)
      results.push({ ruleIndex, violation: { ruleId: rule.id, severity, slide, ...finding } });
  };
  for (const target of slides) {
    for (const [ruleIndex, entry] of rules.entries()) {
      if (!entry.rule.check) continue;
      debug(`slide ${target.slide.no} rule ${entry.rule.id}`);
      const findings = await entry.rule.check({ ...contextBase(deck, entry.rule), ...target });
      add(
        ruleIndex,
        entry,
        findings.map((finding) => ({ ...finding, slide: target.slide }))
      );
    }
  }
  for (const [ruleIndex, entry] of rules.entries()) {
    if (!entry.rule.checkDeck) continue;
    debug(`deck rule ${entry.rule.id}`);
    add(ruleIndex, entry, await entry.rule.checkDeck({ ...contextBase(deck, entry.rule), slides }));
  }
  return results;
}

async function visibleSlides(deck: RenderedDeck): Promise<DeckSlide[]> {
  const slides = await Promise.all(
    deck.slides.map(async ({ source, ...slide }) => {
      const containerSelector = `.print-slide-container[id^="${String(slide.no).padStart(3, '0')}-"]`;
      // Slidev renders no container for a hidden slide.
      const visible = (await deck.page.locator(containerSelector).count()) > 0;
      return visible ? { slide, source, containerSelector } : undefined;
    })
  );
  return slides.filter((slide) => slide !== undefined);
}

function contextBase(deck: RenderedDeck, rule: Rule): Omit<RuleContext, keyof DeckSlide> {
  const setting = settingOf(rule);
  return {
    page: deck.page,
    width: deck.width,
    height: deck.height,
    options: typeof setting === 'string' ? undefined : setting[1],
  };
}
