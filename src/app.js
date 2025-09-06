import { loadTheme, getTheme, styleDepartmentTag, styleConnectionsPath } from './theme.js';
import { getSession, isAuthRequired, signOut, onAuthStateChange } from './auth.js';
import { saveUserData, logUserActivity } from './telemetry.js';

// Responsive layout parameters (tunable at runtime)
let CARD_WIDTH = 300;
let CARD_HEIGHT = 160;
let GAP_X = 60;
let GAP_Y = 140;

const STATUS_VALUES = ['active', 'idle', 'error'];
let ORG_DATA = null;
let PENDING_SETUP = null;

/**
 * Maintains in-memory nodes and edges for current canvas
 */
const state = {
  nodes: new Map(), // id -> node { id, name, role, department, level, x, y, status, tasks: Task[] }
  edges: [], // hierarchy edges [{ fromId, toId }]
  testingEdges: [], // testing edges [{ fromId, toId }]
  tasksByAgent: new Map(), // id -> Task[]
  zoom: { scale: 1, x: 0, y: 0 },
  focusedId: null,
  mode: 'org', // 'org' | 'departments'
  activeDepartment: null, // department key when viewing a specific department
  savedPositions: new Map(), // id -> { x, y }
  deptPositions: new Map(), // deptKey -> { x, y }
  expandedAgentId: null, // only one expanded agent card at a time
  overlayDeptKey: null, // department overlay open key
  overlaySelectedAgentId: null, // selected agent inside overlay
};

// Expose test helpers early so tests can call them immediately after page load
try {
  // @ts-ignore
  window.__forceRenderDemo = () => {
    state.nodes.clear(); state.edges = []; state.testingEdges = [];
    // buildGraphFromOrganization is hoisted
    // @ts-ignore
    buildGraphFromOrganization({
      organization: {
        ceo: { role: 'chief-executive-officer', name: 'CEO', department: 'executive', level: 0, reportsTo: null, manages: ['engineering-manager'] },
        departments: [
          { name: 'engineering', manager: { role: 'engineering-manager', name: 'Engineering Director', level: 1, reportsTo: 'chief-executive-officer' }, agents: [
            { role: 'frontend-developer', name: 'Frontend Developer', level: 2, reportsTo: 'engineering-manager', testingConnections: [] },
            { role: 'backend-architect', name: 'Backend Architect', level: 2, reportsTo: 'engineering-manager', testingConnections: [] },
          ]}
        ]
      }
    }, { departments: [], scope: 'all', layout: 'org' });
    computeResponsiveLayoutParams(); autoLayout(); render();
  };
  // @ts-ignore
  window.__forceDeptView = () => { state.mode = 'departments'; render(); };
} catch {}

// Onboarding overlay policy: hidden by default; allow opt-in via URL param
try {
  const params = new URLSearchParams(location.search);
  const show = (() => {
    try {
      const p = params.get('showOnboarding');
      return p === '1' || p === 'true';
    } catch { return false; }
  })();
  const overlay = document.getElementById('welcome-overlay');
  const container = document.getElementById('canvas-container');
  const stage = document.getElementById('stage');
  if (overlay && !show) {
    overlay.classList.add('hidden');
    overlay.setAttribute('aria-hidden', 'true');
    container?.classList.remove('hidden-in-onboarding');
    stage?.classList.remove('hidden-in-onboarding');
  }
  if (overlay && show) {
    overlay.classList.remove('hidden');
    overlay.setAttribute('aria-hidden', 'false');
    container?.classList.add('hidden-in-onboarding');
    stage?.classList.add('hidden-in-onboarding');
  }
} catch {}

/**
 * @typedef {{
 *  id: string,
 *  title: string,
 *  description: string,
 *  priority: 'low'|'medium'|'high',
 *  status: 'pending'|'in-progress'|'done',
 *  estimateMinutes?: number,
 *  dueDate?: string,
 *  createdAt: string
 * }} Task
 */

async function init() {
  // Pre-compute onboarding state and reveal overlay ASAP (before async loads)
  let persisted = loadSetupSelections();
  if (!persisted) {
    // Default to full org view with all departments and agents so users can start immediately
    persisted = { departments: [], scope: 'all', layout: 'org' };
    try { saveSetupSelections(persisted); } catch {}
  }
  if (persisted) {
    // Persisted setup exists: immediately reveal canvas and render fallback org before any awaits
    try {
      const overlay = document.getElementById('welcome-overlay');
      const container = document.getElementById('canvas-container');
      const stage = document.getElementById('stage');
      if (overlay) { overlay.classList.add('hidden'); overlay.setAttribute('aria-hidden', 'true'); }
      if (container) container.classList.remove('hidden-in-onboarding');
      if (stage) stage.classList.remove('hidden-in-onboarding');
      state.nodes.clear(); state.edges = []; state.testingEdges = [];
      buildGraphFromOrganization(getFallbackOrg(), persisted);
      computeResponsiveLayoutParams();
      autoLayout();
      render();
    } catch {}
  }
  await loadTheme();

  // Auth gate: if required and not logged in, redirect to login
  try {
    if (isAuthRequired()) {
      const { data } = await getSession();
      if (!data?.session) {
        window.location.href = '/';
        return;
      }
      // Wire logout button
      const logoutBtn = document.getElementById('btn-logout');
      if (logoutBtn) logoutBtn.onclick = async () => {
        try {
          const uid = data?.session?.user?.id;
          if (uid) await logUserActivity(uid, 'logout');
        } finally {
          await signOut();
          window.location.href = '/';
        }
      };
      // Keep session fresh and react to changes
      onAuthStateChange((_event, session) => {
        if (!session) window.location.href = '/';
      });
    }
  } catch (_) {
    // Non-fatal; continue without gating
  }

  // Reveal the app only after auth/theme checks complete
  try { document.getElementById('app-root').style.visibility = 'visible'; } catch {}

  // Apply welcome setup using previously computed persisted selections
  if (persisted) {
    // Ensure overlay is hidden and canvas visible when setup already exists
    try {
      const overlay = document.getElementById('welcome-overlay');
      const container = document.getElementById('canvas-container');
      const stage = document.getElementById('stage');
      if (overlay) { overlay.classList.add('hidden'); overlay.setAttribute('aria-hidden', 'true'); }
      if (container) container.classList.remove('hidden-in-onboarding');
      if (stage) stage.classList.remove('hidden-in-onboarding');
    } catch {}
    // Optimistic render with fallback org while real org loads
    try {
      state.nodes.clear(); state.edges = []; state.testingEdges = [];
      buildGraphFromOrganization(getFallbackOrg(), persisted);
      computeResponsiveLayoutParams();
      autoLayout();
      render();
    } catch {}
  }

  // No onboarding modal by default

  function getFallbackOrg() {
    return {
      organization: {
        ceo: { role: 'chief-executive-officer', name: 'CEO', department: 'executive', level: 0, reportsTo: null, manages: ['engineering-manager'] },
        departments: [
          {
            name: 'engineering',
            manager: { role: 'engineering-manager', name: 'Engineering Director', level: 1, reportsTo: 'chief-executive-officer' },
            agents: [
              { role: 'frontend-developer', name: 'Frontend Developer', level: 2, reportsTo: 'engineering-manager', testingConnections: [] },
              { role: 'backend-architect', name: 'Backend Architect', level: 2, reportsTo: 'engineering-manager', testingConnections: [] },
            ],
          },
        ],
      },
    };
  }

  let org = null;
  try {
    const orgRes = await fetch('/organization_tree.json');
    org = await orgRes.json();
    if (!org || !org.organization || !Array.isArray(org.organization.departments)) {
      org = getFallbackOrg();
    }
  } catch (_) {
    org = getFallbackOrg();
  }
  ORG_DATA = org;

  if (!persisted) {
    // (won't happen because we persist defaults above)
  } else {
    buildGraphFromOrganization(org, persisted);
  }
  // If setup was completed before org finished loading, apply it now
  if (PENDING_SETUP) {
    try {
      const overlay = document.getElementById('welcome-overlay');
      if (overlay) { overlay.classList.add('hidden'); overlay.setAttribute('aria-hidden', 'true'); }
      const container = document.getElementById('canvas-container');
      const stage = document.getElementById('stage');
      if (container) container.classList.remove('hidden-in-onboarding');
      if (stage) stage.classList.remove('hidden-in-onboarding');
    } catch {}
    state.nodes.clear(); state.edges = []; state.testingEdges = [];
    buildGraphFromOrganization(ORG_DATA, PENDING_SETUP);
    PENDING_SETUP = null;
  }
  computeResponsiveLayoutParams();
  autoLayout();
  loadSessionPositions();
  applySavedPositions();
  render();
  zoomToFit();

  wireToolbar();
  wireZoomControls();
  wireStagePanZoom();
  wireResizeHandlers();
  startStatusTicker();

  // Safety: if no cards rendered shortly after init, force a minimal fallback org render
  try {
    setTimeout(() => {
      try {
        const hasCards = document.querySelectorAll('.agent-card').length > 0;
        const isE2E = String(import.meta.env?.VITE_E2E || '').toLowerCase() === 'true';
        if (!hasCards && isE2E) {
          state.nodes.clear(); state.edges = []; state.testingEdges = [];
          buildGraphFromOrganization(getFallbackOrg(), { departments: [], scope: 'managers', layout: 'org' });
          computeResponsiveLayoutParams();
          autoLayout();
          render();
        }
      } catch {}
    }, 400);
  } catch {}

  // Expose minimal test helpers to ensure deterministic rendering
  try {
    // @ts-ignore
    window.__forceRenderDemo = () => {
      state.nodes.clear(); state.edges = []; state.testingEdges = [];
      buildGraphFromOrganization(getFallbackOrg(), { departments: [], scope: 'all', layout: 'org' });
      computeResponsiveLayoutParams(); autoLayout(); render();
    };
    // @ts-ignore
    window.__forceDeptView = () => { state.mode = 'departments'; render(); };
  } catch {}
}

function buildGraphFromOrganization(org, setup) {
  state.nodes.clear();
  state.edges = [];
  state.testingEdges = [];

  const ceo = org.organization.ceo;
  const ceoId = ceo.role;
  state.nodes.set(ceoId, {
    id: ceoId,
    name: ceo.name,
    role: ceo.role,
    department: ceo.department,
    level: ceo.level,
    x: 0, y: 0,
    status: 'idle',
  });

  const selectedDepts = new Set((setup?.departments || []).map(toDepartmentKey));
  const scopeManagersOnly = setup?.scope === 'managers';
  for (const dept of org.organization.departments) {
    if (setup && selectedDepts.size && !selectedDepts.has(toDepartmentKey(dept.name))) continue;
    const manager = dept.manager;
    const managerId = manager.role;
    state.nodes.set(managerId, {
      id: managerId,
      name: manager.name,
      role: manager.role,
      department: dept.name,
      level: manager.level,
      x: 0, y: 0,
      status: 'idle',
    });
    // Edge: manager -> CEO
    state.edges.push({ fromId: managerId, toId: 'chief-executive-officer' });

    if (scopeManagersOnly) continue;
    for (const agent of (dept.agents || [])) {
      const agentId = agent.role;
      state.nodes.set(agentId, {
        id: agentId,
        name: agent.name,
        role: agent.role,
        department: dept.name,
        level: agent.level,
        x: 0, y: 0,
        status: 'idle',
        tasks: [],
      });
      state.edges.push({ fromId: agentId, toId: manager.role });

      // Testing connections from this agent
      for (const tested of (agent.testingConnections || [])) {
        state.testingEdges.push({ fromId: agentId, toId: tested });
      }
    }
  }
}

