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

export interface RuleContext {
  page: Page;
  slide: SlideLocation;
  /** Markdown source of the slide; its first line is `slide.line` of the file. */
  source: string;
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
  fix?: Fix;
}

export interface Rule {
  id: string;
  description: string;
  check: (context: RuleContext) => Promise<RuleFinding[]>;
}
