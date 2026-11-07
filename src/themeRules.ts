import path from 'node:path';

import { z } from 'zod';

import type { Rule } from './types.ts';

/** The subpath a theme package exports its rules from. */
const THEME_RULES_SUBPATH = './slidev-check';

const manifestSchema = z.object({
  name: z.string().optional(),
  // `exports` may also be a string or an array, which cannot contain the subpath.
  // oxlint-disable-next-line unicorn/prefer-top-level-await -- `catch` of a zod schema, not of a promise.
  exports: z.record(z.string(), z.unknown()).optional().catch(undefined),
});

const severitySchema = z.enum(['error', 'warn', 'off']);
const themeRulesSchema = z.array(
  z.looseObject({
    id: z.string(),
    description: z.string(),
    defaultSetting: z.union([severitySchema, z.tuple([severitySchema, z.record(z.string(), z.unknown())])]),
    check: z.custom<Rule['check']>((value) => typeof value === 'function'),
  })
);

/**
 * Loads the rules a theme ships as the default export of the `./slidev-check` entry of its
 * `package.json` `exports`. A theme without that entry has no rules.
 */
export async function loadThemeRules(themeRoot: string | undefined): Promise<readonly Rule[]> {
  if (!themeRoot) return [];
  const manifestFile = Bun.file(path.join(themeRoot, 'package.json'));
  if (!(await manifestFile.exists())) return [];
  const manifest = manifestSchema.parse(await manifestFile.json());
  if (!manifest.exports || !(THEME_RULES_SUBPATH in manifest.exports)) return [];
  if (!manifest.name) throw new Error(`The theme at ${themeRoot} exports rules but has no package name.`);

  // Resolving the package's own name from its root applies its `exports` conditions like any importer does.
  const entry = Bun.resolveSync(`${manifest.name}/${THEME_RULES_SUBPATH.slice(2)}`, themeRoot);
  const module: { default?: unknown } = await import(entry);
  const result = themeRulesSchema.safeParse(module.default);
  if (!result.success)
    throw new Error(`The default export of ${entry} must be an array of rules: ${z.prettifyError(result.error)}`);
  return result.data;
}
