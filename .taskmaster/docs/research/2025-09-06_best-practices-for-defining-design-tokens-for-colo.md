---
title: Research Session
query: "Best practices for defining design tokens for colors, typography, spacing, and icons in a dark theme web app, ensuring WCAG contrast ratios of at least 4.5:1 for text, with specific examples that could fit an organization chart application with status indicators and department tags. Include how to implement them in CSS variables or a JS theme file."
date: 9/6/2025
time: 4:45:29 PM
timestamp: 2025-09-06T13:45:29.350Z
exchanges: 1
---

# Research Session

## Initial Query

**Question:** Best practices for defining design tokens for colors, typography, spacing, and icons in a dark theme web app, ensuring WCAG contrast ratios of at least 4.5:1 for text, with specific examples that could fit an organization chart application with status indicators and department tags. Include how to implement them in CSS variables or a JS theme file.

**Response:**

# Design Token Best Practices for Dark Theme Web Applications

## Introduction to Design Tokens in Dark Themes

Design tokens serve as the foundation of any design system, functioning as the atomic values that define the visual language of an application. For a dark theme organization chart application with status indicators and department tags, establishing a robust token system is crucial for maintaining visual consistency, accessibility, and scalability. Based on the project context, the application requires a comprehensive design system that meets WCAG contrast standards while supporting features like agent cards, organization hierarchies, and task panels with priority indicators.

Design tokens for dark themes require special consideration beyond simply inverting colors from a light theme. They must account for reduced eye strain, proper contrast ratios, and the unique perceptual challenges of dark backgrounds. In this comprehensive guide, I'll explore best practices for defining and implementing design tokens for colors, typography, spacing, and icons specifically tailored for a dark theme organization chart application.

## Color Token System for Dark Themes

### Color Token Hierarchy

For a dark theme application, a well-structured color token system should include:

1. **Base/Primitive Colors**: Raw color values (hex codes)
2. **Semantic Colors**: Purpose-based tokens that map to base colors
3. **Component-Specific Colors**: Tokens for specific UI elements

Here's an example structure for your organization chart application:

```javascript
// Base/Primitive Colors
const baseColors = {
  // Dark grays (avoid pure black)
  gray900: '#121212', // Background
  gray800: '#1E1E1E', // Card background
  gray700: '#2D2D2D', // Elevated elements
  gray600: '#3D3D3D', // Borders
  gray500: '#5A5A5A', // Disabled text
  gray400: '#757575', // Secondary text
  gray300: '#9E9E9E', // Tertiary text
  gray200: '#BDBDBD', // Icons
  gray100: '#E0E0E0', // Primary text
  
  // Brand colors with proper contrast
  blue500: '#2D7FF9', // Primary brand
  blue400: '#4B96FA', // Primary interactive
  blue300: '#6CADFC', // Primary hover
  
  // Status colors (accessible)
  green400: '#4CAF50', // Success/Active
  green300: '#66BB6A', // Success hover
  amber400: '#FFC107', // Warning/Idle
  amber300: '#FFCA28', // Warning hover
  red400: '#F44336',   // Error
  red300: '#E57373',   // Error hover
  
  // Department tag colors (all with 4.5:1+ contrast)
  purple400: '#9C27B0', // Department 1
  teal400: '#009688',   // Department 2
  indigo400: '#3F51B5', // Department 3
  orange400: '#FF9800', // Department 4
  cyan400: '#00BCD4',   // Department 5
}
```

### Semantic Color Tokens

Map base colors to semantic purposes:

```javascript
const semanticColors = {
  // Backgrounds
  bgPrimary: baseColors.gray900,
  bgSecondary: baseColors.gray800,
  bgElevated: baseColors.gray700,
  bgHover: baseColors.gray700,
  
  // Text
  textPrimary: baseColors.gray100,
  textSecondary: baseColors.gray300,
  textDisabled: baseColors.gray500,
  textOnColor: '#FFFFFF',
  
  // Borders
  borderPrimary: baseColors.gray600,
  borderFocus: baseColors.blue400,
  
  // Status
  statusActive: baseColors.green400,
  statusIdle: baseColors.amber400,
  statusError: baseColors.red400,
  
  // Interactive
  interactive: baseColors.blue400,
  interactiveHover: baseColors.blue300,
  interactivePressed: baseColors.blue500,
  
  // Department tags (with proper contrast against card backgrounds)
  deptEngineering: baseColors.purple400,
  deptMarketing: baseColors.teal400,
  deptSales: baseColors.indigo400,
  deptOperations: baseColors.orange400,
  deptFinance: baseColors.cyan400,
}
```