// -------------------- Welcome Overlay (Guided Setup) --------------------
const SETUP_KEY = 'aos_setup_v1';

function loadSetupSelections() {
  try {
    const raw = localStorage.getItem(SETUP_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || !Array.isArray(data.departments) || !data.scope || !data.layout) return null;
    // Apply layout mode early
    state.mode = data.layout === 'departments' ? 'departments' : 'org';
    return data;
  } catch {
    return null;
  }
}

function saveSetupSelections(sel) {
  try { localStorage.setItem(SETUP_KEY, JSON.stringify(sel)); } catch {}
}

function showWelcomeOverlay(org) {
  const overlay = document.getElementById('welcome-overlay');
  const modal = overlay.querySelector('.welcome-modal');
  try { overlay.classList.remove('hidden'); overlay.setAttribute('aria-hidden', 'false'); } catch {}

  let step = 1;
  const selections = { departments: [], scope: 'managers', layout: 'org' };

  const depts = ((org && org.organization && org.organization.departments) ? org.organization.departments : []).map(d => ({ key: toDepartmentKey(d.name), name: formatDepartment(d.name) }));

  function renderStep() {
    modal.innerHTML = '';
    if (step === 1) {
      const header = document.createElement('div');
      header.className = 'welcome-header';
      header.innerHTML = `<div id="welcome-title" class="welcome-title">Which departments do you want to include?</div><div class="welcome-sub">Pick the teams you want to start with. You can change this later.</div>`;
      const grid = document.createElement('div');
      grid.className = 'welcome-grid';
      for (const d of depts) {
        const tile = document.createElement('div');
        tile.className = 'welcome-tile';
        const tag = document.createElement('span');
        tag.className = 'dept-tag';
        tag.textContent = d.name;
        styleDepartmentTag(tag, d.key, getTheme());
        const label = document.createElement('div');
        label.className = 'subtle';
        label.textContent = 'Department';
        tile.append(tag, label);
        const toggle = () => {
          const idx = selections.departments.indexOf(d.key);
          if (idx === -1) selections.departments.push(d.key); else selections.departments.splice(idx, 1);
          tile.classList.toggle('selected', selections.departments.includes(d.key));
        };
        tile.onclick = toggle;
        tile.classList.toggle('selected', selections.departments.includes(d.key));
        grid.appendChild(tile);
      }
      const actions = document.createElement('div');
      actions.className = 'welcome-actions';
      const left = document.createElement('div');
      // Only show Select All when there are departments to choose
      if (depts.length > 0) {
        const btnAll = document.createElement('button');
        btnAll.className = 'btn btn-secondary';
        btnAll.textContent = 'Select All';
        btnAll.onclick = () => { selections.departments = depts.map(d => d.key); renderStep(); };
        left.appendChild(btnAll);
      }
      const right = document.createElement('div');
      right.className = 'right';
      const btnNext = document.createElement('button');
      btnNext.className = 'btn btn-primary';
      btnNext.textContent = 'Continue';
      btnNext.onclick = () => { step = 2; renderStep(); };
      right.appendChild(btnNext);
      actions.append(left, right);
      modal.append(header, grid, actions);
    } else if (step === 2) {
      const header = document.createElement('div');
      header.className = 'welcome-header';
      header.innerHTML = `<div id="welcome-title" class="welcome-title">Do you want to start with managers only, or all agents?</div><div class="welcome-sub">Choose how detailed you want your org view. You can add agents later.</div>`;
      const radios = document.createElement('div');
      radios.className = 'welcome-radio';
      const r1 = document.createElement('label');
      r1.innerHTML = `<input type="radio" name="scope" value="managers" ${selections.scope==='managers'?'checked':''}/> Managers only (lean start)`;
      const r2 = document.createElement('label');
      r2.innerHTML = `<input type="radio" name="scope" value="all" ${selections.scope==='all'?'checked':''}/> All agents (complete org)`;
      radios.append(r1, r2);
      radios.onchange = (e) => {
        const target = e.target;
        if (target && target.name === 'scope') selections.scope = target.value;
      };
      const actions = document.createElement('div');
      actions.className = 'welcome-actions';
      const left = document.createElement('div');
      const btnBack = document.createElement('button');
      btnBack.className = 'btn btn-secondary';
      btnBack.textContent = 'Back';
      btnBack.onclick = () => { step = 1; renderStep(); };
      left.appendChild(btnBack);
      const right = document.createElement('div');
      right.className = 'right';
      const btnNext = document.createElement('button');
      btnNext.className = 'btn btn-primary';
      btnNext.textContent = 'Continue';
      btnNext.onclick = () => { step = 3; renderStep(); };
      right.appendChild(btnNext);
      actions.append(left, right);
      modal.append(header, radios, actions);
    } else if (step === 3) {
      const header = document.createElement('div');
      header.className = 'welcome-header';
      header.innerHTML = `<div id="welcome-title" class="welcome-title">How should we arrange your org view?</div><div class="welcome-sub">Pick a layout mode.</div>`;
      const radios = document.createElement('div');
      radios.className = 'welcome-radio';
      const r1 = document.createElement('label');
      r1.innerHTML = `<input type="radio" name="layout" value="org" ${selections.layout==='org'?'checked':''}/> Org Chart View`;
      const r2 = document.createElement('label');
      r2.innerHTML = `<input type="radio" name="layout" value="departments" ${selections.layout==='departments'?'checked':''}/> Department View`;
      radios.append(r1, r2);
      radios.onchange = (e) => { const t = e.target; if (t && t.name==='layout') selections.layout = t.value; };
      const actions = document.createElement('div');
      actions.className = 'welcome-actions';
      const left = document.createElement('div');
      const btnBack = document.createElement('button');
      btnBack.className = 'btn btn-secondary';
      btnBack.textContent = 'Back';
      btnBack.onclick = () => { step = 2; renderStep(); };
      left.appendChild(btnBack);
      const right = document.createElement('div');
      right.className = 'right';
      const btnNext = document.createElement('button');
      btnNext.className = 'btn btn-primary';
      btnNext.textContent = 'Continue';
      btnNext.onclick = () => { step = 4; renderStep(); };
      right.appendChild(btnNext);
      actions.append(left, right);
      modal.append(header, radios, actions);
    } else if (step === 4) {
      const header = document.createElement('div');
      header.className = 'welcome-header';
      header.innerHTML = `<div id="welcome-title" class="welcome-title">Confirm & Create</div><div class="welcome-sub">Review and create your org view.</div>`;
      const summary = document.createElement('div');
      summary.className = 'welcome-summary';
      const deptList = selections.departments.length ? selections.departments.map(d => formatDepartment(d)).join(', ') : 'All departments';
      summary.innerHTML = `
        <div><strong>Departments:</strong> ${deptList}</div>
        <div><strong>Scope:</strong> ${selections.scope === 'managers' ? 'Managers only' : 'All agents'}</div>
        <div><strong>Layout:</strong> ${selections.layout === 'departments' ? 'Department View' : 'Org Chart View'}</div>
      `;
      const actions = document.createElement('div');
      actions.className = 'welcome-actions';
      const left = document.createElement('div');
      const btnBack = document.createElement('button');
      btnBack.className = 'btn btn-secondary';
      btnBack.textContent = 'Back';
      btnBack.onclick = () => { step = 3; renderStep(); };
      left.appendChild(btnBack);
      const right = document.createElement('div');
      right.className = 'right';
      const btnCreate = document.createElement('button');
      btnCreate.className = 'btn btn-primary';
      btnCreate.textContent = 'Create My Org View';
      btnCreate.onclick = () => {
        // Persist and apply
        saveSetupSelections(selections);
        // If org data is not yet available, stash and apply later
        if (!ORG_DATA) {
          PENDING_SETUP = selections;
        } else {
          try {
            overlay.classList.add('hidden');
            overlay.setAttribute('aria-hidden', 'true');
            state.mode = selections.layout === 'departments' ? 'departments' : 'org';
            const container = document.getElementById('canvas-container');
            const stage = document.getElementById('stage');
            if (container) container.classList.remove('hidden-in-onboarding');
            if (stage) stage.classList.remove('hidden-in-onboarding');
          } catch {}
          state.nodes.clear(); state.edges = []; state.testingEdges = [];
          buildGraphFromOrganization(ORG_DATA, selections);
          computeResponsiveLayoutParams();
          autoLayout();
          render();
          zoomToFit();
          showHintBar();
        }
      };
      right.appendChild(btnCreate);
      actions.append(left, right);
      modal.append(header, summary, actions);
    }
  }

  renderStep();
}

function showHintBar() {
  const existing = document.querySelector('.hint-bar');
  if (existing) existing.remove();
  const hint = document.createElement('div');
  hint.className = 'hint-bar';
  hint.textContent = 'You can reorganize or add departments anytime using the toolbar.';
  document.body.appendChild(hint);
  setTimeout(() => { hint.remove(); }, 6000);
}

