# Zentra Landing Page — Content & Build Plan

> Status: PLANNING. No component files written yet (per request: plan doc only).
> Target: `frontend/` Next.js 16 App Router + React 19 + CSS Modules.
> Inspiration: `https://deepseek.com/harness/en/` (structure & behavior reference only).
> Branding: locked to Zentra design system — school deep green accent, off-white
> `#FAFAF9` base, Geist/Space Grotesk display + Inter body, `rounded-md`, 1px
> borders, micro-motion only. See PLAN.md §2 and `globals.css` tokens.

---

## 0. Reference & Adaptation Notes (DeepSeek harness → Zentra)

The DeepSeek Harness page is a single, fast-loading marketing surface with: a
sticky top nav, a centered hero with a single primary CTA + secondary link, a
tight grid of capability cards, a "how it works" / pipeline section, a
stats/trust band, and a minimal footer. We mirror that **structure and behavior**
(scroll feel, section rhythm, CTA placement) but swap all content, voice, and
visuals to Zentra's system and brand. Nothing from DeepSeek's copy, logo, or
color is carried over.

**Behavioral parity (must match the reference feel):**
- Sticky, slim top nav that stays visible on scroll; no slide-in menu for the
  marketing surface (links anchor-scroll to sections).
- Hero loads instantly, no animation on first paint beyond a 120–180ms
  ease-out fade/rise of the hero text block.
- Sections stack vertically with generous but consistent vertical rhythm.
- Anchor links scroll smoothly to section IDs.
- Fully responsive: single column on mobile, multi-column grids ≥768px.
- `prefers-reduced-motion` disables all transitions/animations.

**Deliberate deviations from the reference (anti-generic Zentra rules):**
- NO gradient text, NO gradient-blob hero, NO "✨ powered by AI" badge, NO
  default Unsplash hero image, NO multi-color accents. One green accent only.
- Off-white `#FAFAF9` background (never pure `#FFFFFF`), 1px `#E7E5E4` borders,
  `rounded-md` (6px), low-opacity shadow only on modals/interactive lift.

---

## 1. Design Tokens (from `globals.css` — use these variables)

