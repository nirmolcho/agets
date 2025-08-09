# Agent Orchestration Studio

Visual command center for AI agent orchestration using an organizational chart interface.

## Run

1. Install deps:

```bash
npm install
```

2. Start the dev server (port 3000):

```bash
npm run dev
```

Open http://localhost:3000

## Features

- Visual hierarchy with drag-and-drop
- SVG connections for reporting lines
- Department tags with gradients (from `design.json`)
- Live status indicators (simulated)
- Import/Export configuration JSON

## Theme Rules

All styling is driven by `design.json`. Gradients apply only to department tags. Bright backgrounds are avoided. No gradients on icons/buttons.