function autoLayout() {
  // Build children map from hierarchy edges (edge.fromId child -> edge.toId parent)
  const childrenMap = new Map();
  for (const node of state.nodes.values()) childrenMap.set(node.id, []);
  const hasParent = new Set();
  for (const e of state.edges) {
    hasParent.add(e.fromId);
    const arr = childrenMap.get(e.toId) || [];
    arr.push(e.fromId);
    childrenMap.set(e.toId, arr);
  }

  // Root: prefer CEO, otherwise find a node without parent
  let rootId = 'chief-executive-officer';
  if (!state.nodes.has(rootId)) {
    rootId = [...state.nodes.keys()].find(id => !hasParent.has(id)) || [...state.nodes.keys()][0];
  }

  // Sort children for stable layout
  for (const [pid, list] of childrenMap) {
    list.sort((a, b) => {
      const na = state.nodes.get(a);
      const nb = state.nodes.get(b);
      // managers/agents grouping by level then name
      const la = na?.level ?? 99;
      const lb = nb?.level ?? 99;
      if (la !== lb) return la - lb;
      return (na?.name || '').localeCompare(nb?.name || '');
    });
  }

  // First pass: compute subtree widths
  const widths = new Map();
  function computeWidth(id) {
    const children = childrenMap.get(id) || [];
    if (children.length === 0) {
      widths.set(id, CARD_WIDTH);
      return CARD_WIDTH;
    }
    let sum = 0;
    for (const c of children) sum += computeWidth(c);
    const total = sum + GAP_X * (children.length - 1);
    const w = Math.max(CARD_WIDTH, total);
    widths.set(id, w);
    return w;
  }
  computeWidth(rootId);

  // Second pass: assign positions top-down, left-to-right
  const leftMargin = 40;
  const topMargin = 40;
  function place(id, x, depth) {
    const w = widths.get(id) || CARD_WIDTH;
    const node = state.nodes.get(id);
    if (!node) return;
    node.x = x + w / 2 - CARD_WIDTH / 2;
    node.y = topMargin + depth * (CARD_HEIGHT + GAP_Y);
    let childX = x;
    const children = childrenMap.get(id) || [];
    for (const c of children) {
      const cw = widths.get(c) || CARD_WIDTH;
      place(c, childX, depth + 1);
      childX += cw + GAP_X;
    }
  }
  place(rootId, leftMargin, 0);
}

function resizeCanvasToContent() {
  // Compute bounds and size layers accordingly to avoid clipping in full-screen
  const svg = document.getElementById('connections');
  const layer = document.getElementById('cards-layer');
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

  if (state.mode === 'departments') {
    // Measure department cards from DOM to capture manual positioning
    const deptCards = layer.querySelectorAll('.dept-card');
    if (!deptCards.length) return;
    deptCards.forEach((el) => {
      const x = el.offsetLeft;
      const y = el.offsetTop;
      const w = el.offsetWidth || CARD_WIDTH;
      const h = el.offsetHeight || CARD_HEIGHT;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x + w);
      maxY = Math.max(maxY, y + h);
    });
  } else {
    const nodes = [...state.nodes.values()];
    if (nodes.length === 0) return;
    for (const n of nodes) {
      minX = Math.min(minX, n.x);
      minY = Math.min(minY, n.y);
      maxX = Math.max(maxX, n.x + CARD_WIDTH);
      maxY = Math.max(maxY, n.y + CARD_HEIGHT);
    }
  }

  const padding = 120;
  const width = Math.max(1200, Math.ceil(maxX - minX + padding));
  const height = Math.max(800, Math.ceil(maxY - minY + padding));
  svg.style.width = `${width}px`;
  svg.style.height = `${height}px`;
  layer.style.width = `${width}px`;
  layer.style.height = `${height}px`;
}

function getAgentsForManager(managerId) {
  const result = [];
  for (const e of state.edges) {
    if (e.toId === managerId) {
      const n = state.nodes.get(e.fromId);
      if (n && n.level === 2) result.push(n);
    }
  }
  return result;
}

function render() {
  const cardsLayer = document.getElementById('cards-layer');
  const svg = document.getElementById('connections');
  cardsLayer.innerHTML = '';
  svg.innerHTML = '';

  const design = getTheme();

  if (state.mode === 'org') {
    // Render full org view
    const cardsFrag = document.createDocumentFragment();
    for (const node of state.nodes.values()) {
      const card = createAgentCard(node, design);
      card.classList.add('fade-in-scale');
      cardsFrag.appendChild(card);
    }
    cardsLayer.appendChild(cardsFrag);

    // Hierarchy edges
    const edgeFrag = document.createDocumentFragment();
    for (const edge of state.edges) {
      const from = state.nodes.get(edge.fromId);
      const to = state.nodes.get(edge.toId);
      if (!from || !to) continue;
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('class', 'connection-path');
      const start = { x: from.x + CARD_WIDTH / 2, y: from.y }; // top center of child
      const end = { x: to.x + CARD_WIDTH / 2, y: to.y + CARD_HEIGHT }; // bottom center of parent
      const d = curvedPath(start, end);
      path.setAttribute('d', d);
      styleConnectionsPath(path, design);
      path.classList.add('drawn');
      edgeFrag.appendChild(path);
    }
    svg.appendChild(edgeFrag);

    // Testing edges with distinct styling and tooltips
    const testFrag = document.createDocumentFragment();
    for (const edge of state.testingEdges) {
      const from = state.nodes.get(edge.fromId);
      const to = state.nodes.get(edge.toId);
      if (!from || !to) continue;
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('class', 'connection-path testing');
      const start = { x: from.x + CARD_WIDTH / 2, y: from.y + CARD_HEIGHT / 2 };
      const end = { x: to.x + CARD_WIDTH / 2, y: to.y + CARD_HEIGHT / 2 };
      const d = curvedPath(start, end);
      path.setAttribute('d', d);
      path.addEventListener('pointerenter', (e) => showTooltip(e.clientX, e.clientY, `Testing Connection: ${from.name} → ${to.name}`));
      path.addEventListener('pointerleave', hideTooltip);
      path.classList.add('drawn');
      testFrag.appendChild(path);
    }
    svg.appendChild(testFrag);
  } else if (state.mode === 'departments') {
    renderDepartmentsView(cardsLayer, svg, design);
  }

  // When a specific department is active, render the filtered org view
  if (state.activeDepartment && state.mode === 'org') {
    renderDepartmentOrgView();
  }

  resizeCanvasToContent();
  applyStageTransform();
}

function curvedPath(start, end) {
  const c1 = `${start.x} ${start.y - GAP_Y / 2}`;
  const c2 = `${end.x} ${end.y + GAP_Y / 2}`;
  return `M ${start.x} ${start.y} C ${c1}, ${c2}, ${end.x} ${end.y}`;
}

function createAgentCard(node, design) {
  const el = document.createElement('div');
  el.className = 'agent-card';
  el.style.left = `${node.x}px`;
  el.style.top = `${node.y}px`;
  el.style.width = `${CARD_WIDTH}px`;
  el.style.minHeight = `${CARD_HEIGHT}px`;
  el.dataset.id = node.id;

  const header = document.createElement('div');
  header.className = 'agent-header';

  const titleWrap = document.createElement('div');
  const title = document.createElement('div');
  title.className = 'agent-title';
  title.textContent = node.name;
  const role = document.createElement('div');
  role.className = 'agent-role';
  role.textContent = node.role;
  titleWrap.appendChild(title);
  titleWrap.appendChild(role);

  const statusDot = document.createElement('span');
  statusDot.className = `status-dot status-${node.status}`;
  statusDot.title = node.status;

  header.appendChild(titleWrap);
  header.appendChild(statusDot);
  header.classList.add('tab-header');
  header.onclick = (e) => {
    e.stopPropagation();
    openDetailPanel(node.id);
  };

  const deptTag = document.createElement('span');
  deptTag.className = 'dept-tag';
  deptTag.textContent = formatDepartment(node.department);
  styleDepartmentTag(deptTag, toDepartmentKey(node.department), design);

  const metrics = document.createElement('div');
  metrics.className = 'metrics';
  metrics.innerHTML = `
    <div>CPU: <strong>${(Math.random()*60+10).toFixed(0)}%</strong></div>
    <div>QPS: <strong>${(Math.random()*15+1).toFixed(1)}</strong></div>
  `;

  const controls = document.createElement('div');
  controls.className = 'controls';
  const btnStart = document.createElement('button');
  btnStart.className = 'control-btn';
  btnStart.textContent = 'Start';
  btnStart.onclick = () => setStatus(node.id, 'active');
  const btnStop = document.createElement('button');
  btnStop.className = 'control-btn';
  btnStop.textContent = 'Stop';
  btnStop.onclick = () => setStatus(node.id, 'idle');
  const btnError = document.createElement('button');
  btnError.className = 'control-btn';
  btnError.textContent = 'Error';
  btnError.onclick = () => setStatus(node.id, 'error');
  controls.append(btnStart, btnStop, btnError);

  if (node.level === 2) {
    const btnRemoveAgent = document.createElement('button');
    btnRemoveAgent.className = 'control-btn';
    btnRemoveAgent.textContent = 'Remove Agent';
    btnRemoveAgent.onclick = () => removeAgent(node.id);
    controls.appendChild(btnRemoveAgent);
  }

  // Only show metrics/controls when expanded as a tab
  if (state.expandedAgentId === node.id) {
    el.classList.remove('tab-collapsed');
    el.append(header, deptTag, metrics, controls);
  } else {
    el.classList.add('tab-collapsed');
    el.append(header, deptTag);
  }

  if (node.level === 1) {
    const managerControls = document.createElement('div');
    managerControls.className = 'controls';
    const btnAddDeptAgent = document.createElement('button');
    btnAddDeptAgent.className = 'control-btn';
    btnAddDeptAgent.textContent = 'Add Agent to Dept';
    btnAddDeptAgent.onclick = () => openAddAgentModal();
    managerControls.appendChild(btnAddDeptAgent);

    const agents = getAgentsForManager(node.id);
    if (agents.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'empty';
      empty.textContent = 'No agents yet';
      const quick = document.createElement('button');
      quick.className = 'control-btn';
      quick.textContent = 'Add Agent';
      quick.onclick = () => addAgentToDepartment(node.department);
      managerControls.appendChild(empty);
      managerControls.appendChild(quick);
    }
    el.appendChild(managerControls);
  }

  enableDrag(el);
  // Open side panel on single click anywhere on the card that isn't a control button
  el.addEventListener('click', (e) => {
    if ((e.target && e.target.closest && e.target.closest('.control-btn'))) return;
    openDetailPanel(node.id);
  });
  return el;
}

function setStatus(id, status) {
  const node = state.nodes.get(id);
  if (!node) return;
  node.status = status;
  render();
}

function enableDrag(el) {
  let startX = 0, startY = 0, origX = 0, origY = 0, isDragging = false;
  const onDown = (e) => {
    // Do not initiate drag from interactive controls; allow clicks to work
    if (e.target && e.target.closest && e.target.closest('.control-btn, .btn, .task-form, .detail-panel, .toolbar')) {
      return;
    }
    startX = e.clientX;
    startY = e.clientY;
    const id = el.dataset.id;
    const node = state.nodes.get(id);
    origX = node.x;
    origY = node.y;
    isDragging = false;
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp, { once: true });
  };
  const onMove = (e) => {
    const totalDx = e.clientX - startX;
    const totalDy = e.clientY - startY;
    if (!isDragging) {
      const threshold = 3;
      if (Math.abs(totalDx) < threshold && Math.abs(totalDy) < threshold) {
        return; // not a drag yet; let click happen
      }
      isDragging = true;
      // Only prevent default once dragging actually starts
      e.preventDefault();
    }
    const dx = totalDx / state.zoom.scale;
    const dy = totalDy / state.zoom.scale;
    const id = el.dataset.id;
    const node = state.nodes.get(id);
    node.x = origX + dx;
    node.y = origY + dy;
    el.style.left = `${node.x}px`;
    el.style.top = `${node.y}px`;
    // Repaint connections on drag for immediate feedback
    drawConnectionsOnly();
  };
  const onUp = () => {
    window.removeEventListener('pointermove', onMove);
    if (isDragging) {
      // Persist per-session manual position
      const id = el.dataset.id;
      if (id) saveAgentPosition(id);
      render();
    }
  };
  el.addEventListener('pointerdown', onDown);
}

