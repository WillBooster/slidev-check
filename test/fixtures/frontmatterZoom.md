---
theme: none
---

# Cover

---
zoom: 0.7
---

# Short body with a small frontmatter zoom

- one
- two

---
zoom: 0.9
---

# Long body with a large frontmatter zoom

<p v-for="i in 30" :key="i">Line {{ i }}</p>

---
zoom: 0.5
---

# Body that needs half of the zoom

<p v-for="i in 26" :key="i">Line {{ i }}</p>

---
zoom: 0.5
---

# Body whose ignored table is not measured

<p>Short</p>

<div data-slidev-check-ignore>
<p v-for="i in 26" :key="i">Line {{ i }}</p>
</div>

---
zoom: 0.5
---

# Body styled by a direct-child selector

<p v-for="i in 8" :key="i" class="large-line">Line {{ i }}</p>

<style>
.slidev-layout > p { font-size: 48px; line-height: 1.5; }
</style>

---
zoom: 1
---

# Long body with an explicit frontmatter zoom of 1

<p v-for="i in 30" :key="i">Line {{ i }}</p>

---
zoom: 0.9
---

# Long body beside an ignored note

<p v-for="i in 30" :key="i">Line {{ i }}</p>

<span data-slidev-check-ignore>note</span>

---
zoom: 0.5
---

<h1 style="white-space: nowrap; font-size: 64px">A much longer heading that is intentionally kept on a single line for readability on a narrow slide</h1>

A short body.

---
layout: two-cols
zoom: 0.5
---

# Left

- One
- Two

::right::

# Right

- Three
- Four

---
layout: two-cols-header
zoom: 0.7
---

# Two cols header

Some intro text.

::left::

- one
- two

::right::

- three
- four

::bottom::

A footnote at the bottom.

---
zoom: 0.7
---

<style>
.slidev-page[data-slidev-no="12"] .slidev-layout { display: flex; flex-direction: column; height: 100%; }
.slidev-page[data-slidev-no="12"] .footer { margin-top: auto; }
</style>

# Body with a footer at the bottom

<p>Some body text.</p>

<div class="footer">Footer</div>

---
zoom: 70%
---

# Short body with a percentage zoom

- one
- two

---
zoom: 0.1
---

<div style="height: 20000px; background: gray"></div>

---
zoom: 0.5
---

<style>
.slidev-page[data-slidev-no="15"] .slidev-layout { display: flex; flex-direction: column; height: 100%; }
</style>

<div style="margin-top: auto">Only line kept at the bottom</div>

---
zoom: 0.5
---

<h1>Short heading</h1>
<div class="body">A fixed-height diagram</div>
<div class="footer">Footer</div>

