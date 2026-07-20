# Design System: finance-dashboard

> Personal money tracking — quiet ledger, light-first, dense dashboard.
> Generated via ui-ux-pro-max; adapted to light surfaces (avoid dark/indigo-gradient defaults).

## Design Dials

| Dial | Value | Meaning |
|------|-------|---------|
| Variance | 4/10 | Balanced / modern |
| Motion | 5/10 | Standard micro-interactions |
| Density | 8/10 | Dense dashboard (8–32px rhythm) |

## Product

- **Type:** Personal finance tracker (consumer)
- **Brand:** Money Tracking
- **Currency:** AUD
- **Tone:** Calm, trustworthy, precise — a personal ledger, not a bank promo

## Style

- **Name:** Quiet Ledger (Enterprise SaaS × personal finance)
- **Mode:** Light primary; dark tokens optional later via class inversion
- **Keywords:** trustworthy, dense, scannable, professional, calm
- **Avoid:** Playful UI, purple/pink gradients, emoji-as-icons, flat single-color backgrounds without atmosphere

## Colors

| Role | Hex | CSS / Tailwind |
|------|-----|----------------|
| Primary / Accent | `#1E40AF` | `--color-primary` / `accent` |
| On Primary | `#FFFFFF` | — |
| Secondary | `#3B82F6` | chart accents |
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

## Typography

- **UI / Headings / Body:** IBM Plex Sans (300–700)
- **Numbers / tabular:** IBM Plex Mono
- **Google Fonts:** `IBM+Plex+Sans` + `IBM+Plex+Mono`
- **Mood:** Financial, trustworthy, serious, readable at dense sizes

## Spacing (density 8)

| Token | Value |
|-------|-------|
| `--space-1` | 8px |
| `--space-2` | 12px |
| `--space-3` | 16px |
| `--space-4` | 24px |
| `--space-5` | 32px |

## Effects & Motion

- Card: soft shadow `0 1px 2px rgba(15,23,42,0.04), 0 8px 24px -12px rgba(15,23,42,0.08)`
- Radius: 12px (`rounded-xl`) for cards; 8px for controls
- Press: scale 0.98 on primary buttons (150–200ms)
- Page enter: staggered fade-up 40–60ms delay steps
- Loading: skeleton pulse with slate/blue tint
- Respect `prefers-reduced-motion`

## Components

- **Nav:** Sticky, frosted white, brand mark + AUD chip, dense text tabs
- **Stat cards:** Label + large tabular amount + optional sublabel; income/expense/accent tones
- **Category breakdown tables:** Subcategory × 3 months, totals footer, MoM arrows
- **Dashboard transactions:** Current month only from API (not client-paginated)
- **Tables:** Compact rows, hover wash, clear income/expense color on amounts
- **Modals:** Strong scrim (~50% black), focus trap via Escape

## Anti-patterns

- Purple / violet CTAs or AI gradients
- Unclear fee or balance presentation
- Emoji used as structural icons
- Layout-shifting hover transforms
- Missing focus-visible rings