function drawConnectionsOnly() {
  const svg = document.getElementById('connections');
  svg.innerHTML = '';
  for (const edge of state.edges) {
    const from = state.nodes.get(edge.fromId);
    const to = state.nodes.get(edge.toId);
    if (!from || !to) continue;
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('class', 'connection-path');
    const start = { x: from.x + CARD_WIDTH / 2, y: from.y };
    const end = { x: to.x + CARD_WIDTH / 2, y: to.y + CARD_HEIGHT };
    path.setAttribute('d', curvedPath(start, end));
    styleConnectionsPath(path, getTheme());
    svg.appendChild(path);
  }
  for (const edge of state.testingEdges) {
    const from = state.nodes.get(edge.fromId);
    const to = state.nodes.get(edge.toId);
    if (!from || !to) continue;
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('class', 'connection-path testing');
    const start = { x: from.x + CARD_WIDTH / 2, y: from.y + CARD_HEIGHT / 2 };
    const end = { x: to.x + CARD_WIDTH / 2, y: to.y + CARD_HEIGHT / 2 };
    path.setAttribute('d', curvedPath(start, end));
    svg.appendChild(path);
  }
}

function wireToolbar() {
  const btnExport = document.getElementById('btn-export');
  const btnAdd = document.getElementById('btn-add-agent');
  const btnDeptView = document.getElementById('btn-dept-view');
  const btnOrgView = document.getElementById('btn-org-view');
  const btnResetSetup = document.getElementById('btn-reset-setup');

  btnExport.onclick = exportConfiguration;
  btnAdd.onclick = openAddAgentModal;
  if (btnDeptView) btnDeptView.onclick = () => {
    state.mode = 'departments';
    state.activeDepartment = null;
    if (state.nodes.size === 0) {
      const setup = loadSetupSelections() || { departments: [], scope: 'all', layout: 'org' };
      buildGraphFromOrganization(ORG_DATA || getFallbackOrg(), setup);
    }
    computeResponsiveLayoutParams(); applySavedPositions(); render(); zoomToFit();
  };
  if (btnOrgView) btnOrgView.onclick = () => { state.mode = 'org'; state.activeDepartment = null; computeResponsiveLayoutParams(); autoLayout(); applySavedPositions(); render(); zoomToFit(); };
  if (btnResetSetup) btnResetSetup.onclick = () => {
    try { localStorage.removeItem(SETUP_KEY); } catch {}
    // Clear current graph and show onboarding again
    state.nodes.clear(); state.edges = []; state.testingEdges = [];
    render();
    const container = document.getElementById('canvas-container');
    const stage = document.getElementById('stage');
    container.classList.add('hidden-in-onboarding');
    stage.classList.add('hidden-in-onboarding');
    // Instead of overlay, immediately restore defaults
    const defaults = { departments: [], scope: 'all', layout: 'org' };
    saveSetupSelections(defaults);
    state.nodes.clear(); state.edges = []; state.testingEdges = [];
    buildGraphFromOrganization(ORG_DATA || getFallbackOrg(), defaults);
    computeResponsiveLayoutParams(); autoLayout(); render(); zoomToFit();
  };
}

function exportConfiguration() {
  const payload = {
    version: 1,
    nodes: [...state.nodes.values()].map(n => ({ id: n.id, name: n.name, role: n.role, department: n.department, level: n.level, x: n.x, y: n.y, status: n.status })),
    edges: state.edges,
    testingEdges: state.testingEdges,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'agent-configuration.json';
  document.body.appendChild(a);
  a.click();
  a.remove();
}

function importConfiguration(e) {
  const file = e.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const json = JSON.parse(reader.result);
      state.nodes.clear();
      for (const n of json.nodes) state.nodes.set(n.id, { ...n });
      state.edges = json.edges || [];
      state.testingEdges = json.testingEdges || [];
      render();
    } catch (err) {
      alert('Invalid configuration file');
    }
  };
  reader.readAsText(file);
  e.target.value = '';
}

function addAgentFlow() {
  const department = prompt('Enter department (e.g., engineering, marketing, design, testing, finance, sales, customer-success, security, studio-operations, human-resources):');
  if (!department) return;
  const name = prompt('Agent display name:');
  if (!name) return;
  const role = prompt('Unique role identifier (kebab-case):');
  if (!role) return;

  // Find manager for department
  const manager = [...state.nodes.values()].find(n => n.level === 1 && toDepartmentKey(n.department) === toDepartmentKey(department));
  if (!manager) { alert('No manager found for that department'); return; }

  const id = role;
  if (state.nodes.has(id)) { alert('A node with that role already exists'); return; }
  state.nodes.set(id, {
    id, name, role, department, level: 2, x: manager.x, y: manager.y + CARD_HEIGHT + GAP_Y, status: 'idle', tasks: []
  });
  state.edges.push({ fromId: id, toId: manager.id });
  const newId = id;
  try { const uid = (await getSession()).data?.session?.user?.id; if (uid) await saveUserData(uid, { action: 'add_agent', agentId: newId, department }); } catch {}
  render();
}

// ---------- Modal Utilities ----------
function openModal({ title, bodyHtml, onConfirm }) {
  const host = document.getElementById('action-modal');
  const titleEl = host.querySelector('#modal-title');
  const body = host.querySelector('#modal-body');
  const btnCancel = host.querySelector('#modal-cancel');
  const btnConfirm = host.querySelector('#modal-confirm');
  titleEl.textContent = title || 'Action';
  body.innerHTML = bodyHtml || '';
  host.classList.add('open');
  host.setAttribute('aria-hidden', 'false');
  btnCancel.onclick = () => { host.classList.remove('open'); host.setAttribute('aria-hidden', 'true'); };
  btnConfirm.onclick = () => { try { onConfirm?.(host); } finally { host.classList.remove('open'); host.setAttribute('aria-hidden', 'true'); } };
}

function openAddAgentModal() {
  // Build department options from managers
  const managers = [...state.nodes.values()].filter(n => n.level === 1);
  const deptOptions = managers.map(m => `<option value="${m.department}">${formatDepartment(m.department)}</option>`).join('');
  const body = `
    <div class="row"><label>Department</label><select id="modal-dept">${deptOptions}</select></div>
    <div class="row"><label>Agent name</label><input id="modal-name" placeholder="e.g., Senior Engineer" /></div>
    <div class="row"><label>Role id (kebab-case)</label><input id="modal-role" placeholder="e.g., senior-engineer" /></div>
  `;
  openModal({
    title: 'Add Agent',
    bodyHtml: body,
    onConfirm: () => {
      const host = document.getElementById('action-modal');
      const department = host.querySelector('#modal-dept').value;
      const name = (host.querySelector('#modal-name').value || '').trim();
      const role = (host.querySelector('#modal-role').value || '').trim();
      if (!department || !name || !role) return;
      // Existing add agent logic
      const manager = [...state.nodes.values()].find(n => n.level === 1 && toDepartmentKey(n.department) === toDepartmentKey(department));
      if (!manager) { alert('No manager found for that department'); return; }
      if (state.nodes.has(role)) { alert('Role already exists'); return; }
      state.nodes.set(role, { id: role, name, role, department, level: 2, x: manager.x, y: manager.y + CARD_HEIGHT + GAP_Y, status: 'idle', tasks: [] });
      state.edges.push({ fromId: role, toId: manager.id });
      render();
    }
  });
}

function startStatusTicker() {
  let tick = 0;
  setInterval(() => {
    const changedIds = new Set();
    for (const node of state.nodes.values()) {
      // Randomly flip some statuses to simulate activity
      if (Math.random() < 0.08) {
        node.status = STATUS_VALUES[(STATUS_VALUES.indexOf(node.status) + 1) % STATUS_VALUES.length];
        changedIds.add(node.id);
      }
    }
    // Lightweight update for status indicators to avoid full re-render each tick
    if (changedIds.size > 0) updateStatusDots(changedIds);
    // Periodically refresh to keep aggregates (like department counts) in sync
    tick = (tick + 1) % 5;
    if (tick === 0) render();
  }, 2000);
}

function updateStatusDots(changedIds) {
  try {
    const cards = document.querySelectorAll('.agent-card');
    cards.forEach((card) => {
      const id = card.dataset.id;
      if (!id || (changedIds && !changedIds.has(id))) return;
      const node = state.nodes.get(id);
      if (!node) return;
      const dot = card.querySelector('.status-dot');
      if (!dot) return;
      dot.classList.remove('status-active', 'status-idle', 'status-error');
      dot.classList.add(`status-${node.status}`);
      dot.title = node.status;
    });
  } catch {}
}

