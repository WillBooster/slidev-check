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

---

# Short body in a boxless positioned wrapper

<div style="display: contents; position: relative">

- one
- two

<div style="position: absolute; left: 3.5rem; right: 3.5rem; bottom: 0.5rem">Pinned note</div>

</div>

---

# Badge in a card with implicit containment

<div style="zoom: 1">
<div style="content-visibility: auto; height: 100px; background: #cde">
Some short text.
<div style="position: absolute; right: 0; top: 0; background: #def">Badge</div>
</div>
</div>

---

# Takeaway positioned only in wide containers

<div style="zoom: 0.5">
<div style="container-type: inline-size">
<p>Some short body text.</p>
<div class="responsive-note">Takeaway note</div>
</div>
</div>

<style>
@container (min-width: 1000px) {
  .responsive-note { position: absolute; left: 56px; right: 56px; bottom: 80px; }
}
</style>

---

# Boxless absolute wrapper around the body

<div style="zoom: 0.5">
<div style="display: contents; position: absolute">
<p v-for="i in 12" :key="i">Line {{ i }}</p>
</div>
</div>

---

# Boxless fixed wrapper around the body

<div style="zoom: 0.5">
<div style="display: contents; position: fixed">
<p v-for="i in 12" :key="i">Line {{ i }}</p>
</div>
</div>

---

# Pinned note with its own zoom

<div style="zoom: 0.5">

Some short body text.

<div class="zoomed-note">Pinned note</div>

</div>

<style>
.zoomed-note { position: absolute; left: 56px; right: 56px; bottom: 8px; zoom: 0.8; }
</style>

---

# Important margin on the wrapper

<div class="no-margin" style="zoom: 0.5; margin-top: 80px !important">
<p v-for="i in 12" :key="i">Line {{ i }}</p>
</div>

<style>
.no-margin { margin-top: 0 !important; }
</style>

---

# Important zero margin on the wrapper

<div class="mt-0-important" style="zoom: 0.5">

Some short body text.

<div style="position: absolute; left: 3.5rem; right: 3.5rem; bottom: 0.5rem">Pinned note</div>

</div>

<style>
.mt-0-important { margin-top: 0 !important; }
</style>

---

# Logical margin after a physical reset on the wrapper

<div style="zoom: 0.5; margin: 0 !important; margin-block-start: 80px !important">
<p v-for="i in 12" :key="i">Line {{ i }}</p>
</div>

---

# Footer aligned to the bottom of a flexible card (justify-content: space-between)

<div style="height: 400px; display: flex; flex-direction: column">
<div style="zoom: 0.5; flex: 1; min-height: 0; display: flex; flex-direction: column; justify-content: space-between; background: #eee">
<div><p v-for="i in 12" :key="i">Line {{ i }}</p></div>
<p>Footer</p>
</div>
</div>

---

# Footer aligned to the bottom of a flexible card (justify-content: flex-start)

<div style="height: 400px; display: flex; flex-direction: column">
<div style="zoom: 0.5; flex: 1; min-height: 0; display: flex; flex-direction: column; justify-content: flex-start; background: #eee">
<div><p v-for="i in 12" :key="i">Line {{ i }}</p></div>
<p style="margin-top: auto">Footer</p>
</div>
</div>

---

# Wrapper beside a floated image

<canvas width="400" height="360" style="float: left; background: #cde"></canvas>
<div style="zoom: 0.5; width: 400px">
<p>Some short body text that wraps around the image.</p>
<p>Footer</p>
</div>

---

# Card positioned by a structural selector (:first-child)

<div class="structural-card" style="zoom: 0.5">
<div class="structural-badge">Badge</div>
<p v-for="i in 3" :key="i">Card line {{ i }}</p>
</div>

<style>
.structural-card:has(> .structural-badge:first-child) { position: relative; height: 200px; background: #cde; }
.structural-badge { position: absolute; right: 0; bottom: 0; }
</style>

---

# Card positioned by a structural selector (:nth-child(1))

<div class="structural-card" style="zoom: 0.5">
<div class="structural-badge">Badge</div>
<p v-for="i in 3" :key="i">Card line {{ i }}</p>
</div>

<style>
.structural-card:has(> .structural-badge:nth-child(1)) { position: relative; height: 200px; background: #cde; }
.structural-badge { position: absolute; right: 0; bottom: 0; }
</style>
