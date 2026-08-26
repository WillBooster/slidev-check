# slidev-audit

Audits the *rendered* output of a [Slidev](https://sli.dev) deck and reports layout problems, linter-style.

It is not a static analyzer: the deck is rendered by Slidev's own dev server (the same code path as `slidev export`) inside headless Chromium, and rules inspect the resulting DOM geometry.

## Usage

```sh
bun add -d slidev-audit                      # @slidev/cli and playwright-chromium are peer dependencies
bunx playwright-chromium install chromium    # once, if Chromium is not installed yet
bunx slidev-audit slides.md
```

The deck is rendered with the `@slidev/cli` and theme installed in *your* project, so the audited output matches what `slidev` itself shows.

Nothing is printed when no rule is violated. Otherwise each violation is reported with its location, cause, and a `help:` suggestion, and the exit code is `1`:

```
3: error no-overflow: Element `<div.absolute>wide` overflows the slide by 220px at the right. help: Consider splitting the content into multiple slides.

Found 0 warnings and 1 error.
Finished in 3521ms with 2 rules.
```

Options: `--theme <name>`, `--wait <ms>`, `--timeout <ms>`, `--json`.

Add `data-slidev-audit-ignore` to an element to exclude it (and its descendants) from all rules.

## Development

```sh
bun run check   # type check
bun test
```