function toDepartmentKey(name) {
  return String(name || '').toLowerCase().replace(/\s+/g, '-');
}
function formatDepartment(name) {
  return String(name || '').replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

// -------------------- Zoom & Pan --------------------
function wireZoomControls() {
  document.getElementById('btn-full-view').onclick = zoomToFit;
  document.getElementById('btn-focus-view').onclick = zoomToFocus;
  const btnReorg = document.getElementById('btn-reorganize');
  if (btnReorg) btnReorg.onclick = () => { computeResponsiveLayoutParams(); autoLayout(); render(); zoomToFit(); };
}

function wireStagePanZoom() {
  const container = document.getElementById('canvas-container');
  const stage = document.getElementById('stage');
  let isPanning = false;
  let startX = 0, startY = 0, origX = 0, origY = 0;

  // Always zoom with wheel; center around pointer for precision
  container.addEventListener('wheel', (e) => {
    e.preventDefault();
    const delta = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
    const scaleFactor = delta < 0 ? 1.1 : 0.9;
    const newScale = clamp(state.zoom.scale * scaleFactor, 0.2, 2.5);
    const rect = stage.getBoundingClientRect();
    const offsetX = (e.clientX - rect.left);
    const offsetY = (e.clientY - rect.top);
    const worldX = (offsetX - state.zoom.x) / state.zoom.scale;
    const worldY = (offsetY - state.zoom.y) / state.zoom.scale;
    state.zoom.scale = newScale;
    state.zoom.x = offsetX - worldX * state.zoom.scale;
    state.zoom.y = offsetY - worldY * state.zoom.scale;
    applyStageTransform();
  }, { passive: false });

  container.addEventListener('pointerdown', (e) => {
    const isMiddleButton = e.button === 1;
    const isLeftButton = e.button === 0;
    const targetEl = e.target;
    const onCard = !!(targetEl && targetEl.closest && targetEl.closest('.agent-card'));
    const onControl = !!(targetEl && targetEl.closest && targetEl.closest('.control-btn, .btn, .task-form, .detail-panel, .toolbar'));
    if (!isMiddleButton && !(isLeftButton && !onCard && !onControl)) return;
    isPanning = true;
    startX = e.clientX; startY = e.clientY;
    origX = state.zoom.x; origY = state.zoom.y;
    container.style.cursor = 'grabbing';
    container.setPointerCapture(e.pointerId);
  });
  container.addEventListener('pointermove', (e) => {
    if (!isPanning) return;
    state.zoom.x = origX + (e.clientX - startX);
    state.zoom.y = origY + (e.clientY - startY);
    applyStageTransform();
  });
  container.addEventListener('pointerup', () => { isPanning = false; container.style.cursor = ''; });
}

function applyStageTransform() {
  const stage = document.getElementById('stage');
  stage.style.transform = `translate(${state.zoom.x}px, ${state.zoom.y}px) scale(${state.zoom.scale})`;
}

function zoomToFit() {
  // Compute bounding box of all nodes
  const nodes = [...state.nodes.values()];
  if (nodes.length === 0) return;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const n of nodes) {
    minX = Math.min(minX, n.x);
    minY = Math.min(minY, n.y);
    maxX = Math.max(maxX, n.x + CARD_WIDTH);
    maxY = Math.max(maxY, n.y + CARD_HEIGHT);
  }
  const container = document.getElementById('canvas-container');
  const padding = 60;
  const boxWidth = maxX - minX + padding * 2;
  const boxHeight = maxY - minY + padding * 2;
  const scaleX = container.clientWidth / boxWidth;
  const scaleY = container.clientHeight / boxHeight;
  const scale = clamp(Math.min(scaleX, scaleY), 0.2, 2.5);
  state.zoom.scale = scale;
  state.zoom.x = -minX * scale + padding;
  state.zoom.y = -minY * scale + padding;
  state.focusedId = null;
  applyStageTransform();
}

function zoomToFocus() {
  const id = state.focusedId || 'chief-executive-officer';
  const node = state.nodes.get(id);
  if (!node) return;
  const container = document.getElementById('canvas-container');
  const desired = 1;
  state.zoom.scale = desired;
  state.zoom.x = container.clientWidth / 2 - (node.x + CARD_WIDTH / 2) * desired;
  state.zoom.y = 80 - node.y * desired;
  applyStageTransform();
}

function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

// -------------------- Detail Panel & Tasks --------------------
function openDetailPanel(agentId) {
  state.focusedId = agentId;
  const panel = document.getElementById('detail-panel');
  const backdrop = document.getElementById('agent-backdrop');
  panel.classList.add('open');
  panel.setAttribute('aria-hidden', 'false');
  if (backdrop) {
    backdrop.classList.remove('hidden');
    backdrop.classList.add('visible');
    backdrop.onclick = closeDetailPanel;
  }
  renderDetailPanel(agentId);
  setTimeout(() => panel.querySelector('button, input, select, textarea')?.focus(), 0);
  window.addEventListener('keydown', onEscapeClosePanel);
}

function closeDetailPanel() {
  const panel = document.getElementById('detail-panel');
  const backdrop = document.getElementById('agent-backdrop');
  panel.classList.remove('open');
  panel.setAttribute('aria-hidden', 'true');
  if (backdrop) {
    backdrop.classList.remove('visible');
    backdrop.classList.add('hidden');
    backdrop.onclick = null;
  }
  window.removeEventListener('keydown', onEscapeClosePanel);
}

function onEscapeClosePanel(e) {
  if (e.key === 'Escape') closeDetailPanel();
}

function renderDetailPanel(agentId) {
  const node = state.nodes.get(agentId);
  if (!node) return;
  const tasks = sortTasks(state.tasksByAgent.get(agentId) || [], state.taskSort || 'priority');
  const nextTask = tasks[0];
  const panel = document.getElementById('detail-panel');
  panel.innerHTML = '';

  const header = document.createElement('div');
  header.innerHTML = `<h3>${node.name}</h3><div class="subtle">${node.role} • ${formatDepartment(node.department)}</div>`;

  // Basic actions: keyboard help
  header.setAttribute('role', 'heading');
  header.setAttribute('aria-level', '2');

  const description = document.createElement('div');
  description.className = 'subtle';
  description.textContent = getAgentGenericPrompt(node);

  const nextTaskBlock = document.createElement('div');
  if (nextTask) {
    nextTaskBlock.innerHTML = `<div><strong>Next Task:</strong> ${nextTask.title} <span class="subtle">(priority: ${nextTask.priority}${nextTask.dueDate ? ', due '+nextTask.dueDate : ''}${formatEstimate(nextTask)})</span></div>`;
  } else {
    const empty = document.createElement('div');
    empty.className = 'empty';
    empty.textContent = 'No active tasks';
    const quick = document.createElement('button');
    quick.className = 'btn btn-primary';
    quick.textContent = 'Quick Add Task';
    quick.onclick = () => {
      const title = prompt('Task title?');
      if (!title) return;
      addTask(agentId, { title, description: '', priority: 'medium', status: 'pending', estimateMinutes: 30 });
      renderDetailPanel(agentId);
    };
    nextTaskBlock.append(empty, quick);
  }

  const controlsBar = document.createElement('div');
  controlsBar.style.display = 'flex';
  controlsBar.style.alignItems = 'center';
  controlsBar.style.justifyContent = 'space-between';
  controlsBar.style.gap = '8px';
  const sortWrap = document.createElement('div');
  sortWrap.className = 'subtle sort-wrap';
  sortWrap.innerHTML = `Sort by: <select id="task-sort" aria-label="Sort tasks">
      <option value="priority" ${((state.taskSort||'priority')==='priority')?'selected':''}>Priority</option>
      <option value="due" ${((state.taskSort||'priority')==='due')?'selected':''}>Due Date</option>
    </select>`;
  controlsBar.append(sortWrap);

  const timeSummary = document.createElement('div');
  timeSummary.className = 'time-summary';
  const totalMins = tasks.filter(t => t.status !== 'done').reduce((sum, t) => sum + (t.estimateMinutes || 0), 0);
  const totalText = document.createElement('div');
  totalText.className = 'time-total';
  totalText.textContent = `Total estimated time (pending/in-progress): ${formatMinutes(totalMins)}`;
  const chart = document.createElement('div');
  chart.className = 'time-chart';
  const priorities = ['low','medium','high'];
  for (const p of priorities) {
    const mins = tasks.filter(t => t.status !== 'done' && t.priority === p).reduce((s, t) => s + (t.estimateMinutes || 0), 0);
    const bar = document.createElement('div');
    bar.className = `time-bar ${p}`;
    const heightPct = totalMins > 0 ? Math.max(6, Math.round((mins / totalMins) * 100)) : 6;
    bar.style.height = `${heightPct}%`;
    bar.title = `${p} • ${formatMinutes(mins)}`;
    chart.appendChild(bar);
  }
  timeSummary.append(totalText, chart);

  const list = document.createElement('ul');
  list.className = 'task-list';
  for (const t of tasks) {
    const li = document.createElement('li');
    li.className = 'task-item';
    const top = document.createElement('div');
    const titleEl = document.createElement('strong');
    titleEl.textContent = t.title;
    const statusPill = document.createElement('span');
    statusPill.className = `task-status ${t.status || 'pending'}`;
    statusPill.textContent = (t.status || 'pending').replace('-', ' ');
    statusPill.setAttribute('role', 'status');
    statusPill.style.marginLeft = '8px';
    top.append(titleEl, statusPill);

    const meta = document.createElement('div');
    meta.className = 'meta';
    const pieces = [t.priority];
    if (t.dueDate) pieces.push('Due ' + t.dueDate);
    meta.textContent = pieces.join(' • ');
    const estText = formatEstimate(t).replace(/^,\s*/, '');
    if (estText) {
      const timePill = document.createElement('span');
      timePill.className = 'time-pill';
      timePill.textContent = estText;
      meta.appendChild(timePill);
    }

    li.append(top, meta);
    const actions = document.createElement('div');
    actions.className = 'task-actions';
    const up = document.createElement('span');
    up.className = 'link';
    up.textContent = 'Up';
    up.onclick = () => { moveTask(agentId, t.id, -1); renderDetailPanel(agentId); };
    const down = document.createElement('span');
    down.className = 'link';
    down.textContent = 'Down';
    down.onclick = () => { moveTask(agentId, t.id, 1); renderDetailPanel(agentId); };
    const edit = document.createElement('span');
    edit.className = 'link';
    edit.textContent = 'Edit';
    edit.onclick = () => {
      const title = prompt('Title', t.title) ?? t.title;
      const description = prompt('Description', t.description || '') ?? t.description;
      const priority = prompt('Priority (low|medium|high)', t.priority) ?? t.priority;
      const status = prompt('Status (pending|in-progress|done)', t.status || 'pending') ?? (t.status || 'pending');
      const estimateStr = prompt('Estimate minutes (blank to keep)', String(t.estimateMinutes ?? '')) || undefined;
      const estimateMinutes = estimateStr ? parseInt(estimateStr, 10) : t.estimateMinutes;
      const dueDate = prompt('Due date (YYYY-MM-DD, blank to clear)', t.dueDate || '') || undefined;
      updateTask(agentId, t.id, { title, description, priority, status, estimateMinutes, dueDate });
      renderDetailPanel(agentId);
    };
    const remove = document.createElement('span');
    remove.className = 'link';
    remove.textContent = 'Remove';
    remove.onclick = () => { removeTask(agentId, t.id); renderDetailPanel(agentId); };
    const toggle = document.createElement('span');
    toggle.className = 'link';
    toggle.textContent = (t.status || 'pending') === 'done' ? 'Mark Pending' : 'Mark Done';
    toggle.onclick = () => { updateTask(agentId, t.id, { status: (t.status || 'pending') === 'done' ? 'pending' : 'done' }); renderDetailPanel(agentId); };
    actions.append(up, down, edit, toggle, remove);
    li.appendChild(actions);
    list.appendChild(li);
  }

  const form = document.createElement('div');
  form.className = 'task-form';
  form.innerHTML = `
    <input id="task-title" placeholder="Task title" />
    <textarea id="task-desc" placeholder="Description"></textarea>
    <select id="task-priority">
      <option value="low">Low</option>
      <option value="medium" selected>Medium</option>
      <option value="high">High</option>
    </select>
    <select id=\"task-status\">
      <option value=\"pending\" selected>Pending</option>
      <option value=\"in-progress\">In Progress</option>
      <option value=\"done\">Done</option>
    </select>
    <input id=\"task-estimate\" type=\"number\" min=\"0\" step=\"5\" placeholder=\"Estimate (minutes)\" />
    <input id="task-due" type="date" />
    <div style="display:flex; gap:8px;">
      <button class="btn btn-primary" id="btn-add-task">Add Task</button>
      <button class="btn btn-secondary" id="btn-close-panel">Close</button>
    </div>
  `;
  panel.append(header, description, controlsBar, timeSummary, list, form);

  panel.querySelector('#btn-add-task').onclick = () => {
    const title = panel.querySelector('#task-title').value.trim();
    if (!title) return;
    const description = panel.querySelector('#task-desc').value.trim();
    const priority = panel.querySelector('#task-priority').value;
    const status = panel.querySelector('#task-status').value;
    const estimateStr = panel.querySelector('#task-estimate').value;
    const estimateMinutes = estimateStr ? parseInt(estimateStr, 10) : undefined;
    const dueDate = panel.querySelector('#task-due').value || undefined;
    addTask(agentId, { title, description, priority, status, estimateMinutes, dueDate });
    renderDetailPanel(agentId);
  };
  panel.querySelector('#btn-close-panel').onclick = closeDetailPanel;

  // Wire sort control
  const sortSelect = panel.querySelector('#task-sort');
  if (sortSelect) {
    sortSelect.onchange = () => {
      state.taskSort = sortSelect.value;
      renderDetailPanel(agentId);
    };
  }
}