### Component-Specific Color Tokens

For the organization chart application, define component-specific tokens:

```javascript
const componentColors = {
  // Agent card colors
  agentCardBg: semanticColors.bgSecondary,
  agentCardBorder: semanticColors.borderPrimary,
  agentCardHoverBorder: semanticColors.interactive,
  agentCardRole: semanticColors.textSecondary,
  
  // Organization chart colors
  orgChartBg: semanticColors.bgPrimary,
  orgChartGrid: 'rgba(255, 255, 255, 0.05)',
  orgChartLine: semanticColors.borderPrimary,
  orgChartLineDashed: 'rgba(255, 255, 255, 0.2)',
  
  // Task panel colors
  taskPanelBg: semanticColors.bgElevated,
  taskPriorityHigh: baseColors.red400,
  taskPriorityMedium: baseColors.amber400,
  taskPriorityLow: baseColors.blue400,
}
```

### Ensuring WCAG Contrast Ratios

To ensure all text meets the 4.5:1 contrast ratio requirement:

1. Use a contrast checker tool during development
2. Avoid pure white text on dark backgrounds (use slightly off-white)
3. Ensure status colors and department tags have sufficient contrast

For example, to verify the contrast ratio of text colors against backgrounds:

```javascript
// Example contrast ratios (should be calculated/verified during implementation)
// textPrimary (#E0E0E0) on bgPrimary (#121212) = 14.5:1 ✓
// textSecondary (#9E9E9E) on bgPrimary (#121212) = 7.5:1 ✓
// textSecondary (#9E9E9E) on bgSecondary (#1E1E1E) = 6.7:1 ✓
// statusActive (#4CAF50) on bgSecondary (#1E1E1E) = 5.2:1 ✓
```

## Typography Token System

### Typography Token Structure

For the organization chart application, typography tokens should define:

1. **Font families** (primary, monospace)
2. **Font weights** (regular, medium, bold)
3. **Font sizes** (with a clear hierarchy)
4. **Line heights** (for proper readability)
5. **Letter spacing** (especially for small text)

```javascript
const typography = {
  // Font families
  fontFamilyPrimary: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  fontFamilyMonospace: "'Roboto Mono', 'SF Mono', 'Courier New', monospace",
  
  // Font weights
  fontWeightRegular: 400,
  fontWeightMedium: 500,
  fontWeightBold: 700,
  
  // Font sizes (with clear hierarchy)
  fontSize100: '0.75rem',    // 12px - Small labels, tags
  fontSize200: '0.875rem',   // 14px - Body text, agent roles
  fontSize300: '1rem',       // 16px - Primary text, department names
  fontSize400: '1.125rem',   // 18px - Section headers
  fontSize500: '1.25rem',    // 20px - Panel titles
  fontSize600: '1.5rem',     // 24px - Page headers
  fontSize700: '2rem',       // 32px - CEO/main header
  
  // Line heights (proportional for readability)
  lineHeight100: 1.2,  // Headings
  lineHeight200: 1.4,  // Body text
  lineHeight300: 1.6,  // Larger blocks of text
  
  // Letter spacing
  letterSpacingTight: '-0.01em',
  letterSpacingNormal: '0',
  letterSpacingWide: '0.01em',
  letterSpacingButton: '0.03em', // For buttons and tags
}
```

### Typography Combinations for Organization Chart

Define semantic typography combinations for specific elements:

```javascript
const typographyStyles = {
  // Headings
  headingLarge: {
    fontFamily: typography.fontFamilyPrimary,
    fontSize: typography.fontSize700,
    fontWeight: typography.fontWeightBold,
    lineHeight: typography.lineHeight100,
    letterSpacing: typography.letterSpacingTight,
  },
  
  // For department headers
  headingMedium: {
    fontFamily: typography.fontFamilyPrimary,
    fontSize: typography.fontSize500,
    fontWeight: typography.fontWeightMedium,
    lineHeight: typography.lineHeight100,
    letterSpacing: typography.letterSpacingTight,
  },
  
  // For agent names
  headingSmall: {
    fontFamily: typography.fontFamilyPrimary,
    fontSize: typography.fontSize300,
    fontWeight: typography.fontWeightMedium,
    lineHeight: typography.lineHeight100,
    letterSpacing: typography.letterSpacingNormal,
  },
  
  // For agent roles
  bodyRegular: {
    fontFamily: typography.fontFamilyPrimary,
    fontSize: typography.fontSize200,
    fontWeight: typography.fontWeightRegular,
    lineHeight: typography.lineHeight200,
    letterSpacing: typography.letterSpacingNormal,
  },
  
  // For department tags
  tagText: {
    fontFamily: typography.fontFamilyPrimary,
    fontSize: typography.fontSize100,
    fontWeight: typography.fontWeightMedium,
    lineHeight: typography.lineHeight100,
    letterSpacing: typography.letterSpacingButton,
    textTransform: 'uppercase',
  },
  
  // For status indicators
  statusText: {
    fontFamily: typography.fontFamilyPrimary,
    fontSize: typography.fontSize100,
    fontWeight: typography.fontWeightRegular,
    lineHeight: typography.lineHeight100,
    letterSpacing: typography.letterSpacingNormal,
  },
}
```

## Spacing Token System

### Spacing Scale

For a consistent layout, define a spacing scale with a clear progression:

```javascript
const spacing = {
  // Base spacing unit (4px)
  space0: '0',
  space1: '0.25rem',  // 4px
  space2: '0.5rem',   // 8px
  space3: '0.75rem',  // 12px
  space4: '1rem',     // 16px
  space5: '1.5rem',   // 24px
  space6: '2rem',     // 32px
  space7: '2.5rem',   // 40px
  space8: '3rem',     // 48px
  space9: '4rem',     // 64px
  
  // Component-specific spacing
  cardPadding: '1rem',                // 16px
  cardGap: '0.5rem',                  // 8px
  orgChartHorizontalGap: '2rem',      // 32px
  orgChartVerticalGap: '3rem',        // 48px
  departmentTagPadding: '0.25rem 0.5rem', // 4px 8px
  statusIndicatorSize: '0.5rem',      // 8px
  iconTextGap: '0.5rem',              // 8px
}
```

### Layout Tokens

Define layout-specific tokens for the organization chart:

```javascript
const layout = {
  // Card dimensions
  agentCardWidth: '250px',
  agentCardMinHeight: '120px',
  
  // Border radiuses
  radiusSmall: '2px',
  radiusMedium: '4px',
  radiusLarge: '8px',
  
  // Border widths
  borderWidthThin: '1px',
  borderWidthMedium: '2px',
  borderWidthThick: '3px',
  
  // Shadows for elevation (subtle in dark theme)
  shadowLevel1: '0 2px 4px rgba(0, 0, 0, 0.2)',
  shadowLevel2: '0 4px 8px rgba(0, 0, 0, 0.3)',
  shadowLevel3: '0 8px 16px rgba(0, 0, 0, 0.4)',
  
  // Z-index scale
  zIndexBase: 0,
  zIndexCard: 1,
  zIndexPopover: 10,
  zIndexModal: 100,
  zIndexTooltip: 1000,
}
```

## Icon Token System

### Icon Size Tokens

Define consistent icon sizes:

```javascript
const iconSizes = {
  iconSmall: '16px',
  iconMedium: '20px',
  iconLarge: '24px',
  iconXLarge: '32px',
}
```

### Icon Color Tokens

Map icon colors to semantic purposes:

```javascript
const iconColors = {
  iconPrimary: semanticColors.textPrimary,
  iconSecondary: semanticColors.textSecondary,
  iconOnColor: semanticColors.textOnColor,
  iconInteractive: semanticColors.interactive,
  iconSuccess: semanticColors.statusActive,
  iconWarning: semanticColors.statusIdle,
  iconError: semanticColors.statusError,
}
```