<style>
.slidev-page[data-slidev-no="16"] .slidev-layout { display: flex; flex-direction: column; padding: 40px; height: 100%; container-type: inline-size; }
.slidev-page[data-slidev-no="16"] .slidev-layout > * { flex-shrink: 0; }
.slidev-page[data-slidev-no="16"] .slidev-layout h1 { font-size: 32px; line-height: 40px; height: 40px; margin: 0; }
.slidev-page[data-slidev-no="16"] .body { height: 400px; background: #eee; }
.slidev-page[data-slidev-no="16"] .footer { margin-top: auto; height: 30px; background: #ddd; }
@container (max-width: 1200px) { .slidev-page[data-slidev-no="16"] .footer { margin-top: 32px; } }
</style>

---
zoom: 0.5
---

<div style="position: absolute; top: 40px; left: 40px">A short label</div>

---
zoom: 1
---

<div style="position: absolute; top: 40px; left: 40px; width: 800px; height: 900px; background: #eee">A diagram</div>

---
zoom: 0.5
---

<h1>Diagram</h1>
<div class="body">A fixed-height diagram</div>
<div class="footer">Footer</div>

<style>
.slidev-page[data-slidev-no="19"] .slidev-layout { display: flex; flex-direction: column; padding: 40px; height: 100%; container-type: inline-size; }
.slidev-page[data-slidev-no="19"] .slidev-layout > * { flex-shrink: 0; }
.slidev-page[data-slidev-no="19"] .slidev-layout h1 { font-size: 32px; line-height: 40px; height: 40px; margin: 0; }
.slidev-page[data-slidev-no="19"] .body { height: 400px; background: #eee; }
.slidev-page[data-slidev-no="19"] .footer { margin-top: auto; height: 30px; background: #ddd; }
@container (max-width: 1400px) { .slidev-page[data-slidev-no="19"] .footer { margin-top: 250px; } }
@container (max-width: 1150px) { .slidev-page[data-slidev-no="19"] .footer { margin-top: 32px; } }
</style>

---
zoom: 0.5
---

<h1>Diagram</h1>
<div class="body">A fixed-height diagram</div>
<div class="footer">Footer</div>

<style>
.slidev-page[data-slidev-no="20"] .slidev-layout { display: flex; flex-direction: column; padding: 40px; height: 100%; container-type: inline-size; }
.slidev-page[data-slidev-no="20"] .slidev-layout > * { flex-shrink: 0; }
.slidev-page[data-slidev-no="20"] .slidev-layout h1 { font-size: 32px; line-height: 40px; height: 40px; margin: 0; }
.slidev-page[data-slidev-no="20"] .body { height: 400px; background: #eee; }
.slidev-page[data-slidev-no="20"] .footer { margin-top: auto; height: 30px; background: #ddd; }
@container (max-width: 1400px) { .slidev-page[data-slidev-no="20"] .footer { margin-top: 250px; } }
@container (max-width: 1150px) { .slidev-page[data-slidev-no="20"] .footer { margin-top: 32px; } }
@container (min-width: 3000px) { .slidev-page[data-slidev-no="20"] .body { height: 100cqw; } }
</style>

---
zoom: 0.5
---

<div class="card">
<p>A short body inside a card</p>
<div class="footer">Footer</div>
</div>

<style>
.slidev-page[data-slidev-no="21"] .slidev-layout { padding: 40px; height: 100%; }
.slidev-page[data-slidev-no="21"] .card { display: flex; flex-direction: column; height: 100%; background: #eee; }
.slidev-page[data-slidev-no="21"] .footer { margin-top: auto; height: 40px; flex-shrink: 0; }
</style>

---
zoom: 0.5
---

<div class="card">{{ "Body line 0\nBody line 1\nBody line 2\nBody line 3\nBody line 4\nBody line 5\nBody line 6\nBody line 7\nBody line 8\nBody line 9\nBody line 10\nBody line 11\nBody line 12\nBody line 13\nBody line 14\nBody line 15\nBody line 16\nBody line 17" }}<div class="footer">Footer</div></div>

<style>
.slidev-page[data-slidev-no="22"] .slidev-layout { padding: 40px; height: 100%; }
.slidev-page[data-slidev-no="22"] .card { display: flex; flex-direction: column; height: 100%; background: #eee; white-space: pre-line; font-size: 16px; line-height: 24px; }
.slidev-page[data-slidev-no="22"] .footer { margin-top: auto; height: 40px; flex-shrink: 0; }
</style>

---
zoom: 0.5
---

<p>A short body</p>
<div class="footer">Footer<span style="position: absolute; top: 0; left: 0; visibility: hidden">Hidden hover label</span></div>

<style>
.slidev-page[data-slidev-no="23"] .slidev-layout { display: flex; flex-direction: column; position: relative; height: 100%; padding: 10px !important; }
.slidev-page[data-slidev-no="23"] .footer { margin-top: auto; height: 60px; line-height: 48px; font-size: 24px; flex-shrink: 0; background: #ddd; }
</style>

---
zoom: 0.5
---

<p>A short body</p>
<div class="footer">Footer</div>

<style>
.slidev-page[data-slidev-no="24"] .slidev-layout { display: flex; flex-direction: column; height: 100%; padding: 10px !important; container-type: inline-size; }
.slidev-page[data-slidev-no="24"] .footer { margin-top: auto; height: 40px; line-height: 24px; flex-shrink: 0; }
@container (max-width: 1040px) { .slidev-page[data-slidev-no="24"] .footer { background: #ddd; } }
</style>

---
zoom: 0.5
---

<div style="position: absolute; top: 40px; left: 40px; width: 800px; height: 900px; background: #eee">A diagram</div>

---
zoom: 0.5
---

<p>Short body</p><div class="footer">Footer<span style="position: absolute; top: 120px; left: 10px; font-size: 24px; line-height: 48px">Visible badge</span></div>

<style>
.slidev-page[data-slidev-no="26"] .slidev-layout { display: flex; flex-direction: column; position: relative; height: 100%; padding: 10px !important; }
.slidev-page[data-slidev-no="26"] .footer { margin-top: auto; height: 60px; line-height: 48px; font-size: 24px; flex-shrink: 0; background: #ddd; }
</style>

---
zoom: 0.5
---

<div class="coverbox">A long course title that must remain inside this slide</div>
<p style="margin-top: 200px">A short body</p>

<style>
.slidev-page[data-slidev-no="27"] .slidev-layout { display: flow-root; position: relative; height: 100%; }
.slidev-page[data-slidev-no="27"] .coverbox { position: absolute; inset: 0; background: #eee; white-space: nowrap; font-size: 64px; line-height: 1.2; }
</style>

---
zoom: 0.5
---

<div class="stage">A responsive diagram</div>

<style>
.slidev-page[data-slidev-no="28"] .slidev-layout { position: relative; height: 100%; padding: 40px; container-type: inline-size; }
.slidev-page[data-slidev-no="28"] .stage { position: absolute; inset: 0; background: #ddd; }
@container (max-width: 1200px) { .slidev-page[data-slidev-no="28"] .stage { position: static; inset: auto; width: 800px; height: 900px; } }
</style>

---
zoom: 0.5
---

<div class="card">
<p>Short body</p>
<div class="footer">Footer</div>
</div>

<style>
.slidev-page[data-slidev-no="29"] .slidev-layout { position: relative; height: 100%; padding: 40px; }
.slidev-page[data-slidev-no="29"] .card { height: 900px; background: #eee; }
.slidev-page[data-slidev-no="29"] .footer { position: absolute; bottom: 40px; left: 40px; }
</style>

---
zoom: 0.5
---

<div class="body">Figure</div>
<div class="footer">Footer</div>

<style>
.slidev-page[data-slidev-no="30"] .slidev-layout { container-type: inline-size; }
.slidev-page[data-slidev-no="30"] .body { height: 1200px; background: #eee; }
@container (max-width: 1000px) { .slidev-page[data-slidev-no="30"] .body { height: 300px; } }
</style>

---
zoom: 0.5
---

<style>
.slidev-page[data-slidev-no="31"] .slidev-layout { padding: 0 !important; display: flex; gap: 40px; height: 100%; }
</style>

<div style="width: 460px">
  <p style="font-size: 5px; line-height: 6px; margin: 0">tag</p>
  <p v-for="i in 33" :key="i" style="margin: 0; line-height: 24px">Left {{ i }}</p>
</div>
<div style="width: 460px">
  <div style="height: 100px; background: #eee"></div>
  <p v-for="i in 34" :key="i" style="margin: 0; line-height: 24px">Right {{ i }}</p>
</div>
