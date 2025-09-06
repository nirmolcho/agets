### UI Refactor Outline (Agent Orchestration Studio)

- Visual hierarchy & layout
  - Simplify agent cards: title, role, status dot, department tag; move extended details to side panel
  - Enforce solid vs dashed connection semantics; add auxiliary `.aux` class where appropriate
  - Keep subtle grid background on `.stage` and preserve during zoom/pan

- Theming & typography
  - Validate contrast (≥ 4.5:1) across cards, toolbar, side panel
  - Restrict gradients to department tags; keep buttons/icons flat
  - Apply consistent typography: dept names semibold, roles regular

- Interaction & feedback
  - Add quick actions (Start/Stop/Error) reveal on `.agent-card:hover` without layout shift
  - Animate reorganize transitions to preserve spatial context
  - Add pulse animation to status indicators; pair color with icon/character

- Task panel (right side)
  - Add sorting controls (due date, priority, status) with active state affordance
  - Collapse long task sections; expand on click; maintain accessible scrollbars
  - Use priority chips with icon + color, not color alone

- Department overlay
  - Mirror card styling in tile grid; trim to essentials
  - Dim background (`.canvas-container.dimmed`) when open; trap focus inside overlay

- Accessibility
  - Keyboard: ensure tab order across toolbar → cards → overlays → panel; add focus-visible outlines
  - Screen reader: each card announces name, role, department, status; dynamic status via `aria-live="polite"`
  - Hit targets ≥ 40x40 for touch; avoid relying on color only for status

- Implementation tasks
  - src/app.js: add `tabindex`, `aria-label` to cards; inject status icon text; manage `aria-live` updates
  - src/app.js: add class `.aux` for non-reporting connections; animate reorganize transitions
  - src/app.js: implement quick actions container inside `.agent-card` and event handlers
  - styles.css: verify contrast and tokens; ensure focus-visible styles across interactive elements
  - theme.js: extend token mapping as new statuses/departments emerge
