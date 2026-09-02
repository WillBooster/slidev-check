---
theme: default
---

# Cover

Zoom is not checked on the cover slide.

---

# Too small

<div style="zoom: 0.5">

- A short list
- that would still fit
- at a much larger zoom

</div>

---

# Too large

<div style="zoom: 1">
<p v-for="i in 14" :key="i">Line {{ i }} of content that needs a smaller zoom to fit</p>
</div>

---

# Without a wrapper

<p v-for="i in 12" :key="i">Line {{ i }} of content that is too tight without a zoom</p>

---

# Optimal

<div style="zoom: 0.56">
<p v-for="i in 20" :key="i">Line {{ i }} of content zoomed to the optimal value</p>
</div>

---

# Nested wrappers

<div style="zoom: 60%">

Outer wrapper in percent.

<div style="zoom: 0.9">Inner wrapper is not checked on its own.</div>

</div>

---

# Cannot fit

<div style="zoom: 0.5">
<p v-for="i in 200" :key="i">Line {{ i }} of far too much content</p>
</div>

---

# Ignored wrapper

<div data-slidev-check-ignore style="zoom: 0.5">

- excluded from every rule

</div>

---

# Two wrappers

<div style="zoom: 0.5">
<p v-for="i in 6" :key="i">Top {{ i }}</p>
</div>

<div style="zoom: 0.5">
<p v-for="i in 6" :key="i">Bottom {{ i }}</p>
</div>

---

# Two wrappers on one line

<div style="zoom: 0.5">left</div><div style="zoom: 0.5">right</div>

---

# Code mentioning zoom

<div style="zoom: 0.5">

```html
<div style="zoom: 0.8">example</div>
```

Use `zoom: 0.7` for a smaller body.

</div>

---

# Positioned content in the wrapper

<div style="zoom: 0.5">

Some text.

<div style="position: absolute; top: 300px; left: 100px; width: 200px; height: 300px; background: #cde">Tall box</div>

</div>

---

# Image at the bottom

<div style="zoom: 0.5">

Some text above the image.

<div style="width: 300px; height: 160px; background: #cde"></div>

</div>

---

# Left overhang

<div style="zoom: 0.5">

<div style="position: relative; left: -200px; width: 500px; background: #cde">Pushed left</div>

</div>

---
zoom: 0.8
---

# Frontmatter zoom and spaced declaration

Current zoom: 0.5 is mentioned in prose.

<div style="zoom : 0.5; color: gray">

- the declaration has spaces around the colon

</div>

---

# Quotes and a custom property in the style

<div style="font-family: 'Arial'; --zoom: 0.5; zoom: 0.5">

- the declaration follows quoted and look-alike ones

</div>

---

# Ignored sibling and a look-alike attribute

<div data-slidev-check-ignore style="zoom: 0.5">excluded</div>

<div data-style="zoom: 0.5" style="zoom: 0.5">

- only this wrapper is analyzed

</div>
