# GoldQuant AI — Design System (UI/UX Pro Max)

Generated from `ui-ux-pro-max` skill · product: fintech trading risk dashboard.

## Style
- **Primary:** Cyberpunk Neon + OLED Dark (dense dashboard)
- **Not:** heavy glassmorphism blur, neumorphism
- **Motion dial:** 9/10 (visible but interruptible; respect `prefers-reduced-motion`)
- **Density dial:** 8/10 (dashboard compact)

## Colors
| Token | Hex | Use |
|-------|-----|-----|
| bg | `#0A0A0F` | App background |
| surface | `#12121A` | Cards / sidebar |
| elevated | `#1A1A28` | Hover / elevated |
| border | `#2A2A3A` | Borders |
| neon-cyan | `#00D4FF` | Primary accent / live |
| neon-pink | `#FF00AA` | Alerts / secondary |
| neon-purple | `#A78BFA` | Brand |
| neon-green | `#00FF88` | Profit / healthy |
| neon-yellow | `#F5C518` | CTA / warning |
| neon-blue | `#3B82F6` | Info |
| text | `#EDEDEF` | Primary text |
| muted | `#8A8F98` | Secondary text |

## Typography
- Body: Plus Jakarta Sans / Fira Sans
- Data: Fira Code (tabular nums)

## Effects (must be visible)
1. Animated aurora mesh background
2. CSS scanline HUD overlay (subtle)
3. Neon box-shadow on KPI cards + CTA
4. Gradient border shimmer on premium cards
5. Stagger fade-up on dashboard mount
6. Live pulse on status dots
7. Hover lift + glow (transform only, 200ms ease-out)

## Anti-patterns
- Light mode default
- Animate everything
- Hover-only critical actions
- Ignore prefers-reduced-motion
