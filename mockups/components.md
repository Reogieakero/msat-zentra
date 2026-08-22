# Component Inventory & Token Mapping

Reusable shadcn/ui components for the mockups. Tailwind is scoped to these
component styles only (see PLAN.md §2).

## Primitives → usage
| shadcn component | Zentra usage | Token note |
|---|---|---|
| `Button` | actions, save, lock, sign | variant=default uses brand accent; `rounded-md`; no gradient |
| `Card` | KPI, panels, lists | white bg, 1px `#E7E5E4` border, `rounded-md`, no shadow |
| `Table` | grades, attendance, audit, advisees | `@tanstack/react-table`, sticky header, monospaced IDs |
| `Dialog` / `Sheet` | referral, detail drawers | low-opacity shadow only |
| `Form` | all inputs | react-hook-form + zod |
| `Input` / `Textarea` / `Select` | forms | `rounded-md`, 1px border |
| `Command` (cmdk) | topbar search ⌘K | |
| `NavigationMenu` | sidebar | active = accent left bar |
| `Badge` | risk level, status | red/amber/green restrained |
| `Sonner` | notifications toast | replaces raw alert |
| `Calendar` (react-day-picker) | school-year/term dates | |
| `Chart` (recharts) | heat map, trends, honor roll | flat colors, no gradient fill |

## Token map (Tailwind theme extend)
```
--background: #FAFAF9      /* app bg, not #FFF */
--surface:    #FFFFFF      /* cards */
--border:     #E7E5E4      /* stone-200 */
--foreground: #1C1917      /* stone-900 headings */
--muted:      #78716C      /* stone-500 */
--accent:     <brand>      /* ONE: green/maroon/navy */
--risk-high:  #B91C1C      /* muted red */
--risk-mod:   #D97706      /* amber */
--risk-low:   #15803D      /* green */
radius: md (6px)
font-display: Geist / Space Grotesk
font-body:    Inter / IBM Plex Sans
font-mono:    Geist Mono / JetBrains Mono
```

## Forbidden (anti-generic)
Gradient text · gradient blob hero · rainbow sidebar · `rounded-xl`+ chrome ·
decorative blobs · "✨ powered by AI" · robot SVGs · Unsplash heros · pure-white bg.
