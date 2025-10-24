# 🤖 AGENT.md — Behavior Rules

## 🎯 Mission

Implement a couples wishlist and point shop in **React**, following Apple-style minimalism from `DESIGN.md`.

## 📚 Always Read These First

1. README.md
2. DESIGN.md
3. COMPONENTS.md

## 🧱 Non-Negotiables

* Use tokens from `src/ui/tokens/tokens.css` only.
* No new colors, radii, or spacing values.
* UI components only inside `src/ui/components`.
* All components must include: states, variants, accessibility.

## ✅ Definition of Done

* Matches design tokens & accessibility.
* Keyboard navigable (Tab / Enter / Space).
* Contrast AA (≥4.5:1 text, ≥3:1 interactive).
* States covered: default / hover / focus / active / disabled / loading.

## 🧾 Commit & PR Rules

* Prefix: `feat(ui):`, `fix(ui):`, `docs(ui):` etc.
* PR Checklist:

  * [ ] Matches `DESIGN.md`
  * [ ] All states implemented
  * [ ] a11y checked
  * [ ] Docs/examples updated

## ⚠️ Avoid

* Inline magic numbers.
* Custom shadows or gradients.
* New colors outside tokens.
