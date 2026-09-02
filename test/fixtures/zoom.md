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
