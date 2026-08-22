---
name: zentra-design
description: Loads Zentra's anti-generic frontend design language (Tailwind + shadcn/ui custom tokens) for any UI, screen, or component task on the Zentra Student Information System. Use when the user asks to build, style, or review a web UI, screen, or component, or wants the design to avoid generic AI-looking output.
---

# Zentra Design

You are grounding an AI assistant in Zentra's frontend design language so UI work
looks high-end and human-crafted, never template/AI-generated.

## Grounding (read first)
1. `frontend-design-direction.md` (this folder) — the full design language:
   typography pairing, color (off-white #FAFAF9 + ONE brand accent, no gradients),
   shape (rounded-md), border-over-shadow depth, role-aware density, micro-motion,
   shadcn component stack, and the anti-generic checklist.

## Hard constraints (enforce on every UI task)
- Stack is **Tailwind + shadcn/ui**, but Tailwind is scoped to shadcn UI component
  styles ONLY — it is NOT a project-wide styling migration (see PLAN.md §2). The
  rest of the app keeps its existing styling approach.
- NEVER produce: centered gradient-blob hero, gradient text, rainbow/multi-color
  sidebar, over-rounded pills, decorative blobs, "✨ powered by AI" badges, generic
  robot SVGs, default Unsplash heros, pure-white #FFFFFF backgrounds.
- Background soft off-white #FAFAF9; 1px borders (#E7E5E4); low-opacity shadow only
  on modals; one brand accent only.
- Fonts: display (Geist / Space Grotesk) for headings + body (Inter / IBM Plex Sans);
  monospaced for LRN/grades/IDs.
- Role-aware density: Principal = calm overview; Adviser/Teacher = task-dense.
- Motion: 120–180ms ease-out only; respect prefers-reduced-motion.

## Output expectation
State which role/module page the UI targets and which design tokens were applied.
Cite `frontend-design-direction.md` section when relevant.
