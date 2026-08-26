// wbfy:start oxlint-base
import type { OxlintConfig } from 'oxlint';

import oxlintBaseConfig from '@willbooster/oxlint-config';

const oxlintResolvedConfig: OxlintConfig = structuredClone(oxlintBaseConfig);
oxlintResolvedConfig.options = { ...oxlintResolvedConfig.options, typeAware: true, typeCheck: true };
// wbfy:end oxlint-base

// Rule files are named after the rule ids they implement (e.g. `no-overflow.ts`),
// which are kebab-case by convention and conflict with `unicorn/filename-case`.
oxlintResolvedConfig.overrides = [
  ...(oxlintResolvedConfig.overrides ?? []),
  {
    files: ['src/rules/**/*.ts'],
    rules: {
      'unicorn/filename-case': 'off',
    },
  },
];

// `*.tmp.ts` files are throwaway local repro scripts, not part of the project.
oxlintResolvedConfig.ignorePatterns = [...(oxlintResolvedConfig.ignorePatterns ?? []), '**/*.tmp.ts'];

// wbfy:start oxlint-export
export default oxlintResolvedConfig;
// wbfy:end oxlint-export
