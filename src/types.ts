import type { Page } from 'playwright-chromium';

export interface SlideLocation {
  /** 1-based slide number as shown by Slidev. */
  no: number;
  /** Path of the markdown file the slide comes from. */
  filepath: string;
  /** 1-based line number where the slide starts. */
  line: number;
  title: string | undefined;
}

/** How a rule is applied: reported as an error, reported as a warning, or not run at all. */
export type Severity = 'error' | 'warn' | 'off';

/** A text replacement on one line of the slide's markdown file that resolves a finding. */
export interface Fix {
  /** 1-based line number in the file. */
  line: number;
  /** 0-based character offset of `from` within the line. */
  column: number;
  /** Text at that position to replace. */
  from: string;
  to: string;
}

export interface Violation {
  ruleId: string;
  severity: Exclude<Severity, 'off'>;
  slide: SlideLocation;
  /** What is wrong. Includes a short description of the offending element. */
  message: string;
  /** How to fix it, phrased as a suggestion (`Consider ...`). */
  help: string;
  /** Present when the violation can be resolved automatically (`--fix`). */
  fix?: Fix;
}

/** A rule setting: a severity, optionally with rule-specific options (like ESLint/oxlint). */
export type RuleSetting = Severity | readonly [Severity, Record<string, unknown>];

/** A visible slide of the deck as seen by rules. */
export interface DeckSlide {
  slide: SlideLocation;
  /** Markdown source of the slide; its first line is `slide.line` of the file. */
  source: string;
  /** CSS selector of the `.print-slide-container` for the slide. */
  containerSelector: string;
}

interface BaseRuleContext {
  /** The print page of the deck, with every slide rendered one below another. */
  page: Page;
  /** Slide canvas size in CSS pixels. */
  width: number;
  height: number;
  /** Rule-specific options from the rule setting, if any. */
  options: Record<string, unknown> | undefined;
}

/** What `Rule.check` receives: one visible slide. */
export interface RuleContext extends BaseRuleContext, DeckSlide {}

/** What `DeckRule.checkDeck` receives: every visible slide, in deck order. */
export interface DeckRuleContext extends BaseRuleContext {
  slides: readonly DeckSlide[];
}

/** Result returned by a rule for one offending element (without slide/rule metadata). */
export interface RuleFinding {
  message: string;
  help: string;
  fix?: Fix;
}

/** Result returned by a deck rule, naming the slide it belongs to. */
export interface DeckRuleFinding extends RuleFinding {
  slide: SlideLocation;
}

interface BaseRule {
  /** Unique among the built-in rules and the theme's rules. */
  id: string;
  description: string;
  /**
   * Severity (and options) used unless `CheckOptions.severities` overrides the severity. When omitted,
   * the setting of the built-in rule with the same id applies, else `'error'` without options.
   */
  defaultSetting?: RuleSetting;
}

/** A rule that checks one slide at a time. */
export interface Rule extends BaseRule {
  check: (context: RuleContext) => Promise<RuleFinding[]>;
  checkDeck?: never;
}

/**
 * A rule that checks the whole deck at once, e.g. to compare slides with each other or to run
 * slow per-slide work (such as network requests) concurrently.
 */
export interface DeckRule extends BaseRule {
  checkDeck: (context: DeckRuleContext) => Promise<DeckRuleFinding[]>;
  check?: never;
}

/** Either kind of rule, as accepted by `CheckOptions.rules` and exported by a theme. */
export type AnyRule = Rule | DeckRule;
