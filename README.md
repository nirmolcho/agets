# Agent Orchestration Studio

A visual command center for organizing and supervising a multi-agent system through an interactive organizational chart.

The app renders your organization (CEO → Departments → Managers → Agents) from `organization_tree.json`, applies a consistent dark theme from `design.json`, and provides tools to explore relationships, monitor activity, and plan work via lightweight task lists per agent.

## What this app does

- Displays a hierarchical org view with smart auto-layout and zoom/pan controls
- Provides a departments view with summary cards and a slide-in overlay for focused browsing
- Shows reporting lines (solid) and cross-team testing connections (dashed)
- Simulates agent statuses (active / idle / error) and allows manual toggling
- Lets you attach and prioritize lightweight tasks per agent (with priority, status, estimate, and due date)
- Supports drag-and-drop positioning with session-based persistence
- Offers Import/Export of a simple JSON describing the current canvas (nodes and edges)

## Core concepts

- Organization model
  - Level 0: CEO (`chief-executive-officer`)
  - Level 1: Department managers (e.g., `engineering-manager`)
  - Level 2: Individual agents (e.g., `frontend-developer`)
  - Source of truth: `organization_tree.json` defines all of the above.
- Connections
  - Hierarchy edges: manager/agent reporting lines
  - Testing edges: cross-team links to visualize collaboration/testing flows
- Tasks per agent
  - Simple per-agent list stored in memory for the session
  - Fields: title, description, priority (low/medium/high), status (pending/in-progress/done), optional estimate and due date
  - Sort by priority or due date

## UI tour

- Toolbar
  - Add Agent: quick flow that adds a level-2 agent under a department’s manager
  - Export / Import: download or load a JSON snapshot of nodes/edges/testing links
  - Departments View / Org View: switch between the department grid and full org chart
- Canvas
  - Drag: move cards; positions are saved per session
  - Zoom & Pan: mouse wheel to zoom at cursor; click-drag empty space (or middle mouse) to pan
  - Reorganize: recompute responsive layout, then zoom-to-fit
- Agent cards
  - Status dot: shows simulated activity; Start/Stop/Error controls set it manually
  - Department tag: styled by `design.json`
  - Manager cards expose quick actions to add agents to the department
- Detail panel (right side)
  - Open by clicking a card; manage per-agent tasks, sort, and quick-add
  - Time summary: stacked bars by priority; total estimate of remaining work
- Department overlay
  - Open from Department card header; see all agents in that department, open details or focus the camera on one

## Data & persistence

- Organization: `organization_tree.json` (authoritative data for org structure)
- Theme: `design.json` (authoritative theme and component styling rules)
- Session persistence: positions stored in `sessionStorage` under `agent_positions_v1` and `dept_positions_v1`
- Import/Export: downloads/uploads a runtime snapshot `{ nodes, edges, testingEdges }` of the current canvas; this is separate from the source `organization_tree.json`

## Theming rules (from `design.json`)

- Dark theme, consistent spacing and typography
- Gradients: applied only to department tags on cards
- Avoid bright backgrounds; no gradients on icons/buttons (see `rules.DO_NOT_APPLY_TO`)
- Side panels and overlay widths are driven by CSS variables set by the theme loader (`src/theme.js`)

## Tech stack & files

- Stack: Vite + vanilla JS + CSS (no frameworks)
- Entry: `index.html` → `src/app.js`
- Styling: `styles.css` (+ CSS variables populated by `src/theme.js` from `design.json`)
- Data: `organization_tree.json` and `design.json`
- Build/Dev: provided by Vite

```
src/
  app.js        // renders org, handles layout, interactions, tasks, import/export
  theme.js      // loads theme, sets CSS variables, styles connections/tags
styles.css      // dark theme UI, cards, overlays, side panel, zoom layer
index.html      // toolbar, canvas, overlays, script entry
organization_tree.json // org structure: CEO, departments, managers, agents, testing links
design.json     // theme and component styling rules
```

## Run locally

1) Install dependencies

```bash
npm install
```

2) Start the dev server (port 3000)

```bash
npm run dev
```

Open http://localhost:3000

3) Build and preview (optional)

```bash
npm run build
npm run preview # serves dist on port 3000
```

## Authentication (optional)

This project can use Supabase for Google OAuth and Email/Password auth.

1) Create a Supabase project and enable Google provider.
2) (Optional) Create `profiles` table to store user info: columns `id uuid pk`, `email text`, `full_name text`, `avatar_url text`, `updated_at timestamptz`. Enable RLS; allow insert/update for `auth.uid() = id`.
3) Add `.env` in project root:

```
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_REQUIRE_AUTH=true
VITE_GOOGLE_REDIRECT_TO=https://agets.vercel.app/login.html
```

4) Visit `/login.html` to sign in. With `VITE_REQUIRE_AUTH=true`, the main app `/` redirects to login if unauthenticated. Use the toolbar Logout button to end the session.

## Example: How it looks now

A compact sketch of the current org and a single agent card.

Org overview (simplified):

```
CEO (chief-executive-officer)
├─ Studio Operations ─ Operations Director
│  ├─ Infrastructure Maintainer   ── ░ testing: Workflow Optimizer, Performance Benchmarker
│  ├─ Finance Tracker             ── ░ testing: Tool Evaluator, Test Results Analyzer
│  └─ Support Responder          ── ░ testing: API Tester, Workflow Optimizer
├─ Design ─ Design Director
│  ├─ Visual Storyteller         ── ░ testing: Tool Evaluator, Workflow Optimizer
│  ├─ UX Researcher              ── ░ testing: Test Results Analyzer, Workflow Optimizer
│  └─ UI Designer                ── ░ testing: API Tester, Workflow Optimizer
├─ Project Management ─ PMO Director
│  └─ Project Shipper            ── ░ testing: Workflow Optimizer, Performance Benchmarker
├─ Product ─ Product Director
│  └─ Sprint Prioritizer         ── ░ testing: Workflow Optimizer, Test Results Analyzer
├─ Testing ─ Testing Director
│  ├─ Tool Evaluator
│  ├─ API Tester
│  ├─ Performance Benchmarker
│  ├─ Test Results Analyzer
│  └─ Workflow Optimizer
├─ Marketing ─ Marketing Director
│  └─ Content Creator            ── ░ testing: Performance Benchmarker, Test Results Analyzer
└─ Engineering ─ Engineering Director
   ├─ Frontend Developer         ── ░ testing: API Tester, Performance Benchmarker
   └─ AI Engineer                ── ░ testing: Performance Benchmarker, Test Results Analyzer
```

Agent card (visual essence):

```
┌──────────────────────────────────────────┐
│ CEO                                      ● status: idle
│ chief-executive-officer                  │
│                                          │
│ [ Executive ]                            │  ← department tag (gradient, from design.json)
│                                          │
│ Actions:  Start   Stop   Error           │
└──────────────────────────────────────────┘
```

Notes:
- Solid curved lines show hierarchy; dashed lines show testing connections.
- Department header click opens a slide-in overlay with agent tiles.
- Clicking an agent opens the right-side detail panel with tasks and a time summary.

## FAQ

- Where does data save?
  - Positions and UI state are kept in the browser session. Tasks are ephemeral (in-memory) and reset on refresh.
- Can I change the org or theme?
  - The org chart is defined in `organization_tree.json`. The theme is defined in `design.json`. Update those files to customize structure and appearance.
- Are statuses real-time?
  - Statuses rotate periodically to simulate activity. Use Start/Stop/Error for manual control.

