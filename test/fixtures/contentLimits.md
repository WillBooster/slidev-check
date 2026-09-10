---
theme: default
layout: default
---

# Character boundary

<div><span>{{ '日'.repeat(100) }}</span> <strong>{{ '👩‍💻'.repeat(50) }}</strong> <a href="https://example.com">{{ 'e\u0301'.repeat(50) }}</a></div>
<div style="display: none">{{ 'hidden'.repeat(100) }}</div>
<div style="visibility: hidden">{{ 'hidden'.repeat(100) }}</div>
<div style="opacity: 0">{{ 'hidden'.repeat(100) }}</div>
<div data-slidev-check-ignore><span>除外</span></div>

<!-- These notes are not slide body text. -->

---

# Over character limit

<div><span>{{ '日'.repeat(100) }}</span> <strong>{{ '👩‍💻'.repeat(50) }}</strong> <a href="https://example.com">{{ 'e\u0301'.repeat(50) }}</a>!</div>

---

# List boundary

<ul><li>First<ol><li>Second</li></ol></li></ul>
<ul data-slidev-check-ignore><li>A<ul><li>B<ul><li>C</li></ul></li></ul></li></ul>

---

# Deep list

<ul><li>First<ol><li>Second<ul><li>Third</li><li>Third sibling</li></ul></li></ol></li></ul>

---

# Table boundary

<table><thead><tr><th>Key</th><th>Value</th></tr></thead><tbody><tr v-for="n in 6"><td>{{ n }}</td><td>A</td></tr><tr style="display: none"><td>Hidden</td></tr><tr data-slidev-check-ignore><td>Ignored</td></tr></tbody></table>

---

# Long table

<table><thead><tr><th>Key</th><th>Value</th></tr></thead><tbody><tr v-for="n in 7"><td>{{ n }}</td><td>A</td></tr></tbody></table>

---

# Separated Unicode characters

<div style="font-size: 18px; line-height: 24px">{{ '🇺 '.repeat(201) }}</div>

---

# Visible rows in a hidden table

<table style="visibility: hidden"><tbody><tr v-for="n in 8" style="visibility: visible"><td>{{ n }}</td></tr></tbody></table>

---

# Visible cells in hidden rows

<table><tbody><tr v-for="n in 8" style="visibility: hidden"><td><span style="visibility: visible">{{ n }}</span></td></tr></tbody></table>

---

# Fully hidden table

<table style="display: none"><tbody><tr v-for="n in 8" style="visibility: visible"><td>{{ n }}</td></tr></tbody></table>

---

# Unicode across a line break

<div style="font-size: 18px; word-break: break-all">{{ 'a'.repeat(198) }}🇺<br>🇺!</div>

---

# Visible text in hidden list items

<ul style="visibility: hidden"><li><span style="visibility: visible">A</span><ul><li><span style="visibility: visible">B</span><ul><li><span style="visibility: visible">C</span></li></ul></li></ul></li></ul>

---

# Ignored list descendants

<ul data-slidev-check-ignore style="visibility: hidden"><li><span style="visibility: visible">A</span><ul><li><span style="visibility: visible">B</span><ul><li><span style="visibility: visible">C</span></li></ul></li></ul></li></ul>

---

# Direct boxless text

<div style="font-size: 18px; word-break: break-all"><span style="display: contents">{{ '字'.repeat(201) }}</span></div>

---

# Boxless list items

<ul><li style="display: contents">A<ul><li style="display: contents">B<ul><li style="display: contents">C</li></ul></li></ul></li></ul>

---

# Multiple long tables

<div style="display: flex; gap: 24px; font-size: 14px; line-height: 20px"><table style="width: 300px"><caption>First</caption><tbody><tr v-for="n in 8"><td>{{ n }}</td></tr></tbody></table><table style="width: 300px"><caption>Second</caption><tbody><tr v-for="n in 9"><td>{{ n }}</td></tr></tbody></table></div>

---

# Hidden list with empty descendant

<ul style="visibility: hidden"><li>A<ul><li>B<ul><li>C<div style="visibility: visible"></div></li></ul></li></ul></li></ul>

---

# Hidden rows with empty descendants

<table style="visibility: hidden"><tbody><tr v-for="n in 8"><td><div style="visibility: visible"></div></td></tr></tbody></table>

---

# Hidden list with empty SVG

<ul style="visibility: hidden"><li>A<ul><li>B<ul><li>C<svg style="visibility: visible" width="20" height="20"></svg></li></ul></li></ul></li></ul>

---

# Hidden rows with empty SVG

<table style="visibility: hidden"><tbody><tr v-for="n in 8"><td><svg style="visibility: visible" width="20" height="20"></svg></td></tr></tbody></table>

---

# Ignored inline separator

<div style="font-size: 18px; word-break: break-all">{{ 'a'.repeat(198) }}🇺<span data-slidev-check-ignore>x</span>🇸!</div>

---

# Word break separator

<div style="font-size: 18px; word-break: break-all">{{ 'a'.repeat(198) }}🇺<wbr>🇸!</div>

---

# Split combining character

<div style="font-size: 18px; word-break: break-all">{{ 'a'.repeat(199) }}e<span>&#x301;</span></div>

---

# Empty ignored inline span

<div style="font-size: 18px; word-break: break-all">{{ 'a'.repeat(199) }}🇺<span data-slidev-check-ignore></span>🇸</div>

---

# Unrendered inline content

<div style="font-size: 18px; word-break: break-all">{{ 'a'.repeat(199) }}🇺<span style="display: none">x</span>🇸</div>

---

# Formatting controls

<div>{{ '\u200b'.repeat(201) }}</div>

---

# Transparent inline separator

<div style="font-size: 18px; word-break: break-all">{{ 'a'.repeat(198) }}🇺<span style="opacity: 0">x</span>🇸!</div>

---

# Skipped direct text

<div style="content-visibility: hidden; font-size: 18px; word-break: break-all">{{ 'a'.repeat(201) }}</div>

---

# Skipped third list level

<ul><li>A<ul><li>B<ul><li style="content-visibility: hidden">C</li></ul></li></ul></li></ul>

---

# Boxless text inside skipped content

<div style="content-visibility: hidden; font-size: 18px; word-break: break-all"><span style="display: contents">{{ 'a'.repeat(201) }}</span></div>

---

# Visible boxless text with ineffective properties

<div style="font-size: 18px; word-break: break-all"><span style="display: contents; opacity: 0; content-visibility: hidden">{{ 'a'.repeat(201) }}</span></div>

---

# Visible inline text with ineffective content visibility

<div style="font-size: 18px; word-break: break-all"><span style="content-visibility: hidden">{{ 'a'.repeat(201) }}</span></div>

---

# Visible rows with ineffective content visibility

<table><tbody><tr v-for="n in 8" style="content-visibility: hidden"><td>{{ n }}</td></tr></tbody></table>

---

# Skipped cell text

<table><tbody><tr><td style="content-visibility: hidden; font-size: 18px; word-break: break-all">{{ 'a'.repeat(201) }}</td></tr></tbody></table>
