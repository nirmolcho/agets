import { loadTheme, getTheme, styleDepartmentTag, styleConnectionsPath } from './theme.js';

const CARD_WIDTH = 300;
const CARD_HEIGHT = 160;
const GAP_X = 60;
const GAP_Y = 140;

const STATUS_VALUES = ['active', 'idle', 'error'];

/**
 * Maintains in-memory nodes and edges for current canvas
 */
const state = {
  nodes: new Map(), // id -> node { id, name, role, department, level, x, y, status }
  edges: [], // [{ fromId, toId }]
};

async function init() {
  await loadTheme();

  const orgRes = await fetch('/organization_tree.json');
  const org = await orgRes.json();

  buildGraphFromOrganization(org);
  autoLayout();
  render();

  wireToolbar();
  startStatusTicker();
}

function buildGraphFromOrganization(org) {
  state.nodes.clear();
  state.edges = [];

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
      });
      state.edges.push({ fromId: agentId, toId: manager.role });
    }
  }
}

function autoLayout() {
  // Row 0: CEO centered
  const ceo = state.nodes.get('chief-executive-officer');
  if (!ceo) return;
  ceo.x = 600 - CARD_WIDTH / 2;
  ceo.y = 40;

  // Row 1: managers
  const managers = [...state.nodes.values()].filter(n => n.level === 1);
  managers.sort((a, b) => a.department.localeCompare(b.department));
  const totalWidthManagers = managers.length * CARD_WIDTH + (managers.length - 1) * GAP_X;
  let startXManagers = Math.max(40, 600 - totalWidthManagers / 2);
  const yManagers = ceo.y + CARD_HEIGHT + GAP_Y;
  for (const m of managers) {
    m.x = startXManagers;
    m.y = yManagers;
    startXManagers += CARD_WIDTH + GAP_X;
  }

  // Row 2: agents under each manager, stacked horizontally beneath their manager
  const byManager = new Map();
  for (const edge of state.edges) {
    // agents have edge to their manager (toId)
    if (state.nodes.get(edge.fromId)?.level === 2) {
      const list = byManager.get(edge.toId) || [];
      list.push(state.nodes.get(edge.fromId));
      byManager.set(edge.toId, list);
    }
  }

  for (const [managerId, agents] of byManager.entries()) {
    const manager = state.nodes.get(managerId);
    agents.sort((a, b) => a.name.localeCompare(b.name));
    const totalWidth = agents.length * CARD_WIDTH + (agents.length - 1) * GAP_X;
    let startX = manager.x + CARD_WIDTH / 2 - totalWidth / 2;
    const y = manager.y + CARD_HEIGHT + GAP_Y;
    for (const a of agents) {
      a.x = startX;
      a.y = y;
      startX += CARD_WIDTH + GAP_X;
    }
  }
}

function render() {
  const cardsLayer = document.getElementById('cards-layer');
  const svg = document.getElementById('connections');
  cardsLayer.innerHTML = '';
  svg.innerHTML = '';

  const design = getTheme();

  for (const node of state.nodes.values()) {
    const card = createAgentCard(node, design);
    cardsLayer.appendChild(card);
  }

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

  el.append(header, deptTag, metrics, controls);

  enableDrag(el);
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
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
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
}

function wireToolbar() {
  const btnExport = document.getElementById('btn-export');
  const btnImport = document.getElementById('btn-import');
  const fileImport = document.getElementById('file-import');
  const btnAdd = document.getElementById('btn-add-agent');

  btnExport.onclick = exportConfiguration;
  btnImport.onclick = () => fileImport.click();
  fileImport.onchange = importConfiguration;
  btnAdd.onclick = addAgentFlow;
}

function exportConfiguration() {
  const payload = {
    version: 1,
    nodes: [...state.nodes.values()].map(n => ({ id: n.id, name: n.name, role: n.role, department: n.department, level: n.level, x: n.x, y: n.y, status: n.status })),
    edges: state.edges,
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
    id, name, role, department, level: 2, x: manager.x, y: manager.y + CARD_HEIGHT + GAP_Y, status: 'idle'
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

init();


