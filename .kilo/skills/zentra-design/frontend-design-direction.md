# Zentra — Frontend Design Direction

> Goal: a high-end, human-crafted feel using **Tailwind CSS + shadcn/ui**, deliberately
> avoiding the generic "AI-generated" look. This is the web app's design language.
> Stack change from original plan: **CSS Modules dropped → Tailwind + shadcn/ui**
> (shadcn requires Tailwind). See `PLAN.md` §2.

---

## 1. Principles (anti-generic)

The UI must NOT exhibit these AI tells:
- Centered hero with gradient blob.
- Gradient text in headings.
- Rainbow/multi-color gradient sidebar.
- Over-rounded "pill" buttons (`rounded-xl`/`rounded-2xl` everywhere).
- Generic robot/abstract decorative SVG.
- "✨ Powered by AI" badges or overly friendly microcopy ("Hey there! 👋").
- Default Unsplash hero photos.
- Pure white `#FFFFFF` backgrounds with no depth.

Instead it reads as: restrained, intentional, information-clear, role-aware.

---

## 2. Typography

- **Display (headings, page titles, numbers):** Geist or Space Grotesk.
- **Body / UI text:** Inter or IBM Plex Sans.
- Mixing two deliberate faces signals design; Inter-everywhere signals default.
- Tight line-height on headings (1.1–1.2), comfortable on body (1.5).
- Monospaced (e.g. Geist Mono / JetBrains Mono) for LRN, grades, IDs, scores.

---

## 3. Color

- **Background:** soft off-white `#FAFAF9` (stone-50), not pure white.
- **Surface/cards:** white with 1px border `#E7E5E4` (stone-200), not shadow-only.
- **Neutrals:** stone/zinc scale for text (stone-900 headings, stone-500 muted).
- **Brand accent:** ONE color — school deep green, maroon, or navy. Used for primary
  actions, active nav, focus rings, key data. No second decorative accent.
- **Semantic:** risk levels use restrained, accessible colors —
  High = muted red, Moderate = amber, Low = green. Not neon.
- **No gradients** in text or large fills. Flat, confident color.

---

## 4. Shape & Depth

- Radius: `rounded-md` (6px) default. Avoid `rounded-xl`+ for chrome.
- Borders over shadows: cards/tables use 1px borders; shadows only on modals/overlays
  and kept low-opacity.
- Consistent 8px spacing grid; generous whitespace in overview pages, dense in task pages.

---

## 5. Density & Role Awareness

- This is an internal SIS — embrace data density. Dense, aligned tables are premium here.
- **Principal:** calm overview — KPI cards, status boards, school-wide trends. Lower density.
- **Adviser / Subject Teacher:** task-dense workspace — encode grades, take attendance,
  write anecdotals. Higher density, keyboard-first.
- **Guidance / Nurse / ADM:** case-focused — confidential fields hidden (O1), status-only.
- Sticky table headers, zebra/row-hover, monospaced numerics, clear sort/filter affordances.

---

## 6. Motion

- Hover/transition: 120–180ms `ease-out`.
- Page/modal transitions subtle; no parallax, no floating elements, no auto-playing motion.
- Respect `prefers-reduced-motion`.

---

## 7. Component Stack (shadcn-based)

- shadcn/ui primitives (Button, Card, Dialog, Table, Form, Select, Command, Sheet).
- `lucide` — icons (consistent stroke weight).
- `recharts` via shadcn charts — heat maps, performance trends, honor roll.
- `sonner` — cross-module notifications (maps to `notifications` table).
- `cmdk` — command palette ("search everything") for principals/advisers.
- `next-themes` — light/dark toggle.
- `@tanstack/react-table` — grade/attendance/audit-log grids.

---

## 8. Craft Checklist (per screen)

- [ ] Accessible focus ring on every interactive element.
- [ ] Real empty state (copy or illustration, not "No data").
- [ ] Skeleton loader for async tables/lists.
- [ ] Error state with retry, not a raw stack trace.
- [ ] Custom logo mark + favicon.
- [ ] No gradient text, no decorative blobs, no AI badge.

---

✅ Design direction set — Tailwind + shadcn/ui, custom tokens, anti-generic.