| Token | Value | Use |
|---|---|---|
| `--background` | `oklch(0.984 0.003 95.5)` (#FAFAF9) | Page background |
| `--foreground` | `oklch(0.27 0.01 95.5)` (stone-900) | Body text |
| `--primary` | `oklch(0.45 0.09 150)` (deep green) | Accent, CTAs, marks |
| `--primary-foreground` | `oklch(0.985 0 0)` | Text on green |
| `--muted-foreground` | `oklch(0.55 0.02 95.5)` (stone-500) | Secondary text |
| `--border` | `oklch(0.922 0.006 95.5)` (#E7E5E4) | 1px borders |
| `--card` | `oklch(1 0 0)` | Card surface |
| `--radius` | `0.375rem` | `rounded-md` everywhere |
| `--accent` | `oklch(0.96 0.01 150)` | Faint green tint (hover bg) |

**Fonts (already wired in layout):** display/headings = Geist / Space Grotesk
via `--font-sans`; body = Inter via `--font-sans`; monospaced IDs/LRN/grades via
`--font-mono` (Geist Mono). Set heading `letter-spacing: -0.02em`, weight 600.

**Motion:** `transition: 120ms–180ms ease-out` on hover/transform only.

---

## 2. Page Sections (ordered, with display content + intent)

### 2.1 Top Navigation (`Nav`)
- Left: `Z` mark (green square, `rounded-md`) + wordmark **Zentra** + tag
  "Student Information System".
- Right (desktop): anchor links — Overview · Modules · How it works · Security ·
  Roles. Then a `Sign in` button (primary) + `Request access` (outline).
- Mobile: wordmark + single `Sign in` button; anchor links wrap below or collapse
  into a simple inline row (no heavy menu component needed for a marketing page).
- Sticky, `border-bottom: 1px var(--border)`, `background: var(--background)`
  with slight translucency/blur on scroll (optional, keep subtle).

### 2.2 Hero (`Hero`)
- Eyebrow: "Mati School of Arts and Trades"
- H1: "One record, every learner signal."
- Lede: "Grading, attendance, anecdotal records, and early-intervention risk —
  unified for teachers, guidance, and school leadership."
- Primary CTA: `Sign in` → `/login`.
- Secondary CTA: `See how it works` → `#how`.
- No hero image; rely on type + whitespace (anti-generic rule). Optional: a
  single thin green rule or small stat strip beneath CTAs.

### 2.3 Modules Grid (`Modules`)
Heading: "What Zentra unifies"
Four cards (2×2 desktop, 1-col mobile), each: title + 1–2 line description.
1. **Grading & Transmutation** — DepEd-weighted components, computed finals, and
   registrar validation.
2. **Attendance** — AM/PM sessions with term-rate computation and risk flags.
3. **Early Intervention** — Rule-based risk detection across academic,
   attendance, and behavior.
4. **Confidential by Design** — Tiered anecdotal, health, and ADM records with
   strict RBAC.

### 2.4 How It Works / Pipeline (`HowItWorks`) — mirrors DeepSeek "harness" flow
Heading: "From classroom signal to early action"
Sticky right-panel browser mock swaps screens per active step via scroll-sync (see 2.4 detail below). On the left, content reveals on scroll:

- **Capture** is shown as a centered, non-card block (no card chrome) with the
  section copy rendered as bullet points — it is the anchor the user must fully
  scroll past before **Detect** and **Intervene** become visible.
- **Detect** and **Intervene** stay hidden (scroll-gated) until the user has
  scrolled through the full Capture section; they appear as the next reveal once
  Capture's bottom edge passes the viewport threshold.

1. **Capture** (centered, bullet form, not a card):
   - Teachers log grades and AM/PM attendance; advisers file anecdotal records.
   - Every entry lands in one system of record the moment it is made — timestamped, attributed, and never waiting on a batch export.
   - That live capture is what makes early detection possible: a risk flag is only early if the signal arrives early.
   - Grade components, session headcounts, and confidential notes all converge into the same ledger as they happen, so nothing hides in a spreadsheet until it is too late.
2. **Detect** — The risk engine flags Low / Moderate / High across academic,
   attendance, and behavioral signals in real time.
3. **Intervene** — Referrals route to guidance, nurse, or ADM; interventions are
   reviewed, approved, and tracked to outcome.

### 2.5 Stats / Trust Band (`Stats`)
A slim band of 3–4 key figures (monospaced numerals, green accent):
- "Grades 7–12" · "3 terms / year" · "10 role-based workspaces" ·
  "Real-time risk flags". Keep copy factual, no fabricated metrics.

### 2.6 Roles (`Roles`)
Heading: "Built for every role in the school"
Grid of role chips/cards (student, parent, subject teacher, adviser, guidance,
nurse, ADM coordinator, record keeper, registrar, principal) with a one-line
responsibility each. Density calm (Principal-style overview, not task-dense).

### 2.7 Security & Compliance (`Security`)
Heading: "Confidential where it counts"
Short copy: row-level confidentiality tiering, audit trail on every sensitive
action, JWT auth, role-claimed access. No buzzwords; state what the system does.

### 2.8 CTA / Footer (`FooterCta` + `Footer`)
- CTA band: "Ready to bring Zentra to MSAT?" + `Sign in` / `Request access`.
- Footer: "© {year} Zentra · Mati School of Arts and Trades" + minimal links
  (Privacy · Access request). Single 1px top border, muted text.

---

## 3. File Split Plan (each component = its own file + its own `.module.css`)

Goal: keep the landing page file small by decomposing into focused modules.
Each module owns its markup + a co-located CSS Module. The page container only
composes them.

```
frontend/src/components/landing/
├── LandingPage.tsx            # composition only (imports sections)
├── LandingPage.module.css     # page-level layout (main flex column, section spacing)
├── Nav.tsx
├── Nav.module.css
├── Hero.tsx
├── Hero.module.css
├── Modules.tsx
├── Modules.module.css
├── HowItWorks.tsx
├── HowItWorks.module.css
├── Stats.tsx
├── Stats.module.css
├── Roles.tsx
├── Roles.module.css
├── Security.tsx
├── Security.module.css
├── FooterCta.tsx
├── FooterCta.module.css
├── Footer.tsx
└── Footer.module.css
```

- `src/app/page.tsx` becomes a thin wrapper: `import { LandingPage } from
  "@/components/landing/LandingPage"` and render it. (Currently `page.tsx` holds
  the whole landing UI — this split removes that.)
- Shared section heading style can live in each module's CSS (no global leak);
  reuse tokens (`--foreground`, `--muted-foreground`, `--primary`) — do NOT
  hardcode hex in module CSS; reference the CSS variables so light/dark stays
  consistent.
- Buttons use the existing `shadcn/ui` `Button` (`@/components/ui/button`) — that
  is the one place Tailwind/shadcn styling is allowed per PLAN.md §2.
- Icons: `lucide-react` (already a dependency), used sparingly per section.

---

## 4. Content Copy Master (paste-ready strings)

All copy below is final; components should use these verbatim.

**Nav**
- Wordmark: `Zentra`
- Tag: `Student Information System`
- Links: `Overview`, `Modules`, `How it works`, `Security`, `Roles`
- Buttons: `Sign in`, `Request access`

**Hero**
- Eyebrow: `Mati School of Arts and Trades`
- H1: `One record, every learner signal.`
- Lede: `Grading, attendance, anecdotal records, and early-intervention risk — unified for teachers, guidance, and school leadership.`
- CTA primary: `Sign in` → `/login`
- CTA secondary: `See how it works` → `#how`

**Modules** (heading `What Zentra unifies`)
1. `Grading & Transmutation` — `DepEd-weighted components, computed finals, and registrar validation.`
2. `Attendance` — `AM/PM sessions with term-rate computation and risk flags.`
3. `Early Intervention` — `Rule-based risk detection across academic, attendance, and behavior.`
4. `Confidential by Design` — `Tiered anecdotal, health, and ADM records with strict RBAC.`

**How It Works** (heading `From classroom signal to early action`)
- Right panel is a sticky browser mock with a macOS-style 3-dot window header (red/amber/green) and a mock address bar; it stays in view and swaps its screen per active step via scroll-sync.
1. `Capture` (centered, bullet form, NOT a card; scroll-gated reveal for steps 2–3):
   - `Teachers log grades and AM/PM attendance; advisers file anecdotal records.`
   - `Every entry lands in one system of record the moment it is made — timestamped, attributed, and never waiting on a batch export.`
   - `That live capture is what makes early detection possible: a risk flag is only early if the signal arrives early.`
   - `Grade components, session headcounts, and confidential notes all converge into the same ledger as they happen, so nothing hides in a spreadsheet until it is too late.`
2. `Detect` — `The risk engine flags Low / Moderate / High across academic, attendance, and behavioral signals in real time.`
3. `Intervene` — `Referrals route to guidance, nurse, or ADM; interventions are reviewed, approved, and tracked to outcome.`

**Stats**
- `Grades 7–12` · `3 terms / year` · `10 role-based workspaces` · `Real-time risk flags`

**Roles** (heading `Built for every role in the school`)
- `Student` — Views own grades, attendance, and risk level.
- `Parent / Guardian` — Follows their child's progress and alerts.
- `Subject Teacher` — Encodes grades for assigned subjects; computes finals.
- `Adviser` — Attendance, anecdotal records, and ADM tracking for advisees.
- `Guidance Counselor` — Manages confidential cases and approves interventions.
- `School Nurse` — Records and refers health visits.
- `ADM Coordinator` — Evaluates eligibility and certifies learner profiles.
- `Record Keeper` — Approves accounts and validates SF10 (Grades 7–10).
- `Registrar` — Finalizes locked grades and validates SF10 (Grades 11–12).
- `Principal` — School-wide dashboards, year/term management, audit view.

**Security** (heading `Confidential where it counts`)
- `Row-level confidentiality tiering, an audit trail on every sensitive action, JWT authentication, and role-claimed access keep learner data scoped to who needs it.`

**Footer CTA**
- Heading: `Ready to bring Zentra to MSAT?`
- Buttons: `Sign in`, `Request access`

**Footer**
- `© {year} Zentra · Mati School of Arts and Trades`
- Links: `Privacy`, `Access request`

---

## 5. Acceptance Criteria (definition of done)

- [ ] `src/app/page.tsx` is a thin wrapper; all landing UI lives under
      `components/landing/`.
- [ ] Every section is its own `.tsx` + co-located `.module.css`; no section
      exceeds ~80 lines of JSX.
- [ ] All styling uses CSS variables from `globals.css` (no hardcoded hex/green).
- [ ] Deep green `--primary` is the only accent; off-white base; `rounded-md`;
      1px borders; no gradients/blobs/AI badges.
- [ ] Sticky nav, anchor scroll, and 120–180ms hover transitions present.
- [ ] `prefers-reduced-motion` disables transitions.
- [ ] Responsive: single column ≤767px, multi-column ≥768px.
- [ ] Buttons reuse `@/components/ui/button`; icons from `lucide-react`.
- [ ] Copy matches §4 verbatim.
