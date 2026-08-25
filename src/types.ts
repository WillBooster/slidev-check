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

export interface Violation {
  ruleId: string;
  slide: SlideLocation;
  /** What is wrong. */
  message: string;
  /** Why it is probably happening and how to fix it. */
  hint: string;
  /** Short description of the offending element, e.g. `img.logo`. */
  element: string;
}

export interface RuleContext {
  page: Page;
  slide: SlideLocation;
  /** CSS selector of the `.print-slide-container` for the slide. */
  containerSelector: string;
  /** Slide canvas size in CSS pixels. */
  width: number;
  height: number;
}

/** Result returned by a rule for one offending element (without slide/rule metadata). */
export interface RuleFinding {
  element: string;
  message: string;
  hint: string;
}

export interface Rule {
  id: string;
  description: string;
  check: (context: RuleContext) => Promise<RuleFinding[]>;
}
