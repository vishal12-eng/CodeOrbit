# CodeOrbit Design Guidelines

## Design Approach

**Reference-Based Approach**: Inspired by modern cloud IDEs (Replit, CodeSandbox, StackBlitz) and professional dev tools (VS Code, Linear). Focus on utility-first design with strategic visual polish — this is a developer tool, not a marketing site.

**Core Principles**:
- Developer-first functionality with thoughtful UX refinement
- Subtle, purposeful animations that enhance (not distract from) coding workflow
- Clean, scannable interface with clear visual hierarchy
- Professional polish without unnecessary decoration

## Typography System

**Fonts** (via Google Fonts CDN):
- Interface: **Inter** (400, 500, 600) — for UI elements, labels, buttons
- Code: **JetBrains Mono** (400, 500) — for Monaco editor and console output

**Type Scale**:
- Headings: `text-2xl font-semibold` (project names, page titles)
- Body: `text-sm` (default UI text, labels)
- Small: `text-xs` (timestamps, meta info, status indicators)
- Code: `text-sm font-mono` (console output, file names)

## Layout & Spacing System

**Tailwind Spacing Units**: Use **2, 4, 6, 8, 12, 16** for consistent rhythm
- Component padding: `p-4` to `p-6`
- Section spacing: `space-y-4` to `space-y-6`
- Page margins: `px-6 py-8` or `px-8 py-12`

**Container Strategy**:
- Dashboard: `max-w-7xl mx-auto` 
- Auth pages: `max-w-md mx-auto`
- Editor: Full viewport layout with no max-width constraints

## Core Components

### Buttons
- **Primary**: Rounded (`rounded-lg`), medium padding (`px-4 py-2`), semi-bold text, subtle shadow
- **Secondary**: Outlined variant with transparent background
- **Icon buttons**: Square (`w-9 h-9`), centered icon, hover background change
- **Run button** (special): Accent-colored, prominent size (`px-6 py-2.5`), with icon

### Cards (Project Cards, Auth Forms)
- Border radius: `rounded-xl`
- Padding: `p-6`
- Subtle shadow: `shadow-lg` 
- Border: `border border-gray-800` (dark) / `border-gray-200` (light)

### Inputs & Forms
- Height: `h-10` for text inputs
- Padding: `px-3`
- Border radius: `rounded-lg`
- Focus ring: Visible accent-colored ring on focus
- Labels: `text-sm font-medium mb-2`

### File Tree
- Indentation: `pl-4` per nesting level
- Item height: `h-8`
- Hover background: Subtle highlight
- Active file: Accent background with higher opacity
- Icons: 16px (folders, files) from Lucide

### Monaco Editor
- No custom styling (uses Monaco's built-in themes)
- Tabs above editor: `h-10`, `px-4`, subtle border-bottom on active tab
- Close button on tabs: Small icon (12px) on hover

### Console Panel
- Height: Resizable, default `h-64`
- Background: Slightly darker than main background
- Text: Monospace font, `text-xs`
- Scrollable with `overflow-auto`
- Clear button in top-right corner

### Toast Notifications
- Position: Top-right (`fixed top-4 right-4`)
- Size: `max-w-sm`
- Auto-dismiss after 3-4 seconds
- Success/error color coding with icons

## Page-Specific Layouts

### Landing Page (Pre-Auth)
**Hero Section** (80vh):
- Centered content with `max-w-4xl`
- Large heading (`text-5xl font-bold`)
- Subtitle (`text-xl text-gray-400`)
- Two CTAs side-by-side (`flex gap-4`)

**Features Section**:
- 3-column grid (`grid-cols-1 md:grid-cols-3 gap-6`)
- Feature cards with icon, title, description
- Icons: 24px, accent-colored

### Auth Pages
- Centered card (`max-w-md mx-auto mt-20`)
- Form with `space-y-4` between inputs
- Submit button full-width
- Switch between login/signup with text link

### Dashboard
**Top Bar** (`h-16`, `border-b`):
- Logo/title on left
- User menu + theme toggle on right
- Flex layout with `justify-between`

**Main Content**:
- "Create Project" button (top-left, prominent)
- Project grid: `grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6`
- Each card: Project name, timestamp, quick actions (Open, Delete icons)

### Editor (IDE View)
**Layout** (full viewport, no scrolling):
```
┌─────────────────────────────────────────┐
│ Top Bar (h-14, border-b)                │
├──────────┬──────────────────────────────┤
│          │                              │
│ File     │    Monaco Editor             │
│ Tree     │    (with tabs)               │
│ (w-64)   │                              │
│          │                              │
├──────────┴──────────────────────────────┤
│ Console Panel (h-64, resizable)         │
└─────────────────────────────────────────┘
```

**Top Bar**:
- Breadcrumb/project name (left)
- Run button (center-right, prominent)
- Save status indicator (right): "Saved" / "Saving..." with subtle fade
- Theme toggle (far right)

**File Tree Sidebar**:
- Resizable with drag handle on right edge
- Collapsible folders with chevron icons
- Context menu on right-click (New File, New Folder, Rename, Delete)

**Console Panel**:
- Collapsible with animated height transition
- Toggle button in top-left ("Console ▼")
- Output area with monospace text
- Clear button (top-right)

## Animations (Framer Motion)

**Philosophy**: Subtle, functional motion — not gratuitous

**Page Transitions**:
- Fade in + slight upward slide (`y: 20 → 0, opacity: 0 → 1`)
- Duration: 200-300ms

**Dashboard Project Cards**:
- Stagger children animation on mount (50ms delay between cards)
- Hover: Slight lift (`y: 0 → -4`) + shadow increase

**Editor Panels**:
- Sidebar toggle: Slide in/out with width animation
- Console expand/collapse: Smooth height transition (300ms)
- Tab switches: Crossfade between editor contents

**Buttons**:
- Hover: Subtle scale (`scale: 1 → 1.02`)
- Active/click: Quick scale down (`scale: 1 → 0.98`)

**Run Button Special**:
- Idle: Subtle pulse animation on hover
- Running: Loading spinner replaces icon

**Micro-interactions**:
- File tree item selection: Background fade-in (150ms)
- Toast entry: Slide in from right + fade
- Save indicator: Fade between states (200ms)

## Icons (Lucide React)

**Consistent Sizing**:
- UI actions: 18px (`size={18}`)
- File tree: 16px
- Large feature icons: 24px

**Key Icons**:
- Play (Run), Folder, File, Plus, Trash, Edit, Save, Moon/Sun (theme), User, LogOut, ChevronRight (folders), X (close)

## Loading States

**Skeleton Loaders**:
- Dashboard project cards: Rectangular pulse placeholders
- Editor initial load: Simple centered spinner

**Inline Loaders**:
- Buttons: Spinner replaces text/icon during action
- Save status: Small animated dots during save

## Responsive Behavior

**Breakpoints**:
- Mobile (`<768px`): Single column, sidebar hidden by default (toggle overlay)
- Tablet (`768-1024px`): 2-column project grid, narrower sidebar
- Desktop (`>1024px`): Full layout as designed

## No Images Required

This is a utility application (IDE) — no hero images or decorative imagery needed. Interface is icon and typography-driven.