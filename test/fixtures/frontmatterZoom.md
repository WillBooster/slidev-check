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
