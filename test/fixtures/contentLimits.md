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

# Line boundary

<div style="font-size: 18px; line-height: 24px"><div v-for="n in 10">字<span>字</span></div></div>

---

# Wrapped lines

<div style="font-size: 18px; line-height: 24px; width: 1em; word-break: break-all">{{ '字'.repeat(11) }}</div>

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
layout: two-cols
---

# Columns

<div style="font-size: 18px; line-height: 24px"><div v-for="n in 6">字<span>字</span></div></div>

::right::

<div style="font-size: 18px; line-height: 24px"><div v-for="n in 5">字<span>字</span></div></div>

---

# CSS columns

<div style="columns: 2; width: 8em; font-size: 18px; line-height: 24px">字<br>字<br>字<br>字<br>字<br>字<br>字<br>字<br>字<br>字<br>字<br>字</div>

---

# Mixed font sizes

<div style="font-size: 24px; line-height: 30px"><div v-for="n in 10">字<small style="font-size: 8px">注</small></div></div>

---

# Separated Unicode characters

<div style="font-size: 18px; line-height: 24px">{{ '🇺 '.repeat(201) }}</div>
