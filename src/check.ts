import { debug } from './debug.ts';
import { renderDeck, type RenderedDeck, type RenderOptions, type ResolvedDeck, resolveDeck } from './renderer.ts';
import { allRules } from './rules/index.ts';
import type { DeckSlide, Rule, RuleSetting, Severity, Violation } from './types.ts';

export interface CheckOptions extends RenderOptions {
  /** Rules run in addition to the built-in rules and the rules of the deck's theme. */
  rules?: readonly Rule[];
  /**
   * Overrides of the rules' default settings by rule id. A bare severity keeps the rule's default
   * options; a `[severity, options]` pair merges the options over them. A setting here replaces the
   * deck headmatter's `slidevCheck` setting of the same rule.
   */
  settings?: Partial<Record<string, RuleSetting>>;
}

export interface CheckResult {
  violations: Violation[];
  /** The rules that were run (those not turned off). */
  rules: readonly Rule[];
}

interface EnabledRule {
  rule: Rule;
  severity: Exclude<Severity, 'off'>;
  options: Record<string, unknown> | undefined;
}

/**
 * Renders the deck and returns the violations of the built-in rules, the theme's rules, and
 * `options.rules`, sorted by slide and then by rule order.
 */
export async function check(options: CheckOptions): Promise<Violation[]> {
  const { violations } = await checkWithRules(options);
  return violations;
}

export async function checkWithRules(options: CheckOptions): Promise<CheckResult> {
  const deck = await resolveDeck(options);
  const rules = [...allRules, ...deck.themeRules, ...(options.rules ?? [])];
  const enabled = enabledRules(rules, { ...deck.settings, ...options.settings });
  validateIgnores(deck, rules);
  const rendered = await renderDeck(deck, options);
  try {
    const violations = await collectViolations(deck, rendered, enabled);
    return { violations, rules: enabled.map(({ rule }) => rule) };
  } finally {
    await rendered.close();
  }
}

function enabledRules(rules: readonly Rule[], settings: Partial<Record<string, RuleSetting>>): EnabledRule[] {
  const ids = new Set<string>();
  for (const { id } of rules) {
    if (ids.has(id)) throw new Error(`More than one rule has the id "${id}".`);
    ids.add(id);
  }
  for (const id of Object.keys(settings)) if (!ids.has(id)) throw new Error(`No rule has the id "${id}" of a setting.`);

  const overrides = new Map(Object.entries(settings));
  return rules
    .map((rule) => ({ rule, ...resolveSetting(rule.defaultSetting, overrides.get(rule.id)) }))
    .filter((entry): entry is EnabledRule => entry.severity !== 'off');
}

function resolveSetting(
  defaultSetting: RuleSetting,
  override: RuleSetting | undefined
): { severity: Severity; options: Record<string, unknown> | undefined } {
  const [defaultSeverity, defaultOptions] = typeof defaultSetting === 'string' ? [defaultSetting] : defaultSetting;
  if (override === undefined) return { severity: defaultSeverity, options: defaultOptions };
  if (typeof override === 'string') return { severity: override, options: defaultOptions };
  return { severity: override[0], options: { ...defaultOptions, ...override[1] } };
}

function validateIgnores(deck: ResolvedDeck, rules: readonly Rule[]): void {
  const rulesById = new Map(rules.map((rule) => [rule.id, rule]));
  for (const { no, ignores } of deck.slides) {
    for (const id of Object.keys(ignores)) {
      const rule = rulesById.get(id);
      if (!rule) throw new Error(`No rule has the id "${id}" that slide ${no} ignores.`);
      if (!rule.suppressible)
        throw new Error(`Slide ${no} cannot ignore "${id}", which is not suppressible; fix the slide or the rule.`);
    }
  }
}

/** Runs the rules one at a time, because a rule may change the shared page while it runs. */
async function collectViolations(
  deck: ResolvedDeck,
  rendered: RenderedDeck,
  rules: readonly EnabledRule[]
): Promise<Violation[]> {
  const slides = await visibleSlides(deck, rendered);
  const ignoresByNo = new Map(deck.slides.map(({ no, ignores }) => [no, ignores]));
  const usedIgnores = new Set<string>();
  const results: { ruleIndex: number; violation: Violation }[] = [];
  for (const [ruleIndex, { rule, severity, options }] of rules.entries()) {
    debug(`rule ${rule.id}`);
    const findings = await rule.check({ page: rendered.page, width: deck.width, height: deck.height, options, slides });
    for (const { slide, ...finding } of findings) {
      if (ignoresByNo.get(slide.no)?.[rule.id] === undefined)
        results.push({ ruleIndex, violation: { ruleId: rule.id, severity, slide, ...finding } });
      else usedIgnores.add(`${slide.no} ${rule.id}`);
    }
  }
  for (const violation of unusedIgnores(slides, ignoresByNo, usedIgnores))
    results.push({ ruleIndex: rules.length, violation });
  return results
    .toSorted((a, b) => a.violation.slide.no - b.violation.slide.no || a.ruleIndex - b.ruleIndex)
    .map(({ violation }) => violation);
}

function unusedIgnores(
  slides: readonly DeckSlide[],
  ignoresByNo: ReadonlyMap<number, Record<string, string>>,
  usedIgnores: ReadonlySet<string>
): Violation[] {
  return slides.flatMap(({ slide }) =>
    Object.keys(ignoresByNo.get(slide.no) ?? {})
      .filter((id) => !usedIgnores.has(`${slide.no} ${id}`))
      .map((id) => ({
        ruleId: 'unused-ignore',
        severity: 'error' as const,
        slide,
        message: `\`slidevCheckIgnore\` of \`${id}\` ignores no finding.`,
        help: 'Consider removing it.',
      }))
  );
}

async function visibleSlides(deck: ResolvedDeck, rendered: RenderedDeck): Promise<DeckSlide[]> {
  const slides = await Promise.all(
    deck.slides.map(async ({ no, filepath, line, title, source }) => {
      const slide = { no, filepath, line, title };
      const containerSelector = `.print-slide-container[id^="${String(slide.no).padStart(3, '0')}-"]`;
      const visible = (await rendered.page.locator(containerSelector).count()) > 0;
      return visible ? { slide, source, containerSelector } : undefined;
    })
  );
  return slides.filter((slide) => slide !== undefined);
}
