import { loadTheme, getTheme, styleDepartmentTag, styleConnectionsPath } from './theme.js';

// Responsive layout parameters (tunable at runtime)
let CARD_WIDTH = 300;
let CARD_HEIGHT = 160;
let GAP_X = 60;
let GAP_Y = 140;

const STATUS_VALUES = ['active', 'idle', 'error'];

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
};

/**
 * @typedef {{ id: string, title: string, description: string, priority: 'low'|'medium'|'high', dueDate?: string, createdAt: string }} Task
 */

async function init() {
  await loadTheme();

  const orgRes = await fetch('/organization_tree.json');
  const org = await orgRes.json();

  buildGraphFromOrganization(org);
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
}

function buildGraphFromOrganization(org) {
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

  for (const dept of org.organization.departments) {
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
    for (const node of state.nodes.values()) {
      const card = createAgentCard(node, design);
      cardsLayer.appendChild(card);
    }

    // Hierarchy edges
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
      svg.appendChild(path);
    }

    // Testing edges with distinct styling and tooltips
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
      svg.appendChild(path);
    }
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
  const dx = (end.x - start.x) * 0.2;
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

  el.append(header, deptTag, metrics, controls);

  if (node.level === 1) {
    const managerControls = document.createElement('div');
    managerControls.className = 'controls';
    const btnAddDeptAgent = document.createElement('button');
    btnAddDeptAgent.className = 'control-btn';
    btnAddDeptAgent.textContent = 'Add Agent to Dept';
    btnAddDeptAgent.onclick = () => addAgentToDepartment(node.department);
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
  el.addEventListener('click', () => openDetailPanel(node.id));
  return el;
}

function setStatus(id, status) {
  const node = state.nodes.get(id);
  if (!node) return;
  node.status = status;
  render();
}

function enableDrag(el) {
  let startX = 0, startY = 0, origX = 0, origY = 0;
  const onDown = (e) => {
    e.preventDefault();
    startX = e.clientX;
    startY = e.clientY;
    const id = el.dataset.id;
    const node = state.nodes.get(id);
    origX = node.x;
    origY = node.y;
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp, { once: true });
  };
  const onMove = (e) => {
    const dx = (e.clientX - startX) / state.zoom.scale;
    const dy = (e.clientY - startY) / state.zoom.scale;
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
    // Persist per-session manual position
    const id = el.dataset.id;
    if (id) saveAgentPosition(id);
    render();
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
  const btnImport = document.getElementById('btn-import');
  const fileImport = document.getElementById('file-import');
  const btnAdd = document.getElementById('btn-add-agent');
  const btnDeptView = document.getElementById('btn-dept-view');
  const btnOrgView = document.getElementById('btn-org-view');

  btnExport.onclick = exportConfiguration;
  btnImport.onclick = () => fileImport.click();
  fileImport.onchange = importConfiguration;
  btnAdd.onclick = addAgentFlow;
  if (btnDeptView) btnDeptView.onclick = () => { state.mode = 'departments'; state.activeDepartment = null; computeResponsiveLayoutParams(); applySavedPositions(); render(); zoomToFit(); };
  if (btnOrgView) btnOrgView.onclick = () => { state.mode = 'org'; state.activeDepartment = null; computeResponsiveLayoutParams(); autoLayout(); applySavedPositions(); render(); zoomToFit(); };
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
  render();
}

function startStatusTicker() {
  setInterval(() => {
    for (const node of state.nodes.values()) {
      // Randomly flip some statuses to simulate activity
      if (Math.random() < 0.08) {
        node.status = STATUS_VALUES[(STATUS_VALUES.indexOf(node.status) + 1) % STATUS_VALUES.length];
      }
    }
    render();
  }, 2000);
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
  panel.classList.remove('hidden');
  panel.setAttribute('aria-hidden', 'false');
  renderDetailPanel(agentId);
}

function closeDetailPanel() {
  const panel = document.getElementById('detail-panel');
  panel.classList.add('hidden');
  panel.setAttribute('aria-hidden', 'true');
}

