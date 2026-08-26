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

export interface Violation {
  ruleId: string;
  severity: Exclude<Severity, 'off'>;
  slide: SlideLocation;
  /** What is wrong. Includes a short description of the offending element. */
  message: string;
  /** How to fix it, phrased as a suggestion (`Consider ...`). */
  help: string;
}

export interface RuleContext {
  page: Page;
  slide: SlideLocation;
  /** CSS selector of the `.print-slide-container` for the slide. */
  containerSelector: string;
  /** Slide canvas size in CSS pixels. */
  width: number;
  height: number;
  /** Rule-specific options from the configuration, if any. */
  options: Record<string, unknown> | undefined;
}

/** Result returned by a rule for one offending element (without slide/rule metadata). */
export interface RuleFinding {
  message: string;
  help: string;
}

export interface Rule {
  id: string;
  description: string;
  check: (context: RuleContext) => Promise<RuleFinding[]>;
}