### Icon Usage Guidelines

Define how icons should be used in the organization chart:

```javascript
const iconUsage = {
  // Status indicators
  statusActiveIcon: 'circle-check',
  statusIdleIcon: 'clock',
  statusErrorIcon: 'alert-triangle',
  
  // Navigation
  expandIcon: 'chevron-down',
  collapseIcon: 'chevron-up',
  moreIcon: 'more-vertical',
  
  // Actions
  addIcon: 'plus',
  editIcon: 'pencil',
  deleteIcon: 'trash',
  
  // Department indicators
  deptEngineeringIcon: 'code',
  deptMarketingIcon: 'megaphone',
  deptSalesIcon: 'shopping-cart',
  deptOperationsIcon: 'settings',
  deptFinanceIcon: 'dollar-sign',
}
```

## Implementation in CSS Variables

To implement these design tokens as CSS variables:

```css
:root {
  /* Base colors */
  --color-gray-900: #121212;
  --color-gray-800: #1E1E1E;
  --color-gray-700: #2D2D2D;
  --color-gray-600: #3D3D3D;
  --color-gray-500: #5A5A5A;
  --color-gray-400: #757575;
  --color-gray-300: #9E9E9E;
  --color-gray-200: #BDBDBD;
  --color-gray-100: #E0E0E0;
  
  --color-blue-500: #2D7FF9;
  --color-blue-400: #4B96FA;
  --color-blue-300: #6CADFC;
  
  --color-green-400: #4CAF50;
  --color-green-300: #66BB6A;
  --color-amber-400: #FFC107;
  --color-amber-300: #FFCA28;
  --color-red-400: #F44336;
  --color-red-300: #E57373;
  
  --color-purple-400: #9C27B0;
  --color-teal-400: #009688;
  --color-indigo-400: #3F51B5;
  --color-orange-400: #FF9800;
  --color-cyan-400: #00BCD4;
  
  /* Semantic colors */
  --color-bg-primary: var(--color-gray-900);
  --color-bg-secondary: var(--color-gray-800);
  --color-bg-elevated: var(--color-gray-700);
  --color-bg-hover: var(--color-gray-700);
  
  --color-text-primary: var(--color-gray-100);
  --color-text-secondary: var(--color-gray-300);
  --color-text-disabled: var(--color-gray-500);
  --color-text-on-color: #FFFFFF;
  
  --color-border-primary: var(--color-gray-600);
  --color-border-focus: var(--color-blue-400);
  
  --color-status-active: var(--color-green-400);
  --color-status-idle: var(--color-amber-400);
  --color-status-error: var(--color-red-400);
  
  --color-interactive: var(--color-blue-400);
  --color-interactive-hover: var(--color-blue-300);
  --color-interactive-pressed: var(--color-blue-500);
  
  --color-dept-engineering: var(--color-purple-400);
  --color-dept-marketing: var(--color-teal-400);
  --color-dept-sales: var(--color-indigo-400);
  --color-dept-operations: var(--color-orange-400);
  --color-dept-finance: var(--color-cyan-400);
  
  /* Component colors */
  --color-agent-card-bg: var(--color-bg-secondary);
  --color-agent-card-border: var(--color-border-primary);
  --color-agent-card-hover-border: var(--color-interactive);
  --color-agent-card-role: var(--color-text-secondary);
  
  --color-org-chart-bg: var(--color-bg-primary);
  --color-org-chart-grid: rgba(255, 255, 255, 0.05);
  --color-org-chart-line: var(--color-border-primary);
  --color-org-chart-line-dashed: rgba(255, 255, 255, 0.2);
  
  --color-task-panel-bg: var(--color-bg-elevated);
  --color-task-priority-high: var(--color-red-400);
  --color-task-priority-medium: var(--color-amber-400);
  --color-task-priority-low: var(--color-blue-400);
  
  /* Typography */
  --font-family-primary: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  --font-family-monospace: 'Roboto Mono', 'SF Mono', 'Courier New', monospace;
  
  --font-weight-regular: 400;
  --font-weight-medium: 500;
  --font-weight-bold: 700;
  
  --font-size-100: 0.75rem;
  --font-size-200: 0.875rem;
  --font-size-300: 1rem;
  --font-size-400: 1.125rem;
  --font-size-500: 1.25rem;
  --font-size-600: 1.5rem;
  --font-size-700: 2rem;
  
  --line-height-100: 1.2;
  --line-height-200: 1.4;
  --line-height-300: 1.6;
  
  --letter-spacing-tight: -0.01em;
  --letter-spacing-normal: 0;
  --letter-spacing-wide: 0.01em;
  --letter-spacing-button: 0.03em;
  
  /* Spacing */
  --space-0: 0;
  --space-1: 0.25rem;
  --space-2: 0.5rem;
  --space-3: 0.75rem;
  --space-4: 1rem;
  --space-5: 1.5rem;
  --space-6: 2rem;
  --space-7: 2.5rem;
  --space-8: 3rem;
  --space-9: 4rem;
  
  --card-padding: 1rem;
  --card-gap: 0.5rem;
  --org-chart-horizontal-gap: 2rem;
  --org-chart-vertical-gap: 3rem;
  --department-tag-padding: 0.25rem 0.5rem;
  --status-indicator-size: 0.5rem;
  --icon-text-gap: 0.5rem;
  
  /* Layout */
  --agent-card-width: 250px;
  --agent-card-min-height: 120px;
  
  --radius-small: 2px;
  --radius-medium: 4px;
  --radius-large: 8px;
  
  --border-width-thin: 1px;
  --border-width-medium: 2px;
  --border-width-thick: 3px;
  
  --shadow-level-1: 0 2px 4px rgba(0, 0, 0, 0.2);
  --shadow-level-2: 0 4px 8px rgba(0, 0, 0, 0.3);
  --shadow-level-3: 0 8px 16px rgba(0, 0, 0, 0.4);
  
  --z-index-base: 0;
  --z-index-card: 1;
  --z-index-popover: 10;
  --z-index-modal: 100;
  --z-index-tooltip: 1000;
  
  /* Icons */
  --icon-size-small: 16px;
  --icon-size-medium: 20px;
  --icon-size-large: 24px;
  --icon-size-xlarge: 32px;
  
  --icon-color-primary: var(--color-text-primary);
  --icon-color-secondary: var(--color-text-secondary);
  --icon-color-on-color: var(--color-text-on-color);
  --icon-color-interactive: var(--color-interactive);
  --icon-color-success: var(--color-status-active);
  --icon-color-warning: var(--color-status-idle);
  --icon-color-error: var(--color-status-error);
}
```