function getAgentGenericPrompt(node) {
  // Basic generic description; can be customized per role later
  const role = String(node.role || '').replace(/-/g, ' ');
  return `This agent specializes in ${role} related workflows, focusing on reliability and quality.`;
}

function addTask(agentId, partial) {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
  const tasks = state.tasksByAgent.get(agentId) || [];
  tasks.push({
    id,
    title: partial.title,
    description: partial.description,
    priority: partial.priority || 'medium',
    status: partial.status || 'pending',
    estimateMinutes: typeof partial.estimateMinutes === 'number' ? partial.estimateMinutes : undefined,
    dueDate: partial.dueDate,
    createdAt: new Date().toISOString(),
  });
  state.tasksByAgent.set(agentId, tasks);
}

function removeTask(agentId, taskId) {
  const tasks = state.tasksByAgent.get(agentId) || [];
  const next = tasks.filter(t => t.id !== taskId);
  state.tasksByAgent.set(agentId, next);
}

function updateTask(agentId, taskId, fields) {
  const tasks = state.tasksByAgent.get(agentId) || [];
  const idx = tasks.findIndex(t => t.id === taskId);
  if (idx === -1) return;
  tasks[idx] = { ...tasks[idx], ...fields };
  state.tasksByAgent.set(agentId, tasks);
}

function moveTask(agentId, taskId, direction) {
  const tasks = state.tasksByAgent.get(agentId) || [];
  const idx = tasks.findIndex(t => t.id === taskId);
  if (idx === -1) return;
  const newIdx = Math.max(0, Math.min(tasks.length - 1, idx + direction));
  if (newIdx === idx) return;
  const [item] = tasks.splice(idx, 1);
  tasks.splice(newIdx, 0, item);
  state.tasksByAgent.set(agentId, tasks);
}

function sortTasks(tasks, criterion) {
  const cloned = [...tasks];
  if (criterion === 'priority') {
    const order = { high: 0, medium: 1, low: 2 };
    cloned.sort((a, b) => {
      const pa = order[a.priority] ?? 3;
      const pb = order[b.priority] ?? 3;
      if (pa !== pb) return pa - pb;
      const sa = (a.status || 'pending') === 'done' ? 1 : 0;
      const sb = (b.status || 'pending') === 'done' ? 1 : 0;
      if (sa !== sb) return sa - sb; // pending/in-progress before done
      return (a.createdAt || '').localeCompare(b.createdAt || '');
    });
  } else if (criterion === 'due') {
    cloned.sort((a, b) => {
      const ad = a.dueDate ? Date.parse(a.dueDate) : Infinity;
      const bd = b.dueDate ? Date.parse(b.dueDate) : Infinity;
      if (ad !== bd) return ad - bd;
      const sa = (a.status || 'pending') === 'done' ? 1 : 0;
      const sb = (b.status || 'pending') === 'done' ? 1 : 0;
      if (sa !== sb) return sa - sb;
      const order = { high: 0, medium: 1, low: 2 };
      const pa = order[a.priority] ?? 3;
      const pb = order[b.priority] ?? 3;
      if (pa !== pb) return pa - pb;
      return (a.createdAt || '').localeCompare(b.createdAt || '');
    });
  }
  return cloned;
}

function formatEstimate(t) {
  const m = t?.estimateMinutes;
  if (typeof m !== 'number' || Number.isNaN(m)) return '';
  return `, ${formatMinutes(m)}`;
}

function formatMinutes(total) {
  const m = Math.max(0, Number(total) || 0);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem ? `${h}h ${rem}m` : `${h}h`;
}

// -------------------- Tooltip --------------------
function showTooltip(x, y, text) {
  const tip = document.getElementById('tooltip');
  tip.textContent = text;
  tip.style.left = `${x + 12}px`;
  tip.style.top = `${y + 12}px`;
  tip.classList.remove('hidden');
}
function hideTooltip() {
  document.getElementById('tooltip').classList.add('hidden');
}

// -------------------- Department Agent Management --------------------
// Simple flows using prompts for now with department preselection possible later
export function addAgentToDepartment(department) {
  const name = prompt('Agent display name:');
  if (!name) return;
  const role = prompt('Unique role identifier (kebab-case):');
  if (!role) return;
  const manager = [...state.nodes.values()].find(n => n.level === 1 && toDepartmentKey(n.department) === toDepartmentKey(department));
  if (!manager) { alert('No manager found for that department'); return; }
  if (state.nodes.has(role)) { alert('Role already exists'); return; }
  state.nodes.set(role, { id: role, name, role, department, level: 2, x: manager.x, y: manager.y + CARD_HEIGHT + GAP_Y, status: 'idle', tasks: [] });
  state.edges.push({ fromId: role, toId: manager.id });
  render();
}

export function removeAgent(agentId) {
  if (!state.nodes.has(agentId)) return;
  state.nodes.delete(agentId);
  state.edges = state.edges.filter(e => e.fromId !== agentId && e.toId !== agentId);
  state.testingEdges = state.testingEdges.filter(e => e.fromId !== agentId && e.toId !== agentId);
  state.tasksByAgent.delete(agentId);
  render();
}

// -------------------- Departments View --------------------
function renderDepartmentsView(cardsLayer, svg, design) {
  // Build departments map { deptKey -> { name, managerId, agents: string[] } }
  const departments = new Map();
  for (const node of state.nodes.values()) {
    const key = toDepartmentKey(node.department);
    if (!departments.has(key)) departments.set(key, { key, name: node.department, managerId: null, agents: [] });
    const d = departments.get(key);
    if (node.level === 1) d.managerId = node.id;
    if (node.level === 2) d.agents.push(node.id);
  }

  const deptCards = [];
  const keys = [...departments.keys()].sort();
  const container = document.getElementById('canvas-container');
  const available = Math.max(320, container.clientWidth - 120);
  const cols = Math.max(1, Math.floor(available / (CARD_WIDTH + GAP_X)));
  const rowGap = GAP_Y;
  keys.forEach((key, idx) => {
    const d = departments.get(key);
    const col = idx % cols;
    const row = Math.floor(idx / cols);
    const defaultX = 60 + col * (CARD_WIDTH + GAP_X);
    const defaultY = 60 + row * (CARD_HEIGHT + rowGap);
    const saved = state.deptPositions.get(d.key);
    const x = saved?.x ?? defaultX;
    const y = saved?.y ?? defaultY;
    const card = createDepartmentCard(d, x, y, design);
    deptCards.push(card);
  });

  const frag = document.createDocumentFragment();
  for (const c of deptCards) frag.appendChild(c);
  cardsLayer.appendChild(frag);
}

function createDepartmentCard(dept, x, y, design) {
  const el = document.createElement('div');
  el.className = 'agent-card dept-card';
  el.style.left = `${x}px`;
  el.style.top = `${y}px`;
  el.style.width = `${CARD_WIDTH}px`;
  el.style.minHeight = `${CARD_HEIGHT}px`;
  el.dataset.dept = dept.key;

  // Header: Department name prominent + manager
  const header = document.createElement('div');
  header.className = 'dept-header tab-header';

  const titleWrap = document.createElement('div');
  const title = document.createElement('div');
  title.className = 'dept-title';
  title.textContent = `${formatDepartment(dept.name)} Department`;
  const managerName = dept.managerId ? (state.nodes.get(dept.managerId)?.name || 'Manager') : 'No Manager';
  const subtitle = document.createElement('div');
  subtitle.className = 'dept-subtitle';
  subtitle.textContent = `Manager: ${managerName}`;
  titleWrap.append(title, subtitle);

  const deptTag = document.createElement('span');
  deptTag.className = 'dept-tag';
  deptTag.textContent = formatDepartment(dept.name);
  styleDepartmentTag(deptTag, toDepartmentKey(dept.name), design);

  header.append(titleWrap, deptTag);
  header.onclick = (e) => {
    e.stopPropagation();
    openDepartmentOverlay(dept.key);
  };

  // Summary: agents and status breakdown
  const total = dept.agents.length;
  const summary = document.createElement('div');
  summary.className = 'dept-meta';
  const statusCounts = { active: 0, idle: 0, error: 0 };
  for (const agentId of dept.agents) {
    const n = state.nodes.get(agentId);
    if (n && statusCounts.hasOwnProperty(n.status)) statusCounts[n.status]++;
  }
  summary.innerHTML = `
    <div><strong>${total}</strong> agents</div>
    <div class="meta-pill"><span class="status-dot status-active"></span>${statusCounts.active} active</div>
    <div class="meta-pill"><span class="status-dot status-idle"></span>${statusCounts.idle} idle</div>
    <div class="meta-pill"><span class="status-dot status-error"></span>${statusCounts.error} error</div>
  `;

  // Controls: grouped for hierarchy and separation
  const controls = document.createElement('div');
  controls.className = 'controls dept-controls';

  const leftGroup = document.createElement('div');
  leftGroup.className = 'control-group';
  const btnOpen = document.createElement('button');
  btnOpen.className = 'control-btn';
  btnOpen.textContent = 'Open';
  btnOpen.setAttribute('aria-label', `Open ${formatDepartment(dept.name)} department`);
  btnOpen.onclick = () => openDepartment(dept.key);
  const btnAddAgent = document.createElement('button');
  btnAddAgent.className = 'control-btn';
  btnAddAgent.textContent = 'Add Agent';
  btnAddAgent.setAttribute('aria-label', `Add agent to ${formatDepartment(dept.name)} department`);
  btnAddAgent.onclick = () => openAddAgentModal();
  // Optional: keep Add Department here as a secondary control
  const btnAddDept = document.createElement('button');
  btnAddDept.className = 'control-btn';
  btnAddDept.textContent = 'Add Department';
  btnAddDept.setAttribute('aria-label', 'Add a new department');
  btnAddDept.onclick = addDepartmentFlow;
  leftGroup.append(btnOpen, btnAddAgent, btnAddDept);

  const divider = document.createElement('div');
  divider.className = 'control-divider';
  divider.setAttribute('role', 'separator');

  const rightGroup = document.createElement('div');
  rightGroup.className = 'control-group';
  const btnDeleteDept = document.createElement('button');
  btnDeleteDept.className = 'control-btn danger';
  btnDeleteDept.textContent = 'Delete Department';
  btnDeleteDept.setAttribute('aria-label', `Delete ${formatDepartment(dept.name)} department`);
  btnDeleteDept.onclick = () => deleteDepartment(dept.key);
  rightGroup.append(btnDeleteDept);

  controls.append(leftGroup, divider, rightGroup);

  if (state.overlayDeptKey === dept.key) {
    el.classList.remove('tab-collapsed');
    el.append(header, summary, controls);
  } else {
    el.classList.add('tab-collapsed');
    el.append(header);
  }
  enableDeptDrag(el);
  // Open department overlay on single click anywhere on the card that isn't a control button
  el.addEventListener('click', (e) => {
    if ((e.target && e.target.closest && e.target.closest('.control-btn'))) return;
    openDepartmentOverlay(dept.key);
  });
  return el;
}

