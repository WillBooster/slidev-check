import type { Rule, RuleFinding } from '../types.ts';

export const minListItems: Rule = {
  id: 'min-list-items',
  description: 'A list must have at least the minimum number of items.',
  check: ({ page, containerSelector, options }) =>
    page.evaluate(findShortLists, { containerSelector, min: Number(options?.['min'] ?? 2) }),
};

function findShortLists({ containerSelector, min }: { containerSelector: string; min: number }): RuleFinding[] {
  const { describe, isChecked } = globalThis.__slidevCheck;
  const findings: RuleFinding[] = [];
  for (const list of document.querySelectorAll(`${containerSelector} .slidev-layout :is(ul, ol)`)) {
    // A table column often keeps the same shape in every cell, so lists in cells are left alone.
    if (!isChecked(list) || list.closest('table') || isNumberedListPart(list)) continue;
    const items = [...list.children].filter((child) => child.localName === 'li' && isChecked(child)).length;
    if (items > 0 && items < min)
      findings.push({
        message: `List \`${describe(list)}\` has ${items} item${items === 1 ? '' : 's'}, fewer than the minimum of ${min}.`,
        help: 'Consider writing the content as plain text instead of a list.',
      });
  }
  return findings;

  // Markdown splits a numbered list interrupted by other content into sibling `<ol>`s whose
  // `start` continues the numbering of the previous part.
  // oxlint-disable-next-line unicorn/consistent-function-scoping -- `page.evaluate` serializes only this function.
  function isNumberedListPart(list: Element): boolean {
    if (!(list instanceof HTMLOListElement)) return false;
    const siblings = [...(list.parentElement?.children ?? [])].filter((c) => c instanceof HTMLOListElement);
    const index = siblings.indexOf(list);
    const previous = siblings[index - 1];
    const next = siblings[index + 1];
    const listEnd = list.start + list.querySelectorAll(':scope > li').length;
    return (
      (previous !== undefined && previous.start + previous.querySelectorAll(':scope > li').length === list.start) ||
      next?.start === listEnd
    );
  }
}
