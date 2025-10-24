# 🧱 COMPONENTS.md — Component Specs

## 🧩 Template

**Name:**
**Purpose:**
**Props:** name | type | default | description
**Variants:**
**States:**
**A11y:**
**Tokens Used:**
**Example JSX:**

---

## 🔘 Example — Button

Purpose: trigger actions.

| Prop     | Type                              | Default   | Description         |
| -------- | --------------------------------- | --------- | ------------------- |
| variant  | 'primary' | 'secondary' | 'ghost' | 'primary' | visual style        |
| size     | 'sm' | 'md' | 'lg'                | 'md'      | size scale          |
| disabled | boolean                           | false     | disable interaction |

States: default, hover, focus, active, disabled.
A11y: role=button, aria-disabled when disabled.
Tokens: accent, radius-md, space-3–5.

---

## 💠 Example — PointTag

Shows the point value of an item.
Props: points (number), trend (up/down/flat).
A11y: `aria-label="Worth X points"`
Tokens: accent-quiet, radius-sm, caption text.

---

## 🧳 Example — WishlistCard

Displays product info + actions.
Props: title, imageUrl, price, points, reserved?.
A11y: `tabIndex=0`, focus ring.
Tokens: radius-md, spacing-4, accent.
