---
theme: default
---

# Cover

---

# Short body above a pinned note

- one
- two

<div style="position: absolute; left: 3.5rem; right: 3.5rem; bottom: 0.5rem">Pinned note</div>

---

# Long body reaching the pinned note

<p v-for="i in 12" :key="i">Line {{ i }}</p>

<div style="position: absolute; left: 3.5rem; right: 3.5rem; bottom: 0.5rem">Pinned note</div>

---

# Pinned note in a zoomed wrapper

<div style="zoom: 0.5">

- one
- two

<div style="position: absolute; left: 3.5rem; right: 3.5rem; bottom: 0.5rem">Pinned note</div>

</div>

---

# Badges anchored inside the body

<div style="position: relative; border: 1px solid; padding: 1rem">
<svg style="position: absolute; top: 0; right: 0" width="20" height="20"><rect width="20" height="20" fill="red"/></svg>
<div style="position: absolute; top: 0; left: 0">badge</div>
Card text with an icon badge
</div>

<div style="transform: translateX(0); border: 1px solid; padding: 1rem">
<div style="position: absolute; bottom: 0; right: 0">badge</div>
Card text in a transformed box
</div>

---

# Short body in size query containers

<div style="container-type: inline-size">

- one
- two

<div style="position: absolute; left: 3.5rem; right: 3.5rem; bottom: 0.5rem">Pinned note</div>

</div>

<div style="container-type: size; height: 3rem">
<div style="position: absolute; left: 3.5rem; right: 3.5rem; bottom: 3rem">Second pinned note</div>
</div>
