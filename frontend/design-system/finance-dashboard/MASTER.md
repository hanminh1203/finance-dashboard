# Design System Master File

> **LOGIC:** When building a specific page, first check `design-system/finance-dashboard/pages/[page-name].md`.
> If that file exists, its rules **override** this Master file.
> If not, strictly follow the rules below.

---

**Project:** finance-dashboard
**Generated:** 2026-07-20 09:33:40
**Category:** Fintech/Crypto
**Design Dials:** Variance 4/10 (Balanced / Modern) | Motion 5/10 (Standard) | Density 8/10 (Dense / Dashboard)

**Implementation:** Quiet Ledger — light-first UI in `frontend/src` (Tailwind tokens). Dashboard overview is table-based (`/api/dashboard`), not chart-based.

---

## Global Rules

### Color Palette

| Role | Hex | Tailwind / CSS |
|------|-----|----------------|
| Primary | `#1E40AF` | `accent`, `--color-primary` |
| On Primary | `#FFFFFF` | text on primary buttons |
| Secondary | `#3B82F6` | links, secondary emphasis |
| Income / Success | `#059669` | `income` |
| Expense / Destructive | `#DC2626` | `expense` |
| Background | `#F0F3F7` | `bg` |
| Surface (card) | `#FFFFFF` | `bg-surface` |
| Raised | `#E8EDF4` | `bg-raised` |
| Border | `#D0D7E2` | `bg-border` |
| Foreground | `#0F172A` | `text-primary` |
| Muted text | `#64748B` | `text-muted` |
| Secondary text | `#475569` | `text-secondary` |
| Accent muted | `#DBEAFE` | `accent-muted` |
| Ring / focus | `#1E40AF` | `focus-visible` outline |

**Color Notes:** Trust blue + emerald income on cool paper surfaces (not dark slate default from generator).

### Typography

- **Heading Font:** IBM Plex Sans
- **Body Font:** IBM Plex Sans
- **Monospace (amounts):** IBM Plex Mono — use `.tabular-money` in UI
- **Mood:** financial, trustworthy, professional, corporate, banking, serious
- **Google Fonts:** [IBM Plex Sans + IBM Plex Sans](https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@300;400;500;600;700&display=swap)

**CSS Import:**
```css
@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@300;400;500;600;700&display=swap');
```

### Spacing Variables

*Density: 8/10 — Dense / Dashboard*

| Token | Value | Usage |
|-------|-------|-------|
| `--space-xs` | `2px` / `0.125rem` | Tight gaps |
| `--space-sm` | `4px` / `0.25rem` | Icon gaps, inline spacing |
| `--space-md` | `8px` / `0.5rem` | Standard padding |
| `--space-lg` | `12px` / `0.75rem` | Section padding |
| `--space-xl` | `16px` / `1rem` | Large gaps |
| `--space-2xl` | `24px` / `1.5rem` | Section margins |
| `--space-3xl` | `32px` / `2rem` | Hero padding |

### Shadow Depths

| Level | Value | Usage |
|-------|-------|-------|
| `--shadow-sm` | `0 1px 2px rgba(0,0,0,0.05)` | Subtle lift |
| `--shadow-md` | `0 4px 6px rgba(0,0,0,0.1)` | Cards, buttons |
| `--shadow-lg` | `0 10px 15px rgba(0,0,0,0.1)` | Modals, dropdowns |
| `--shadow-xl` | `0 20px 25px rgba(0,0,0,0.15)` | Hero images, featured cards |

---

## Component Specs

### Buttons

```css
/* Primary Button — filled trust blue */
.btn-primary {
  background: #1E40AF;
  color: #ffffff;
  padding: 10px 16px;
  border-radius: 8px;
  font-weight: 500;
  transition: background 200ms ease, transform 150ms ease;
  cursor: pointer;
}

.btn-primary:hover {
  background: #1E3A8A;
}

.btn-primary:active {
  transform: scale(0.98);
}

/* Secondary Button */
.btn-secondary {
  background: #ffffff;
  color: #0F172A;
  border: 1px solid #D0D7E2;
  padding: 8px 12px;
  border-radius: 8px;
  font-weight: 500;
  transition: border-color 200ms ease, background 200ms ease;
  cursor: pointer;
}

.btn-secondary:hover {
  border-color: rgba(30, 64, 175, 0.4);
  background: #E8EDF4;
}
```

### Cards

