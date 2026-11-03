---
theme: default
---

# Cover titles may be shrunk without being reported

<style scoped>
h1 { font-size: 3em !important; }
</style>

---

# Default heading

<div style="font-size: 0.6em">

Text scaled to exactly the minimum ratio.

</div>

---

# Shrunk heading

Body text.

<style scoped>
h1 { font-size: 1.5em !important; }
</style>

---

# Zoomed body

<div style="zoom: 0.5">

- First item
- Second item with <strong>bold</strong> text

</div>

---
zoom: 0.5
---

# Zoomed slide

Body text.

---

# Transformed body

<Transform :scale="0.5">

Body text shrunk with Transform.

</Transform>
