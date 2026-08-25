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

Nothing is printed when no rule is violated. Otherwise each violation is reported with its location, cause, and a fix hint, and the exit code is `1`:

```
slides.md:18  error  Element extends outside the slide (220px beyond the right edge).  no-overflow
  slide 3 "Wide box": <div.absolute> "wide"
  hint: The content does not fit in the slide. Split it across multiple slides first; ...

✖ 1 problem
```

Options: `--theme <name>`, `--wait <ms>`, `--timeout <ms>`, `--json`.

Add `data-slidev-audit-ignore` to an element to exclude it (and its descendants) from all rules.

## Rules

| Key           | Description                                   |
| ------------- | --------------------------------------------- |
| `no-overflow` | Elements must stay within the slide bounds.   |
| `no-overlap`  | Visible elements (text, images, boxes with a background or border) must not overlap each other. Nested elements and full-slide backgrounds are exempt. |

Rules live in `src/rules/` and are registered in `src/rules/index.ts`. Each exports a `Rule` with a unique `id`, a `description`, and a `check` function that receives the Playwright page plus the selector of the slide container and returns findings. Measurement helpers shared by rules (`describe`, `measure`, `measureText`, `isAudited`) are installed into the page once by `src/browser.ts` and are available as `window.__slidevAudit` inside `page.evaluate`.

## Development

```sh
bun run check   # type check
bun test
```
