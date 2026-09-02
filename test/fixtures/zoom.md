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