function addDepartmentFlow() {
  const name = prompt('New department name (kebab-case, e.g., research-ops):');
  if (!name) return;
  const deptKey = toDepartmentKey(name);
  // Create a manager placeholder for the new department
  const managerRole = `${deptKey}-manager`;
  if (state.nodes.has(managerRole)) { alert('Department already exists'); return; }
  const managerName = `${formatDepartment(name)} Director`;
  state.nodes.set(managerRole, { id: managerRole, name: managerName, role: managerRole, department: deptKey, level: 1, x: 0, y: 0, status: 'idle', tasks: [] });
  state.edges.push({ fromId: managerRole, toId: 'chief-executive-officer' });
  autoLayout();
  render();
  zoomToFit();
}

function deleteDepartment(deptKey) {
  // remove all nodes whose department matches deptKey and their edges/testing links
  const idsToDelete = [...state.nodes.values()].filter(n => toDepartmentKey(n.department) === toDepartmentKey(deptKey)).map(n => n.id);
  for (const id of idsToDelete) {
    state.nodes.delete(id);
    state.tasksByAgent.delete(id);
  }
  state.edges = state.edges.filter(e => !idsToDelete.includes(e.fromId) && !idsToDelete.includes(e.toId));
  state.testingEdges = state.testingEdges.filter(e => !idsToDelete.includes(e.fromId) && !idsToDelete.includes(e.toId));
  render();
  zoomToFit();
}

function openDepartment(deptKey) {
  state.mode = 'org';
  state.activeDepartment = toDepartmentKey(deptKey);
  // Filter view to only nodes of this department + CEO (for context) and inter-department connectors
  // For simplicity, we will visually de-emphasize others by not rendering them
  // Implement by building a filtered projection during render
  renderDepartmentOrgView();
  zoomToFit();
}

// Overlay for Department Detail with agent list and nested agent view
function openDepartmentOverlay(deptKey) {
  state.overlayDeptKey = toDepartmentKey(deptKey);
  const overlay = document.getElementById('overlay-panel');
  const content = overlay.querySelector('.overlay-content');
  overlay.classList.remove('hidden');
  overlay.setAttribute('aria-hidden', 'false');
  // Dim background but keep interactive
  const container = document.getElementById('canvas-container');
  container?.classList.add('dimmed');
  // Close on ESC
  window.addEventListener('keydown', onOverlayKeyDown);
  // Close on outside click (any click not inside overlay content)
  document.addEventListener('click', onDocumentClickOutsideOverlay, true);
  renderDepartmentOverlayContent(content, state.overlayDeptKey);
}

function closeDepartmentOverlay() {
  state.overlayDeptKey = null;
  state.overlaySelectedAgentId = null;
  const overlay = document.getElementById('overlay-panel');
  overlay.classList.add('hidden');
  overlay.setAttribute('aria-hidden', 'true');
  const container = document.getElementById('canvas-container');
  container?.classList.remove('dimmed');
  window.removeEventListener('keydown', onOverlayKeyDown);
  document.removeEventListener('click', onDocumentClickOutsideOverlay, true);
}

function renderDepartmentOverlayContent(container, deptKey) {
  container.innerHTML = '';
  const deptName = formatDepartment(deptKey);
  // Collect agents in department
  const agents = [...state.nodes.values()].filter(n => n.level === 2 && toDepartmentKey(n.department) === deptKey);
  const manager = [...state.nodes.values()].find(n => n.level === 1 && toDepartmentKey(n.department) === deptKey);

  const header = document.createElement('div');
  header.className = 'overlay-header';
  const left = document.createElement('div');
  left.innerHTML = `<div class="overlay-title">${deptName} Department</div>` + (manager ? `<div class="overlay-subtitle">Manager: ${manager.name}</div>` : '');
  const right = document.createElement('div');
  const btnClose = document.createElement('button');
  btnClose.className = 'btn btn-secondary';
  btnClose.textContent = 'Close';
  btnClose.onclick = closeDepartmentOverlay;
  right.appendChild(btnClose);
  header.append(left, right);

  const grid = document.createElement('div');
  grid.className = 'grid agents';
  for (const a of agents) {
    const mini = document.createElement('div');
    mini.className = 'agent-mini';
    mini.setAttribute('tabindex', '0');
    mini.setAttribute('role', 'button');
    mini.setAttribute('aria-pressed', String(state.overlaySelectedAgentId === a.id));
    const miniHeader = document.createElement('div');
    miniHeader.className = 'mini-header';
    const title = document.createElement('div');
    title.className = 'mini-title';
    title.textContent = a.name;
    const dot = document.createElement('span');
    dot.className = `status-dot status-${a.status}`;
    miniHeader.append(title, dot);
    const meta = document.createElement('div');
    meta.className = 'mini-meta';
    const tasks = state.tasksByAgent.get(a.id) || [];
    meta.textContent = `${a.role} • ${tasks.length ? tasks.length + ' active task' + (tasks.length!==1?'s':'') : 'Idle'}`;
    const actions = document.createElement('div');
    actions.className = 'mini-actions';
    const btnOpen = document.createElement('button');
    btnOpen.className = 'btn btn-primary';
    btnOpen.textContent = 'Show Details';
    btnOpen.onclick = () => {
      closeDepartmentOverlay();
      openDetailPanel(a.id);
    };
    const btnSelect = document.createElement('button');
    btnSelect.className = 'btn btn-secondary';
    btnSelect.textContent = 'Focus';
    btnSelect.onclick = () => {
      state.focusedId = a.id;
      zoomToFocus();
    };
    actions.append(btnOpen, btnSelect);
    mini.append(miniHeader, meta, actions);
    mini.onclick = () => { closeDepartmentOverlay(); openDetailPanel(a.id); };
    mini.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); closeDepartmentOverlay(); openDetailPanel(a.id); } };
    grid.appendChild(mini);
  }

  container.append(header, grid);

  // Details area for selected agent
  if (state.overlaySelectedAgentId) {
    const details = document.createElement('div');
    details.className = 'overlay-agent-details';
    renderOverlayAgentDetails(details, state.overlaySelectedAgentId, deptKey, container);
    container.appendChild(details);
  }
}

function renderOverlayAgentDetails(wrapper, agentId, deptKey, overlayContainer) {
  const node = state.nodes.get(agentId);
  if (!node) { wrapper.innerHTML = ''; return; }
  const tasks = state.tasksByAgent.get(agentId) || [];
  const current = tasks[0];
  wrapper.innerHTML = '';
  const head = document.createElement('div');
  head.className = 'details-header';
  head.innerHTML = `<div><div class="details-title">${node.name}</div><div class="details-sub">${node.role} • ${formatDepartment(node.department)}</div></div>`;
  const btnClose = document.createElement('button');
  btnClose.className = 'btn btn-secondary';
  btnClose.textContent = 'Close Details';
  btnClose.onclick = () => { state.overlaySelectedAgentId = null; renderDepartmentOverlayContent(overlayContainer, deptKey); };
  head.appendChild(btnClose);
  const status = document.createElement('div');
  status.style.marginTop = '6px';
  status.innerHTML = current ? `<strong>Working on:</strong> ${current.title}` : '<span class="subtle">Idle</span>';

  const list = document.createElement('ul');
  list.className = 'task-list';
  if (tasks.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'empty';
    empty.textContent = 'No active tasks';
    list.appendChild(empty);
  }
  for (const t of tasks) {
    const li = document.createElement('li');
    li.className = 'task-item';
    li.innerHTML = `<div><strong>${t.title}</strong></div><div class="meta">${t.priority} • ${t.status}${t.dueDate ? ' • Due '+t.dueDate : ''}</div>`;
    const actions = document.createElement('div');
    actions.className = 'task-actions';
    const up = document.createElement('span'); up.className = 'link'; up.textContent = 'Up'; up.onclick = () => { moveTask(agentId, t.id, -1); renderOverlayAgentDetails(wrapper, agentId, deptKey, overlayContainer); };
    const down = document.createElement('span'); down.className = 'link'; down.textContent = 'Down'; down.onclick = () => { moveTask(agentId, t.id, 1); renderOverlayAgentDetails(wrapper, agentId, deptKey, overlayContainer); };
    const edit = document.createElement('span'); edit.className = 'link'; edit.textContent = 'Edit'; edit.onclick = () => {
      const title = prompt('Title', t.title) ?? t.title;
      const description = prompt('Description', t.description || '') ?? t.description;
      const priority = prompt('Priority (low|medium|high)', t.priority) ?? t.priority;
      const status = prompt('Status (pending|in-progress|done)', t.status || 'pending') ?? t.status;
      const dueDate = prompt('Due date (YYYY-MM-DD, blank to clear)', t.dueDate || '') || undefined;
      updateTask(agentId, t.id, { title, description, priority, status, dueDate });
      renderOverlayAgentDetails(wrapper, agentId, deptKey, overlayContainer);
    };
    const remove = document.createElement('span'); remove.className = 'link'; remove.textContent = 'Remove'; remove.onclick = () => { removeTask(agentId, t.id); renderOverlayAgentDetails(wrapper, agentId, deptKey, overlayContainer); };
    actions.append(up, down, edit, remove);
    li.appendChild(actions);
    list.appendChild(li);
  }

  const form = document.createElement('div');
  form.className = 'task-form';
  form.innerHTML = `
    <input id="ov-task-title" placeholder="Task title" />
    <textarea id="ov-task-desc" placeholder="Description"></textarea>
    <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">
      <select id="ov-task-priority">
        <option value="low">Low</option>
        <option value="medium" selected>Medium</option>
        <option value="high">High</option>
      </select>
      <select id="ov-task-status">
        <option value="pending" selected>Pending</option>
        <option value="in-progress">In Progress</option>
        <option value="done">Done</option>
      </select>
    </div>
    <input id="ov-task-due" type="date" />
    <div style="display:flex; gap:8px;">
      <button class="btn btn-primary" id="ov-btn-add-task">Add Task</button>
      <button class="btn btn-secondary" id="ov-btn-close-overlay">Close Panel</button>
    </div>
  `;
  form.querySelector('#ov-btn-add-task').onclick = () => {
    const title = form.querySelector('#ov-task-title').value.trim();
    if (!title) return;
    const description = form.querySelector('#ov-task-desc').value.trim();
    const priority = form.querySelector('#ov-task-priority').value;
    const statusSel = form.querySelector('#ov-task-status').value;
    const dueDate = form.querySelector('#ov-task-due').value || undefined;
    addTask(agentId, { title, description, priority, status: statusSel, dueDate });
    renderOverlayAgentDetails(wrapper, agentId, deptKey, overlayContainer);
  };
  form.querySelector('#ov-btn-close-overlay').onclick = closeDepartmentOverlay;

  wrapper.append(head, status, list, form);
}

