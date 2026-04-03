# Design Guidelines: Solar Energy Invoice Management System

## Design Approach: Material Design System

**Rationale**: This is a data-intensive business application requiring efficient information processing, robust form handling, and clear data visualization. Material Design provides the structured component library and interaction patterns needed for this utility-focused platform while maintaining professional polish.

**Core Principle**: Prioritize clarity, scannable layouts, and efficient workflows over decorative elements. Users need to process invoices quickly and access financial data with confidence.

---

## Typography System

**Font Family**: Roboto (via Google Fonts CDN)
- Primary: Roboto (400, 500, 700 weights)
- Monospace: Roboto Mono (for numerical data, invoice IDs, calculations)

**Hierarchy**:
- Page Titles: 2.5rem / 700 weight
- Section Headers: 1.75rem / 500 weight  
- Card Headers: 1.25rem / 500 weight
- Body Text: 1rem / 400 weight
- Data Labels: 0.875rem / 500 weight (uppercase, letter-spacing: 0.5px)
- Data Values: 1rem / 400 weight
- Financial Numbers: 1.125rem / 500 weight (Roboto Mono)
- Captions/Metadata: 0.75rem / 400 weight

---

## Layout System

**Spacing Primitives**: Use Tailwind units of 2, 4, 6, 8, 12, 16
- Component padding: p-4 to p-6
- Section spacing: mb-8 to mb-12
- Card spacing: p-6
- Form field spacing: mb-4
- Grid gaps: gap-4 to gap-6

**Container Strategy**:
- Dashboard/Main Views: max-w-7xl with px-4
- Form Pages: max-w-4xl centered
- Full-width Tables: w-full with horizontal scroll on mobile
- Sidebar Navigation: Fixed 280px width (desktop), collapsible mobile

**Grid Patterns**:
- Dashboard Cards: grid-cols-1 md:grid-cols-2 lg:grid-cols-3
- Reports Summary: grid-cols-1 md:grid-cols-4 (for key metrics)
- Invoice List: Single column with horizontal scroll table
- Client List: Similar table-based approach

---

## Component Library

### Navigation
**Top Bar** (Fixed):
- Application logo/name (left)
- Breadcrumb navigation (center-left)
- User profile + notifications + role badge (right)
- Height: 64px, shadow-md

**Sidebar** (Desktop - Collapsible):
- Primary navigation items with icons
- Grouped by: Dashboard, Usinas (Plants), Clientes (Clients), Faturas (Invoices), Relatórios (Reports), Configurações (Settings)
- Active state: Subtle background treatment, not just border
- Admin-only items visually distinguished with badge/icon

### Dashboard Components

**Metric Cards** (4-column grid on desktop):
- Large number display (financial value/kWh)
- Label above number
- Trend indicator (percentage up/down with small arrow icon)
- Compact footer with comparison text
- Elevated appearance (shadow-sm)

**Quick Actions Panel**:
- Prominent CTAs: "Upload Faturas", "Gerar Relatório", "Cadastrar Cliente"
- Icon + text buttons, generous spacing
- Horizontal layout on desktop, stacked on mobile

**Recent Activity Feed**:
- Timeline-style list
- User avatar + action description + timestamp
- "Ver todos" link at bottom

### Forms

**Input Fields**:
- Outlined style (Material Design outlined text fields)
- Floating labels
- Helper text below field
- Error states with icon + message below
- Required indicator (*)

**File Upload (Drag & Drop)**:
- Large dashed border area
- Icon + "Arraste PDFs aqui ou clique para selecionar"
- Shows file list after upload with remove option
- Progress indicator during processing
- Validation feedback (success checkmark, error icon)

**Date Pickers**: Integrated calendar component
**Dropdowns**: Autocomplete for client/usina selection with search

### Data Tables

**Invoice/Client Lists**:
- Sticky header row
- Alternating row treatment for scannability  
- Sortable columns (icon indicates sort direction)
- Action column (right-aligned): Download, View, Edit icons
- Status badges: "Pendente", "Processada", "Enviada"
- Checkbox column for bulk selection
- Pagination at bottom (rows per page selector + page navigation)

**Financial Tables** (in Reports):
- Right-align all numerical columns
- Use Roboto Mono for numbers
- Bold totals row with top border separation
- Expandable rows for detailed breakdowns

### Cards

**Usina/Client Cards**:
- Header: Name + UC number
- Body: Key metrics in 2-column grid
- Footer: Action buttons (View Details, Edit, Upload Invoice)
- Subtle border, shadow on hover

**Invoice Preview Card**:
- Thumbnail of PDF (if possible) or document icon
- Metadata: UC, Month, Amount, Status
- Quick actions: Download, View Full, Regenerate

### Modals/Overlays

**Confirmation Dialogs**: Centered, max-w-md, clear title + description + action buttons
**Invoice Viewer**: Full-screen overlay with embedded PDF viewer, close button, download action
**Detail Panels**: Slide-in from right (600px width) for client/usina details

### Status & Feedback

**Alerts**: Top-of-page banners for system messages (dismissible)
**Validation Warnings**: Inline within forms, yellow accent for warnings (e.g., "Geração abaixo de 90% previsto")
**Success Messages**: Toast notifications (bottom-right, auto-dismiss 4s)
**Loading States**: Skeleton loaders for tables, spinner for buttons/actions

### Reports Section

**Report Generator**:
- Filter panel: Date range picker, Usina selector, export format
- Generate button (prominent)
- Results display: Summary cards + detailed table + export option

**Charts** (if needed):
- Simple bar/line charts for generation trends
- Keep minimal, focus on table data primarily

---

## Animation Guidelines

**Minimize animations** - use only for feedback:
- Drawer open/close: 200ms ease-in-out
- Dropdown expand: 150ms ease-out
- Success checkmark: Simple fade-in
- Toast notifications: Slide-in from right
- No scroll-triggered animations
- No decorative micro-interactions

**Avoid**: Loading skeletons with animated shimmer (use static placeholders), complex transitions, hover effects beyond simple opacity/background changes

---

## Responsive Approach

**Breakpoints** (Tailwind defaults):
- Mobile-first approach
- Tables: Horizontal scroll on mobile, full display on md+
- Sidebar: Off-canvas drawer on mobile, persistent on lg+
- Forms: Single column on mobile, strategic 2-column on md+
- Dashboard metrics: Stack on mobile, grid on md+

---

## Accessibility

- Consistent tab order throughout
- All interactive elements keyboard accessible
- Form labels always visible (no placeholder-only)
- Sufficient contrast for all text (WCAG AA minimum)
- Focus indicators on all interactive elements
- ARIA labels for icon-only buttons

---

## Images

**Not applicable** - This is a data-driven business application. Avoid decorative imagery. Use:
- Icons for navigation and actions (Material Icons via CDN)
- Company logo in header
- PDF thumbnails/previews where relevant
- No hero images, no marketing imagery