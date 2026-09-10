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

<div style="font-size: 24px; line-height: 30px"><div v-for="n in 10">字<small style="font-size: 8px; line-height: 0">注</small></div></div>

---

# Separated Unicode characters

<div style="font-size: 18px; line-height: 24px">{{ '🇺 '.repeat(201) }}</div>

---

# Inline mathematics

$x^2 + y^2 = z^2$<br>
$x^2 + y^2 = z^2$<br>
$x^2 + y^2 = z^2$<br>
$x^2 + y^2 = z^2$<br>
$x^2 + y^2 = z^2$<br>
$x^2 + y^2 = z^2$

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

# Inline cards

<div style="font-size: 18px; line-height: 24px"><div style="display: inline-block; width: 8em">字<br>字<br>字<br>字<br>字<br>字</div><div style="display: inline-block; width: 8em">字<br>字<br>字<br>字<br>字<br>字</div></div>

---

# Ruby annotations

<div style="font-size: 18px; line-height: 36px"><div v-for="n in 6"><ruby>漢<rt>かん</rt></ruby><ruby>字<rt>じ</rt></ruby></div></div>

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

# Inline badges in prose

<div style="font-size: 18px; line-height: 24px"><div v-for="n in 6">状態: <span style="display: inline-block; padding: 0 4px">完了</span>です。</div></div>

---

# Boxless inline wrappers

<div style="font-size: 18px; line-height: 24px"><div v-for="n in 6"><span style="display: contents"><span>A</span></span><span style="display: contents"><span>B</span></span></div></div>

---

# Direct boxless text

<div style="font-size: 18px; word-break: break-all"><span style="display: contents">{{ '字'.repeat(201) }}</span></div>


---

# Boxless list items

<ul><li style="display: contents">A<ul><li style="display: contents">B<ul><li style="display: contents">C</li></ul></li></ul></li></ul>

---

# Vertical text

<div style="writing-mode: vertical-rl; height: 1em; font-size: 18px; line-height: 24px; word-break: break-all">{{ '字'.repeat(11) }}</div>

---

# Vertical text left to right

<div style="writing-mode: vertical-lr; height: 1em; font-size: 18px; line-height: 24px; word-break: break-all">{{ '字'.repeat(11) }}</div>

---
class: text-lg
---

# Stacked mathematics

<div style="font-size: 12px">

$$
\frac{a}{b}
$$

$$
\frac{a}{b}
$$

$$
\frac{a}{b}
$$

$$
\frac{a}{b}
$$

$$
\frac{a}{b}
$$

$$
\frac{a}{b}
$$


A<br>B<br>C<br>D<br>E

</div>

---
class: text-lg
---

# Multiple equation rows

$$
\begin{aligned}
a &= b \\
a &= b \\
a &= b \\
a &= b \\
a &= b \\
a &= b \\
a &= b \\
a &= b \\
a &= b \\
a &= b \\
a &= b
\end{aligned}
$$

---

# Tight leading

<div style="font-size: 18px; line-height: 10px">字<br>字<br>字<br>字<br>字<br>字<br>字<br>字<br>字<br>字<br>字</div>
