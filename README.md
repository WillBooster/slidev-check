# slidev-check

[![npm version](https://badge.fury.io/js/slidev-check.svg)](https://www.npmjs.com/package/slidev-check)
[![Test](https://github.com/WillBooster/slidev-check/actions/workflows/test.yml/badge.svg)](https://github.com/WillBooster/slidev-check/actions/workflows/test.yml)
[![wbfy](https://img.shields.io/badge/wbfy-20.1.0-1e90ff.svg)](https://github.com/WillBooster/shared/tree/main/packages/wbfy)

Audits the _rendered_ output of a [Slidev](https://sli.dev) deck and reports layout problems, linter-style.

It is not a static analyzer: the deck is rendered by Slidev's own dev server (the same code path as `slidev export`) inside headless Chromium, and rules inspect the resulting DOM geometry.

## Usage

```sh
bun add -d slidev-check                      # @slidev/cli and playwright-chromium are peer dependencies
bunx playwright-chromium install chromium    # once, if Chromium is not installed yet
bunx slidev-check slides.md
```

The deck is rendered with the `@slidev/cli` and theme installed in _your_ project, so the checked output matches what `slidev` itself shows.

Nothing is printed when no rule is violated. Otherwise each violation is reported with its location, cause, and a `help:` suggestion, and the exit code is `1`:

```
3: error no-overflow: Element `<div.absolute>wide` overflows the slide by 220px at the right. help: Consider splitting the content into multiple slides.

Found 0 warnings and 1 error.
Finished in 3521ms with 2 rules.
```

Options: `--theme <name>`, `--wait <ms>`, `--timeout <ms>`, `--json`, `--fix`.

`--fix` rewrites the slide files with the fixes that rules attach to their findings and reports what remains. Currently `optimal-zoom` provides fixes: for an element with an inline `zoom` style (typically a `<div style="zoom: 0.8">` around the whole slide body), it finds the largest zoom at which the content still keeps a margin (one text line by default) above the slide bottom, warns when the declared zoom is smaller (the content could be larger) or larger (the content is too tight or overflows), and `--fix` replaces the declared value with the optimal one.

Add `data-slidev-check-ignore` to an element to exclude it (and its descendants) from all rules.

## Development

```sh
bun run check   # type check
bun test
```