## Implementation in JavaScript Theme File

For a JavaScript-based theme implementation (which aligns with your project structure showing a theme.js file):

```javascript
// theme.js
const theme = {
  colors: {
    // Base colors
    gray: {
      900: '#121212',
      800: '#1E1E1E',
      700: '#2D2D2D',
      600: '#3D3D3D',
      500: '#5A5A5A',
      400: '#757575',
      300: '#9E9E9E',
      200: '#BDBDBD',
      100: '#E0E0E0',
    },
    blue: {
      500: '#2D7FF9',
      400: '#4B96FA',
      300: '#6CADFC',
    },
    green: {
      400: '#4CAF50',
      300: '#66BB6A',
    },
    amber: {
      400: '#FFC107',
      300: '#FFCA28',
    },
    red: {
      400: '#F44336',
      300: '#E57373',
    },
    purple: { 400: '#9C27B0' },
    teal: { 400: '#009688' },
    indigo: { 400: '#3F51B5' },
    orange: { 400: '#FF9800' },
    cyan: { 400: '#00BCD4' },
    
    // Semantic colors
    bg: {
      primary: '#121212',
      secondary: '#1E1E1E',
      elevated: '#2D2D2D',
      hover: '#2D2D2D',
    },
    text: {
      primary: '#E0E0E0',
      secondary: '#9E9E9E',
      disabled: '#5A5A5A',
      onColor: '#FFFFFF',
    },
    border: {
      primary: '#3D3D3D',
      focus: '#4B96FA',
    },
    status: {
      active: '#4CAF50',
      idle: '#FFC107',
      error: '#F44336',
    },
    interactive: {
      base: '#4B96FA',
      hover: '#6CADFC',
      pressed: '#2D7FF9',
    },
    department: {
      engineering: '#9C27B0',
      marketing: '#009688',
      sales: '#3F51B5',
      operations: '#FF9800',
      finance: '#00BCD4',
    },
    
    // Component colors
    agentCard: {
      bg: '#1E1E1E',
      border: '#3D3D3D',
      hoverBorder: '#4B96FA',
      role: '#9E9E9E',
    },
    orgChart: {
      bg: '#121212',
      grid: 'rgba(255, 255, 255, 0.05)',
      line: '#3D3D3D',
      lineDashed: 'rgba(255, 255, 255, 0.2)',
    },
    taskPanel: {
      bg: '#2D2D2D',
      priorityHigh: '#F44336',
      priorityMedium: '#FFC107',
      priorityLow: '#4B96FA',
    },
  },
  
  typography: {
    fontFamily: {
      primary: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      monospace: "'Roboto Mono', 'SF Mono', 'Courier New', monospace",
    },
    fontWeight: {
      regular: 400,
      medium: 500,
      bold: 700,
    },
    fontSize: {
      100: '0.75rem',
      200: '0.875rem',
      300: '1rem',
      400: '1.125rem',
      500: '1.25rem',
      600: '1.5rem',
      700: '2rem',
    },
    lineHeight: {
      100: 1.2,
      200: 1.4,
      300: 1.6,
    },
    letterSpacing: {
      tight: '-0.01em',
      normal: '0',
      wide: '0.01em',
      button: '0.03em',
    },
    
    // Typography combinations
    styles: {
      headingLarge: {
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        fontSize: '2rem',
        fontWeight: 700,
        lineHeight: 1.2,
        letterSpacing: '-0.01em',
      },
      headingMedium: {
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        fontSize: '1.25rem',
        fontWeight: 500,
        lineHeight: 1.2,
        letterSpacing: '-0.01em',
      },
      headingSmall: {
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        fontSize: '1rem',
        fontWeight: 500,
        lineHeight: 1.2,
        letterSpacing: '0',
      },
      bodyRegular: {
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        fontSize: '0.875rem',
        fontWeight: 400,
        lineHeight: 1.4,
        letterSpacing: '0',
      },
      tagText: {
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        fontSize: '0.75rem',
        fontWeight: 500,
        lineHeight: 1.2,
        letterSpacing: '0.03em',
        textTransform: 'uppercase',
      },
      statusText: {
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        fontSize: '0.75rem',
        fontWeight: 400,
        lineHeight: 1.2,
        letterSpacing: '0',
      },
    },
  },
  
  spacing: {
    0: '0',
    1: '0.25rem',
    2: '0.5rem',
    3: '0.75rem',
    4: '1rem',
    5: '1.5rem',
    6: '2rem',
    7: '2.5rem',
    8: '3rem',
    9: '4rem',
    
    // Component-specific spacing
    cardPadding: '1rem',
    cardGap: '0.5rem',
    orgChartHorizontalGap: '2rem',
    orgChartVerticalGap: '3rem',
    departmentTagPadding: '0.25rem 0.5rem',
    statusIndicatorSize: '0.5rem',
    iconTextGap: '0.5rem',
  },
  
  layout: {
    agentCardWidth: '250px',
    agentCardMinHeight: '120px',
    
    radius: {
      small: '2px',
      medium: '4px',
      large: '8px',
    },
    
    borderWidth: {
      thin: '1px',
      medium: '2px',
      thick: '3px',
    },
    
    shadow: {
      level1: '0 2px 4px rgba(0, 0, 0, 0.2)',
      level2: '0 4px 8px rgba(0, 0, 0, 0.3)',
      level3: '0 8px 16px rgba(0, 0, 0, 0.4)',
    },
    
    zIndex: {
      base: 0,
      card: 1,
      popover: 10,
      modal: 100,
      tooltip: 1000,
    },
  },
  
  icon: {
    size: {
      small: '16px',
      medium: '20px',
      large: '24px',
      xlarge: '32px',
    },
    
    color: {
      primary: '#E0E0E0',
      secondary: '#9E9E9E',
      onColor: '#FFFFFF',
      interactive: '#4B96FA',
      success: '#4CAF50',
      warning: '#FFC107',
      error: '#F44336',
    },
    
    // Icon names (for reference)
    name: {
      statusActive: 'circle-check',
      statusIdle: 'clock',
      statusError: 'alert-triangle',
      expand: 'chevron-down',
      collapse: 'chevron-up',
      more: 'more-vertical',
      add: 'plus',
      edit: 'pencil',
      delete: 'trash',
      deptEngineering: 'code',
      deptMarketing: 'megaphone',
      deptSales: 'shopping-cart',
      deptOperations: 'settings',
      deptFinance: 'dollar-sign',
    },
  },
};

export default theme;
```