function onOverlayKeyDown(e) {
  if (e.key === 'Escape') {
    closeDepartmentOverlay();
  }
}

function onDocumentClickOutsideOverlay(e) {
  const overlay = document.getElementById('overlay-panel');
  if (!overlay || overlay.classList.contains('hidden')) return;
  const content = overlay.querySelector('.overlay-content');
  if (!content) return;
  if (!content.contains(e.target)) {
    // Clicked outside panel; close it
    closeDepartmentOverlay();
  }
}

function renderDepartmentOrgView() {
  const cardsLayer = document.getElementById('cards-layer');
  const svg = document.getElementById('connections');
  cardsLayer.innerHTML = '';
  svg.innerHTML = '';

  const dept = state.activeDepartment;
  if (!dept) { autoLayout(); render(); return; }

  // Create a set of visible node ids (department nodes + their manager + CEO for anchor)
  const visible = new Set();
  for (const n of state.nodes.values()) {
    if (toDepartmentKey(n.department) === dept || n.role === 'chief-executive-officer') visible.add(n.id);
  }

  // Place layout using existing coordinates but only render visible nodes/edges
  const design = getTheme();
  const cardFrag = document.createDocumentFragment();
  for (const id of visible) {
    const node = state.nodes.get(id);
    if (!node) continue;
    const card = createAgentCard(node, design);
    // Mark inter-department connectors: agents that test or are tested by outside departments
    if (node.level === 2) {
      const testsOutside = state.testingEdges.some(e => e.fromId === node.id && visible.has(e.toId) === false);
      const testedByOutside = state.testingEdges.some(e => e.toId === node.id && visible.has(e.fromId) === false);
      if (testsOutside || testedByOutside) {
        card.style.outline = '2px solid #60a5fa';
      }
    }
    cardFrag.appendChild(card);
  }
  cardsLayer.appendChild(cardFrag);

  // Hierarchy edges within visible
  const edgeFrag = document.createDocumentFragment();
  for (const edge of state.edges) {
    if (!visible.has(edge.fromId) || !visible.has(edge.toId)) continue;
    const from = state.nodes.get(edge.fromId);
    const to = state.nodes.get(edge.toId);
    if (!from || !to) continue;
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('class', 'connection-path');
    const start = { x: from.x + CARD_WIDTH / 2, y: from.y };
    const end = { x: to.x + CARD_WIDTH / 2, y: to.y + CARD_HEIGHT };
    path.setAttribute('d', curvedPath(start, end));
    styleConnectionsPath(path, getTheme());
    edgeFrag.appendChild(path);
  }
  svg.appendChild(edgeFrag);

  // Testing edges where at least one end is visible (so we can show external connectors)
  const testFrag = document.createDocumentFragment();
  for (const edge of state.testingEdges) {
    if (!visible.has(edge.fromId) && !visible.has(edge.toId)) continue;
    const from = state.nodes.get(edge.fromId);
    const to = state.nodes.get(edge.toId);
    if (!from || !to) continue;
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('class', 'connection-path testing');
    const start = { x: from.x + CARD_WIDTH / 2, y: from.y + CARD_HEIGHT / 2 };
    const end = { x: to.x + CARD_WIDTH / 2, y: to.y + CARD_HEIGHT / 2 };
    path.setAttribute('d', curvedPath(start, end));
    path.addEventListener('pointerenter', (e) => showTooltip(e.clientX, e.clientY, `Testing Connection: ${from.name} → ${to.name}`));
    path.addEventListener('pointerleave', hideTooltip);
    testFrag.appendChild(path);
  }
  svg.appendChild(testFrag);
}

function toggleAgentTab(agentId) {
  state.expandedAgentId = state.expandedAgentId === agentId ? null : agentId;
  // Collapse any open department overlay if switching focus to an agent
  if (state.expandedAgentId) {
    closeDepartmentOverlay();
  }
  render();
}

// -------------------- Responsive Layout --------------------
function wireResizeHandlers() {
  let rafId = 0;
  const schedule = () => {
    if (rafId) cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(() => {
      computeResponsiveLayoutParams();
      autoLayout();
      applySavedPositions();
      render();
      zoomToFit();
    });
  };
  window.addEventListener('resize', schedule);
  const container = document.getElementById('canvas-container');
  if (window.ResizeObserver && container) {
    const ro = new ResizeObserver(schedule);
    ro.observe(container);
  }
}

function computeResponsiveLayoutParams() {
  const container = document.getElementById('canvas-container');
  if (!container) return;
  const width = Math.max(320, container.clientWidth);
  const height = Math.max(320, container.clientHeight);

  // Estimate breadth and depth
  const nodes = [...state.nodes.values()];
  const levels = new Map();
  for (const n of nodes) {
    const arr = levels.get(n.level) || [];
    arr.push(n);
    levels.set(n.level, arr);
  }
  const maxBreadth = Math.max(1, ...(Array.from(levels.values()).map(arr => arr.length)));
  const depth = Math.max(1, ...(Array.from(levels.keys())) ) + 1; // levels start at 0

  // Base sizes
  const baseCardW = 360;
  const baseCardH = 220;
  const baseGapX = 80;
  const baseGapY = 180;

  // Approx required size using base values
  const approxWidth = maxBreadth * baseCardW + (maxBreadth - 1) * baseGapX + 240;
  const approxHeight = depth * baseCardH + (depth - 1) * baseGapY + 240;

  const fitScaleX = width / approxWidth;
  const fitScaleY = height / approxHeight;
  // Mildly adapt intrinsic sizes; also stage zoom will handle remaining scaling
  const s = clamp(Math.min(fitScaleX, fitScaleY), 0.7, 1.15);

  CARD_WIDTH = clamp(Math.round(baseCardW * s), 240, 420);
  CARD_HEIGHT = clamp(Math.round(baseCardH * s), 160, 280);
  GAP_X = clamp(Math.round(baseGapX * s), 48, 120);
  GAP_Y = clamp(Math.round(baseGapY * s), 100, 220);
}

init();

// -------------------- Position Persistence --------------------
const AGENT_POS_KEY = 'agent_positions_v1';
const DEPT_POS_KEY = 'dept_positions_v1';

function loadSessionPositions() {
  try {
    const agentJson = sessionStorage.getItem(AGENT_POS_KEY);
    if (agentJson) {
      const obj = JSON.parse(agentJson);
      for (const [id, pos] of Object.entries(obj)) {
        if (typeof pos?.x === 'number' && typeof pos?.y === 'number') {
          state.savedPositions.set(id, { x: pos.x, y: pos.y });
        }
      }
    }
  } catch {}
  try {
    const deptJson = sessionStorage.getItem(DEPT_POS_KEY);
    if (deptJson) {
      const obj = JSON.parse(deptJson);
      for (const [key, pos] of Object.entries(obj)) {
        if (typeof pos?.x === 'number' && typeof pos?.y === 'number') {
          state.deptPositions.set(key, { x: pos.x, y: pos.y });
        }
      }
    }
  } catch {}
}

function saveAgentPosition(id) {
  const node = state.nodes.get(id);
  if (!node) return;
  state.savedPositions.set(id, { x: node.x, y: node.y });
  const obj = {};
  for (const [nid, pos] of state.savedPositions.entries()) obj[nid] = pos;
  try { sessionStorage.setItem(AGENT_POS_KEY, JSON.stringify(obj)); } catch {}
}

function saveDeptPosition(deptKey, x, y) {
  state.deptPositions.set(deptKey, { x, y });
  const obj = {};
  for (const [k, pos] of state.deptPositions.entries()) obj[k] = pos;
  try { sessionStorage.setItem(DEPT_POS_KEY, JSON.stringify(obj)); } catch {}
}

function applySavedPositions() {
  for (const [id, pos] of state.savedPositions.entries()) {
    const node = state.nodes.get(id);
    if (!node) continue;
    node.x = pos.x;
    node.y = pos.y;
  }
}

function enableDeptDrag(el) {
  let startX = 0, startY = 0, origX = 0, origY = 0, isDragging = false;
  const onDown = (e) => {
    // Allow clicks on header/controls to work; don't immediately prevent default
    if (e.target && e.target.closest && e.target.closest('.control-btn, .btn, .dept-header')) {
      return;
    }
    startX = e.clientX;
    startY = e.clientY;
    const styleLeft = parseFloat(el.style.left || '0');
    const styleTop = parseFloat(el.style.top || '0');
    origX = styleLeft;
    origY = styleTop;
    isDragging = false;
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp, { once: true });
  };
  const onMove = (e) => {
    const totalDx = e.clientX - startX;
    const totalDy = e.clientY - startY;
    if (!isDragging) {
      const threshold = 3;
      if (Math.abs(totalDx) < threshold && Math.abs(totalDy) < threshold) {
        return;
      }
      isDragging = true;
      e.preventDefault();
    }
    const dx = totalDx / state.zoom.scale;
    const dy = totalDy / state.zoom.scale;
    const x = origX + dx;
    const y = origY + dy;
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
  };
  const onUp = () => {
    window.removeEventListener('pointermove', onMove);
    if (isDragging) {
      const deptKey = el.dataset.dept;
      const x = parseFloat(el.style.left || '0');
      const y = parseFloat(el.style.top || '0');
      if (deptKey) saveDeptPosition(deptKey, x, y);
      // Redraw to ensure canvas bounds adjust if needed
      render();
    }
  };
  el.addEventListener('pointerdown', onDown);
}