function renderDetailPanel(agentId) {
  const node = state.nodes.get(agentId);
  if (!node) return;
  const tasks = state.tasksByAgent.get(agentId) || [];
  const nextTask = tasks[0];
  const panel = document.getElementById('detail-panel');
  panel.innerHTML = '';

  const header = document.createElement('div');
  header.innerHTML = `<h3>${node.name}</h3><div class="subtle">${node.role} • ${formatDepartment(node.department)}</div>`;

  const nextTaskBlock = document.createElement('div');
  nextTaskBlock.innerHTML = nextTask
    ? `<div><strong>Next Task:</strong> ${nextTask.title} <span class="subtle">(priority: ${nextTask.priority}${nextTask.dueDate ? ", due "+nextTask.dueDate : ''})</span></div>`
    : `<div class="empty">No active tasks</div>`;

  const list = document.createElement('ul');
  list.className = 'task-list';
  for (const t of tasks) {
    const li = document.createElement('li');
    li.className = 'task-item';
    li.innerHTML = `<div><strong>${t.title}</strong></div><div class="meta">${t.priority}${t.dueDate ? ' • Due '+t.dueDate : ''}</div>`;
    const actions = document.createElement('div');
    actions.className = 'task-actions';
    const remove = document.createElement('span');
    remove.className = 'link';
    remove.textContent = 'Remove';
    remove.onclick = () => { removeTask(agentId, t.id); renderDetailPanel(agentId); };
    actions.appendChild(remove);
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
    <input id="task-due" type="date" />
    <div style="display:flex; gap:8px;">
      <button class="btn btn-primary" id="btn-add-task">Add Task</button>
      <button class="btn btn-secondary" id="btn-close-panel">Close</button>
    </div>
  `;
  panel.append(header, nextTaskBlock, list, form);

  panel.querySelector('#btn-add-task').onclick = () => {
    const title = panel.querySelector('#task-title').value.trim();
    if (!title) return;
    const description = panel.querySelector('#task-desc').value.trim();
    const priority = panel.querySelector('#task-priority').value;
    const dueDate = panel.querySelector('#task-due').value || undefined;
    addTask(agentId, { title, description, priority, dueDate });
    renderDetailPanel(agentId);
  };
  panel.querySelector('#btn-close-panel').onclick = closeDetailPanel;
}

function addTask(agentId, partial) {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
  const tasks = state.tasksByAgent.get(agentId) || [];
  tasks.push({ id, title: partial.title, description: partial.description, priority: partial.priority, dueDate: partial.dueDate, createdAt: new Date().toISOString() });
  state.tasksByAgent.set(agentId, tasks);
}

function removeTask(agentId, taskId) {
  const tasks = state.tasksByAgent.get(agentId) || [];
  const next = tasks.filter(t => t.id !== taskId);
  state.tasksByAgent.set(agentId, next);
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

  for (const c of deptCards) cardsLayer.appendChild(c);
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
  header.className = 'dept-header';

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
  btnAddAgent.onclick = () => addAgentToDepartment(dept.name);
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

  el.append(header, summary, controls);
  enableDeptDrag(el);
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
    cardsLayer.appendChild(card);
  }

  // Hierarchy edges within visible
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
    svg.appendChild(path);
  }

  // Testing edges where at least one end is visible (so we can show external connectors)
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
    svg.appendChild(path);
  }
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
  let startX = 0, startY = 0, origX = 0, origY = 0;
  const onDown = (e) => {
    e.preventDefault();
    startX = e.clientX;
    startY = e.clientY;
    const styleLeft = parseFloat(el.style.left || '0');
    const styleTop = parseFloat(el.style.top || '0');
    origX = styleLeft;
    origY = styleTop;
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp, { once: true });
  };
  const onMove = (e) => {
    const dx = (e.clientX - startX) / state.zoom.scale;
    const dy = (e.clientY - startY) / state.zoom.scale;
    const x = origX + dx;
    const y = origY + dy;
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
  };
  const onUp = () => {
    window.removeEventListener('pointermove', onMove);
    const deptKey = el.dataset.dept;
    const x = parseFloat(el.style.left || '0');
    const y = parseFloat(el.style.top || '0');
    if (deptKey) saveDeptPosition(deptKey, x, y);
    // Redraw to ensure canvas bounds adjust if needed
    render();
  };
  el.addEventListener('pointerdown', onDown);
}


