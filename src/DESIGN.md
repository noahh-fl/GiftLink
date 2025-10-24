# 🎨 DESIGN.md — Apple-Style Functional Minimalism

> Goal: calm, clear, and functional. Every pixel has purpose.

## 🎨 Tokens Overview

Defined in `src/ui/tokens/tokens.css`.

| Category  | Token            | Example                   | Notes             |
| --------- | ---------------- | ------------------------- | ----------------- |
| Colors    | `--color-accent` | #0A84FF                   | Apple Blue        |
| Radius    | `--radius-md`    | 12px                      | Default for cards |
| Spacing   | `--space-4`      | 16px                      | Universal padding |
| Type      | `--font-sans`    | SF Pro / System UI        | Base font         |
| Elevation | `--elev-1`       | 0 1px 3px rgba(0,0,0,.06) | Hover depth       |

## 🧩 Core Components

### Buttons

* Variants: `primary`, `secondary`, `ghost`
* Hit area ≥ 40×40px
* Focus ring: `--focus-ring`

### Cards

* Rounded corners: `--radius-md`
* Shadow on hover: `--elev-1`
* Smooth transitions (200ms cubic-bezier)

### Typography

* H1: 32 / 700
* H2: 24 / 600
* Body: 16 / 400
* Caption: 12 / 500

### Layout

* Max width: 1200px
* Grid gap: 16px
* No hard separators → use spacing + hierarchy

## ♿ Accessibility

* Touch targets ≥44px
* Keyboard focus always visible
* Text contrast ≥4.5:1