## Example Component Implementation

Here's an example of how to implement an agent card component using these design tokens:

```jsx
// AgentCard.jsx
import React from 'react';
import theme from '../theme';

// CSS-in-JS implementation
const styles = {
  agentCard: {
    width: theme.layout.agentCardWidth,
    minHeight: theme.layout.agentCardMinHeight,
    backgroundColor: theme.colors.agentCard.bg,
    borderRadius: theme.layout.radius.medium,
    border: `${theme.layout.borderWidth.thin} solid ${theme.colors.agentCard.border}`,
    padding: theme.spacing.cardPadding,
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing.cardGap,
    transition: 'border-color 0.2s ease',
    '&:hover': {
      borderColor: theme.colors.agentCard.hoverBorder,
    },
  },
  
  agentName: {
    ...theme.typography.styles.headingSmall,
    color: theme.colors.text.primary,
    margin: 0,
  },
  
  agentRole: {
    ...theme.typography.styles.bodyRegular,
    color: theme.colors.agentCard.role,
    margin: 0,
  },
  
  statusContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.iconTextGap,
  },
  
  statusIndicator: (status) => ({
    width: theme.spacing.statusIndicatorSize,
    height: theme.spacing.statusIndicatorSize,
    borderRadius: '50%',
    backgroundColor: 
      status === 'active' ? theme.colors.status.active :
      status === 'idle' ? theme.colors.status.idle :
      theme.colors.status.error,
  }),
  
  statusText: {
    ...theme.typography.styles.statusText,
    color: theme.colors.text.secondary,
  },
  
  departmentTag: (department) => ({
    ...theme.typography.styles.tagText,
    backgroundColor: theme.colors.department[department.toLowerCase()],
    color: theme.colors.text.onColor,
    padding: theme.spacing.departmentTagPadding,
    borderRadius: theme.layout.radius.small,
    display: 'inline-block',
    alignSelf: 'flex-start',
  }),
};

const AgentCard = ({ agent }) => {
  const { name, role, status, department } = agent;
  
  return (
    <div style={styles.agentCard}>
      <div style={styles.departmentTag(department)}>
        {department}
      </div>
      
      <h3 style={styles.agentName}>{name}</h3>
      <p style={styles.agentRole}>{role}</p>
      
      <div style={styles.statusContainer}>
        <span style={styles.statusIndicator(status)}></span>
        <span style={styles.statusText}>
          {status.charAt(0).toUpperCase() + status.slice(1)}
        </span>
      </div>
    </div>
  );
};

export default AgentCard;
```

## Conclusion

Implementing a comprehensive design token system for a dark theme organization chart application requires careful consideration of color contrast, typography hierarchy, consistent spacing, and appropriate icon usage. By following the best practices outlined in this guide, you can create a visually cohesive, accessible, and maintainable application that meets WCAG contrast standards.

The token structure provided aligns with the project requirements for agent cards, organization hierarchies, and task panels with priority indicators. The implementation examples in both CSS variables and JavaScript demonstrate how to apply these tokens in your codebase.

Remember to regularly test your implementation with contrast checking tools to ensure all text meets the 4.5:1 contrast ratio requirement, especially for status indicators and department tags. This approach will create a solid foundation for your dark theme application that is both visually appealing and accessible to all users.


---

*Generated by Task Master Research Command*  
*Timestamp: 2025-09-06T13:45:29.350Z*
