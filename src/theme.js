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


