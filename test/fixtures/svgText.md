---
theme: default
layout: default
---

# Unused SVG definition

<svg width="800" height="100"><defs><text style="font-size: 14px"><tspan x="0" y="20">{{ 'a'.repeat(175) }}</tspan><tspan x="0" y="40">{{ 'a'.repeat(176) }}</tspan></text></defs></svg>

---

# SVG instances

<svg width="800" height="100"><defs><text id="repeated-label" y="20" style="font-size: 14px">{{ 'a'.repeat(176) }}</text></defs><use href="#repeated-label" /><use href="#repeated-label" y="40" /></svg>

---

# Direct SVG text

<svg width="800" height="100"><text style="font-size: 14px"><tspan x="0" y="20">{{ 'a'.repeat(175) }}</tspan><tspan x="0" y="40">{{ 'a'.repeat(176) }}</tspan></text></svg>
