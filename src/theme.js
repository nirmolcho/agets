let themeDesign = null;

export async function loadTheme() {
  if (themeDesign) return themeDesign;
  const res = await fetch('/design.json');
  themeDesign = await res.json();
  applyThemeToDocument(themeDesign);
  return themeDesign;
}

export function getTheme() {
  return themeDesign;
}

function applyThemeToDocument(design) {
  const root = document.documentElement;
  const container = design?.elementStyling?.container ?? {};
  const cards = design?.elementStyling?.cards ?? {};
  const connections = design?.elementStyling?.connections?.lines ?? {};
  const testing = design?.elementStyling?.connections?.testing ?? {};
  const sidePanel = design?.elementStyling?.sidePanel ?? {};
  const sideHeader = sidePanel?.header ?? {};
  const sectionTitle = sidePanel?.sectionTitle ?? {};
  const taskItem = sidePanel?.taskItem ?? {};
  const scrollbar = sidePanel?.scrollbar ?? {};

  if (container.background) root.style.setProperty('--container-bg', container.background);
  if (cards.background) root.style.setProperty('--card-bg', cards.background);
  if (cards.border?.split(' ').pop()) root.style.setProperty('--card-border', cards.border.split(' ').pop());
  if (connections.stroke) root.style.setProperty('--line-stroke', connections.stroke);

  if (container.fontFamily) document.body.style.fontFamily = container.fontFamily;
  if (container.minHeight) document.body.style.minHeight = container.minHeight;

  // Testing connection CSS vars
  if (testing.stroke) root.style.setProperty('--testing-line-stroke', testing.stroke);
  if (testing.strokeWidth) root.style.setProperty('--testing-line-width', parseInt(testing.strokeWidth));
  if (testing.strokeDasharray) root.style.setProperty('--testing-line-dash', testing.strokeDasharray);

  // Side panel styling from design
  if (sidePanel.background) root.style.setProperty('--sidepanel-bg', sidePanel.background);
  if (sidePanel.borderLeft) root.style.setProperty('--sidepanel-border-left', sidePanel.borderLeft);
  if (sidePanel.color) root.style.setProperty('--sidepanel-color', sidePanel.color);
  if (sidePanel.padding) root.style.setProperty('--sidepanel-padding', sidePanel.padding);
  if (sidePanel.shadow) root.style.setProperty('--sidepanel-shadow', sidePanel.shadow);

  // Widths: use clamp(min, preferred, max). Convert percentage to vw for preferred if provided.
  const toPreferred = (val) => {
    if (typeof val !== 'string') return undefined;
    const trimmed = val.trim();
    if (trimmed.endsWith('%')) return trimmed.replace('%', 'vw');
    return trimmed;
  };
  if (sidePanel.minWidth) root.style.setProperty('--overlay-width-min', sidePanel.minWidth);
  if (sidePanel.maxWidth) root.style.setProperty('--overlay-width-pref', toPreferred(sidePanel.maxWidth));
  if (sidePanel.width) root.style.setProperty('--overlay-width-max', sidePanel.width);

  // Header typography and separation
  if (sideHeader.fontSize) root.style.setProperty('--sidepanel-header-font-size', sideHeader.fontSize);
  if (sideHeader.fontWeight) root.style.setProperty('--sidepanel-header-font-weight', String(sideHeader.fontWeight));
  if (sideHeader.marginBottom) root.style.setProperty('--sidepanel-header-margin-bottom', sideHeader.marginBottom);
  if (sideHeader.color) root.style.setProperty('--sidepanel-header-color', sideHeader.color);
  if (sideHeader.borderBottom) root.style.setProperty('--sidepanel-header-border-bottom', sideHeader.borderBottom);
  if (sideHeader.paddingBottom) root.style.setProperty('--sidepanel-header-padding-bottom', sideHeader.paddingBottom);

  // Section titles
  if (sectionTitle.fontSize) root.style.setProperty('--sidepanel-section-font-size', sectionTitle.fontSize);
  if (sectionTitle.fontWeight) root.style.setProperty('--sidepanel-section-font-weight', String(sectionTitle.fontWeight));
  if (sectionTitle.color) root.style.setProperty('--sidepanel-section-color', sectionTitle.color);
  if (sectionTitle.marginTop) root.style.setProperty('--sidepanel-section-margin-top', sectionTitle.marginTop);
  if (sectionTitle.marginBottom) root.style.setProperty('--sidepanel-section-margin-bottom', sectionTitle.marginBottom);

  // Task item styling
  if (taskItem.background) root.style.setProperty('--sidepanel-taskitem-bg', taskItem.background);
  if (taskItem.border) root.style.setProperty('--sidepanel-taskitem-border', taskItem.border);
  if (taskItem.borderRadius) root.style.setProperty('--sidepanel-taskitem-radius', taskItem.borderRadius);

  // Scrollbar styling
  if (scrollbar.width) root.style.setProperty('--sidepanel-scrollbar-width', scrollbar.width);
  if (scrollbar.background) root.style.setProperty('--sidepanel-scrollbar-bg', scrollbar.background);
  if (scrollbar.thumb?.background) root.style.setProperty('--sidepanel-scrollbar-thumb-bg', scrollbar.thumb.background);
  if (scrollbar.thumb?.borderRadius) root.style.setProperty('--sidepanel-scrollbar-thumb-radius', scrollbar.thumb.borderRadius);
}

export function styleDepartmentTag(el, department, design = themeDesign) {
  const tagStyles = design?.elementStyling?.cards?.departmentTags ?? {};
  const dept = tagStyles?.[department];
  if (!dept) return;
  if (dept.background) el.style.background = dept.background;
  if (dept.color) el.style.color = dept.color;
  if (dept.borderRadius) el.style.borderRadius = dept.borderRadius;
  if (dept.padding) el.style.padding = dept.padding;
  if (dept.fontSize) el.style.fontSize = dept.fontSize;
  if (dept.fontWeight) el.style.fontWeight = dept.fontWeight;
}

export function applyCardHover(el, design = themeDesign) {
  const hover = design?.elementStyling?.cards?.hover;
  if (!hover) return;
  // Hover handled via CSS; ensure consistency if needed
}

export function styleConnectionsPath(pathEl, design = themeDesign) {
  const lines = design?.elementStyling?.connections?.lines;
  if (!lines) return;
  if (lines.stroke) pathEl.style.stroke = lines.stroke;
  if (lines.strokeWidth) pathEl.style.strokeWidth = parseInt(lines.strokeWidth);
  if (lines.opacity) pathEl.style.opacity = lines.opacity;
}


