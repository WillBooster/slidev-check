---
theme: none
---

# Cover

---
zoom: 0.5
---

<h1>A heading the theme keeps unscaled</h1>
<div class="body">The body the theme scales</div>
<div class="footer">A footer the theme keeps unscaled</div>

<style>
.slidev-layout { display:flex;flex-direction:column;height:100%;padding:20px!important; }
.body { zoom:var(--slidev-slide-zoom-scale);height:200px;background:#eee; }
.footer { margin-top:auto;height:30px;flex-shrink:0;background:#ddd; }
</style>