```css
.card {
  background: #ffffff;
  border: 1px solid #D0D7E2;
  border-radius: 12px;
  padding: 16px 20px;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04), 0 8px 24px -12px rgba(15, 23, 42, 0.08);
}

.card-title {
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: #64748B;
}
```

### Dashboard overview (/)

See **`pages/dashboard.md`**. Summary:

- 4 KPI stat cards from `summary` (includes **Saving**)
- Two `CategoryBreakdownTable` panels (income / expense, last 3 months)
- Current-month `TransactionList`
- No Chart.js on this page

### Inputs

```css
.input {
  padding: 12px 16px;
  border: 1px solid #E2E8F0;
  border-radius: 8px;
  font-size: 16px;
  transition: border-color 200ms ease;
}

.input:focus {
  border-color: #1E40AF;
  outline: none;
  box-shadow: 0 0 0 3px #1E40AF20;
}
```

### Modals

```css
.modal-overlay {
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
}

.modal {
  background: white;
  border-radius: 16px;
  padding: 32px;
  box-shadow: var(--shadow-xl);
  max-width: 500px;
  width: 90%;
}
```

---

## Style Guidelines

**Style:** Enterprise SaaS (Mobile)

**Keywords:** enterprise, saas, b2b, professional, indigo, violet, gradient, polished, trustworthy, clean, approachable, spring, haptic

**Best For:** B2B backend management, productivity tools, government and finance mobile apps, SaaS companion apps, enterprise dashboards

**Key Effects:** Indigo→Violet gradient primary CTAs + active tab highlights, colored card shadows rgba(79,70,229,0.08), pill buttons or 12pt radius, full-width CTA at screen bottom, spring press scale 0.97, floating label inputs with animated focus border, skeletal loading pulses (Indigo/Slate tint), Bottom Sheets with drag dismiss, swipe-to-action list cards, scroll-linked title collapse

### Page Pattern

**Pattern Name:** Real-Time / Operations Landing

- **Conversion Strategy:** For ops/security/iot products. Demo or sandbox link. Trust signals.
- **CTA Placement:** Primary CTA in nav + After metrics
- **Section Order:** 1. Hero (product + live preview or status), 2. Key metrics/indicators, 3. How it works, 4. CTA (Start trial / Contact)

---

## Motion

**Page Transition** (Standard) — Trigger: route change | Duration: 400-600ms | Easing: `power2.inOut`

```js
const tl = gsap.timeline(); tl.to('.transition-overlay', { yPercent: 0, duration: 0.4, ease: 'power2.inOut' }).call(navigate).to('.transition-overlay', { yPercent: -100, duration: 0.4, ease: 'power2.inOut', delay: 0.1 });
```

**Framework notes:** Keep the overlay element mounted at the layout root (outside the page component) so it survives the route swap

- ✅ Show a lightweight loading indicator if the destination route's data fetch outlasts the overlay
- ❌ Don't tie the overlay's reveal directly to data-fetch completion without a max-wait timeout; a slow API stalls the whole transition
- ⚡ Prefer CSS transform (yPercent) over top/left to keep the overlay animation on the compositor thread

---

## Anti-Patterns (Do NOT Use)

- ❌ Playful design
- ❌ Unclear fees
- ❌ AI purple/pink gradients

### Additional Forbidden Patterns

- ❌ **Emojis as icons** — Use SVG icons (Heroicons, Lucide, Simple Icons)
- ❌ **Missing cursor:pointer** — All clickable elements must have cursor:pointer
- ❌ **Layout-shifting hovers** — Avoid scale transforms that shift layout
- ❌ **Low contrast text** — Maintain 4.5:1 minimum contrast ratio
- ❌ **Instant state changes** — Always use transitions (150-300ms)
- ❌ **Invisible focus states** — Focus states must be visible for a11y

---

## Pre-Delivery Checklist

Before delivering any UI code, verify:

- [ ] No emojis used as icons (use SVG instead)
- [ ] All icons from consistent icon set (Heroicons/Lucide)
- [ ] `cursor-pointer` on all clickable elements
- [ ] Hover states with smooth transitions (150-300ms)
- [ ] Light mode: text contrast 4.5:1 minimum
- [ ] Focus states visible for keyboard navigation
- [ ] `prefers-reduced-motion` respected
- [ ] Responsive: 375px, 768px, 1024px, 1440px
- [ ] No content hidden behind fixed navbars
- [ ] No horizontal scroll on mobile
