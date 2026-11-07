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

/** A rule setting: a severity, optionally with rule-specific options (like ESLint/oxlint). */
export type RuleSetting = Severity | readonly [Severity, Record<string, unknown>];

export interface Violation extends Finding {
  ruleId: string;
  severity: Exclude<Severity, 'off'>;
}

/** A visible slide of the deck as seen by rules. */
export interface DeckSlide {
  slide: SlideLocation;
  /** Markdown source of the slide; its first line is `slide.line` of the file. */
  source: string;
  /** CSS selector of the `.print-slide-container` for the slide. */
  containerSelector: string;
}

/** What `Rule.check` receives. */
export interface CheckContext {
  /**
   * The print page of the deck, with every slide rendered one below another. Functions passed to
   * `page.evaluate` can use `globalThis.slidevCheck` (`BrowserHelpers`).
   */
  page: Page;
  /** Slide canvas size in CSS pixels. */
  width: number;
  height: number;
  /** Rule-specific options from the rule setting, if any. */
  options: Record<string, unknown> | undefined;
  /** Every visible slide, in deck order. */
  slides: readonly DeckSlide[];
}

/** One problem found by a rule. */
export interface Finding {
  slide: SlideLocation;
  /** What is wrong. Includes a short description of the offending element. */
  message: string;
  /** How to fix it, phrased as a suggestion (`Consider ...`). */
  help: string;
  /** Present when the finding can be resolved automatically (`--fix`). */
  fix?: Fix;
}

export interface Rule {
  /** Unique among the built-in rules, the theme's rules, and `CheckOptions.rules`. */
  id: string;
  description: string;
  /** Severity and options used unless `CheckOptions.settings` overrides them. */
  defaultSetting: RuleSetting;
  /** Checks the whole deck. Use `perSlide` for a rule that looks at one slide at a time. */
  check: (context: CheckContext) => Promise<Finding[]>;
}
