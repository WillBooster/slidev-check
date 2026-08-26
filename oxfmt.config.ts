// wbfy:start oxfmt-base
import type { OxfmtConfig } from 'oxfmt';

import config from '@willbooster/oxfmt-config';

const oxfmtResolvedConfig: OxfmtConfig = config;
// wbfy:end oxfmt-base

// Slidev decks are Markdown files with per-slide frontmatter separated by `---` and embedded Vue/HTML.
// A generic Markdown formatter can rewrite those separators and blocks and break the deck,
// so never format Slidev decks used as test fixtures.
oxfmtResolvedConfig.ignorePatterns = [...(oxfmtResolvedConfig.ignorePatterns ?? []), 'test/fixtures/**/*.md'];

// `*.tmp.ts` files are throwaway local repro scripts, not part of the project.
oxfmtResolvedConfig.ignorePatterns = [...(oxfmtResolvedConfig.ignorePatterns ?? []), '**/*.tmp.ts'];

// wbfy:start oxfmt-export
export default oxfmtResolvedConfig;
// wbfy:end oxfmt-export
