# Shahdab — UI/UX Design Implementation Guide

> Single source of truth for the visual design system and per-page layout specs. Subagents can use this to redesign pages in parallel once the global tokens and shared components are locked.

---

## 1. Design principles

- **Task-first, role-aware.** Each page is optimized for the staff member using it: captains need fast table actions, cashiers need large totals, kitchen staff needs high-contrast ticket queues.
- **Consistent, predictable layout.** Every page uses the same header, tab, card, and empty/loading patterns.
- **Accessible defaults.** Focus-visible rings, status `role="status"`, `aria-label`s, and color not used as the only information channel.
- **Tailwind + shadcn native tokens.** No arbitrary hex codes in page code; all colors come from `src/index.css` CSS variables or the status map below.
- **Build-first.** Any CSS or page edit must keep `npm run build` green.

---

## 2. Global design tokens

### 2.1 Color palette

The app already uses HSL CSS variables in `frontend/src/index.css`. Keep this base and add the status/brand tokens below.

**Base tokens (do not change values without updating the whole app):**

| Token | HSL | Usage |
|-------|-----|-------|
| `--background` | `0 0% 100%` | page background |
| `--foreground` | `240 10% 3.9%` | primary text |
| `--card` / `--card-foreground` | `0 0% 100%` / `240 10% 3.9%` | cards, panels |
| `--popover` / `--popover-foreground` | `0 0% 100%` / `240 10% 3.9%` | dropdowns, popovers |
| `--primary` / `--primary-foreground` | `240 5.9% 10%` / `0 0% 98%` | nav active, primary CTAs |
| `--secondary` / `--secondary-foreground` | `240 4.8% 95.9%` / `240 5.9% 10%` | secondary buttons, chips |
| `--muted` / `--muted-foreground` | `240 4.8% 95.9%` / `240 3.8% 46.1%` | subtle backgrounds, hint text |
| `--accent` / `--accent-foreground` | `240 4.8% 95.9%` / `240 5.9% 10%` | hover accents |
| `--destructive` / `--destructive-foreground` | `0 84.2% 60.2%` / `0 0% 98%` | errors, destructive actions |
| `--border` / `--input` | `240 5.9% 90%` | borders, inputs |
| `--ring` | `240 5.9% 10%` | focus rings |

**Proposed additions to `frontend/src/index.css` for the redesign (add inside `:root`):**

```css
--success: 142 76% 36%;
--success-foreground: 0 0% 98%;
--warning: 38 92% 50%;
--warning-foreground: 0 0% 98%;
--info: 217 91% 60%;
--info-foreground: 0 0% 98%;
```

These map to Tailwind-ish utility classes such as `bg-green-100`, `text-green-800` for status badges (see status map).

### 2.2 Status color map

Always use these token pairs for status badges, table cards, and state pills. This is the single source of truth. Replace any hard-coded `bg-X-100 text-X-800` in pages with the corresponding utility class set.

| Status | Background | Text | Use for |
|--------|------------|------|---------|
| `vacant` | `bg-green-100` | `text-green-800` | table |
| `reserved` | `bg-blue-100` | `text-blue-800` | table, reservation |
| `occupied` | `bg-amber-100` | `text-amber-800` | table |
| `bill_requested` | `bg-purple-100` | `text-purple-800` | table |
| `paid` | `bg-emerald-100` | `text-emerald-800` | table, bill |
| `needs_cleaning` | `bg-gray-100` | `text-gray-800` | table |
| `placed` | `bg-slate-100` | `text-slate-800` | item |
| `accepted` | `bg-blue-100` | `text-blue-800` | item |
| `cooking` | `bg-orange-100` | `text-orange-800` | item |
| `ready` | `bg-yellow-100` | `text-yellow-800` | item |
| `served` | `bg-green-100` | `text-green-800` | item, order |
| `cancelled` / `no_show` / `refunded` | `bg-red-100` | `text-red-800` | item, reservation |
| `open` | `bg-slate-100` | `text-slate-800` | order |
| `partially_served` | `bg-sky-100` | `text-sky-800` | order |
| `fully_served` | `bg-green-100` | `text-green-800` | order |
| `billed` | `bg-purple-100` | `text-purple-800` | order, bill |
| `closed` | `bg-gray-100` | `text-gray-800` | order, bill |
| `booked` | `bg-blue-100` | `text-blue-800` | reservation |
| `seated` | `bg-green-100` | `text-green-800` | reservation |

**Note:** `StatusBadge.tsx` already centralizes these. Prefer `<StatusBadge status={...} />` over inline badge classes.

### 2.3 Typography

Use Tailwind scale only. No custom font imports unless explicitly requested.

| Purpose | Class | Notes |
|---------|-------|-------|
| Page title | `text-2xl font-bold` | `h1` inside the page wrapper |
| Section title | `text-lg font-semibold` | `h2` / `h3` |
| Card metric | `text-2xl font-bold` | large numbers, e.g. revenue total |
| Body | `text-sm` | default body text |
| Label | `text-xs font-medium text-muted-foreground` | form labels, table headers |
| Caption | `text-xs text-muted-foreground` | secondary metadata |

### 2.4 Spacing & layout

| Pattern | Class | Usage |
|---------|-------|-------|
| Page wrapper | `space-y-4` or `space-y-6` | every page root after the `main` tag |
| Page header | `flex items-center justify-between gap-4` | title left, controls right; stack on mobile with `flex-col sm:flex-row` |
| Section card | `rounded-lg border bg-card p-4 shadow-sm` | analytics cards, forms, lists |
| Inner card | `rounded-md border p-3` | smaller detail panels (table detail, bill line items) |
| Grid | `grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3` | dashboards, queues |
| Table grid | `grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5` | table grid on `TablesPage` |
| Tabs | `flex flex-wrap gap-2 border-b pb-2` | page tabs and floor tabs |
| Tab button | `rounded-md px-3 py-1.5 text-sm font-medium transition-colors` | active: `bg-primary text-primary-foreground`; inactive: `hover:bg-muted` |
| Form grid | `grid gap-3 sm:grid-cols-2 lg:grid-cols-4` | reservation/ setup forms |
| List | `divide-y rounded-md border` | simple list rows (setup lists, staff list) |
| List row | `flex items-center justify-between px-3 py-2` | row layout |

### 2.5 Shadows & radius

- Cards: `shadow-sm` (subtle) or `shadow` (modals/drawers).
- Hover lift: `hover:shadow-md` for interactive cards (`TableCard`, `MenuItemCard`).
- Radius: use `rounded-md` for inputs/buttons, `rounded-lg` for cards, `rounded-full` for badges.

### 2.6 Forms & inputs

**Standard input class**

```ts
const inputClass =
  "w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring";
```

Pages currently redefine this inline. Subagents should move it to `src/lib/styles.ts` (or keep a local constant) but the visual output must match.

**Rules**
- Every `label` gets `text-sm font-medium` and an `htmlFor`.
- Every `input`/`select` gets the standard class.
- Required fields show `border-destructive` on error; helper text below is `text-xs text-destructive`.
- Form submit buttons: `Button` component, `type="submit"`, full width on mobile with `w-full sm:w-auto`.

### 2.7 Buttons

Use `src/components/ui/button.tsx` variants only.

| Action | Variant | Size |
|--------|---------|------|
| Primary CTA (Save, Create, Send) | `default` | `default` or `sm` |
| Secondary / cancel | `outline` or `ghost` | `default` or `sm` |
| Destructive (Delete, Cancel) | `destructive` | `sm` or `default` |
| Icon-only action | `ghost` | `icon` or `sm` |
| Within list rows | `ghost` | `sm` |

### 2.8 Icons

- Set: `lucide-react`.
- Size: `h-4 w-4` in buttons/badges; `h-5 w-5` in page headers; `h-8 w-8` in empty states.
- Icon + text gap: `gap-2`.

---

## 3. Shared components design contract

These components exist today. Subagents may restyle them but must not change props without updating all callers.

| Component | Design target |
|-----------|---------------|
| `AppShell.tsx` | Keep fixed `w-64` left sidebar, white `bg-background`, `border-r`, `ml-64` main content. Add a subtle `shadow-sm` to the sidebar on `lg` screens. Nav active: `bg-primary text-primary-foreground`. Hover: `hover:bg-muted`. |
| `StatusBadge.tsx` | Use the status map above. Add `capitalize` display or keep underscore (`replace` not required). Ensure `role="status"`. |
| `TableCard.tsx` | Use `statusContainer` for border/background. Add `hover:shadow-md`, `focus:ring-2 focus:ring-ring`. Use `Users` icon for capacity. Keep reservation/merge/waiter lines. |
| `MenuItemCard.tsx` | Card with image placeholder area, name, price, variant chips. Disabled when stock-out: `opacity-50` with `cursor-not-allowed`. Add `+` icon CTA in bottom right. |
| `OrderTicket.tsx` | High-contrast ticket. Non-kitchen items: `bg-muted/40 opacity-50`. Item actions: small `Button` with clear state labels. |
| `CartSummary.tsx` | Sticky or bottom panel in drawer. Item list, modifiers, quantity stepper, total, `Send to Kitchen` CTA. |
| `BillBuilder.tsx` | Two-column on `lg`: items + totals. Discount/split/payment sections as `rounded-md border p-3` cards. Totals right aligned, `text-lg font-bold` for final total. |
| `DataTable.tsx` | `overflow-x-auto rounded-md border`. Header: `bg-muted text-muted-foreground`. Sortable columns show ▲/▼. Hover rows: `hover:bg-muted/50`. Empty state centered inside table. |
| `EmptyState.tsx` | Dashed border, `Inbox` icon or custom, centered. CTA via `action` prop. |
| `LoadingState.tsx` | Centered `Loader2` spinner with message. Use `h-48` inside panels, `min-h-screen` only for full page. |
| `NotificationBell.tsx` | Bell icon with `bg-destructive` badge. Dropdown list of recent notifications. |
| `NotificationToast.tsx` | `sonner` toasts with `info`, `success`, `error` styles matching status map. |
| `AnalyticsChart.tsx` | Consistent chart container `h-64`, `ResponsiveContainer`, `bg-card` wrapper. Use the 4-color `COLORS` array. |
| `AuditDiff.tsx` | Side-by-side or inline diff with `before` as `bg-destructive/10` and `after` as `bg-green-100`. Keys in `text-xs font-medium`, values in `text-sm`. |

---

## 4. Page-by-page design specs

All routes are in `src/app/routes.tsx`. Redesign each page to the following spec.

### 4.1 Login (`/login`)

- Full viewport: `flex min-h-screen items-center justify-center bg-background p-4`.
- Centered card: `w-full max-w-md rounded-lg border border-border bg-card p-8 shadow-sm`.
- Logo/brand: `text-2xl font-bold text-card-foreground`.
- Subtitle: `text-sm text-muted-foreground`.
- Form: stacked `space-y-4`, labels + selects.
- Primary CTA: `Button className="w-full"`.

### 4.2 Dashboard (`/` — currently `PlaceholderPage`)

- Page header: `Dashboard` title.
- Three `StatCard` style cards in a `grid`:
  - `Open orders`
  - `Reservations today`
  - `Active tables`
- Below: quick action links to role-appropriate destinations (`/tables`, `/reservations`, `/billing`).
- Empty: show setup CTA for admin.

### 4.3 Tables (`/tables`)

- Header: `text-2xl font-bold` title (`Tables` / `My Tables` by role) + optional floor selector.
- Floor tabs: `flex flex-wrap gap-2 border-b pb-2` with active/inactive tokens.
- Alert banner: `rounded-md p-3 text-sm` for messages (error: `bg-destructive/10 text-destructive`; success: `bg-green-100 text-green-800`).
- Table grid: `grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5` using `TableCard`.
- Drawer (right side): fixed overlay `fixed inset-0 z-50 flex justify-end bg-black/30`, inner panel `h-full w-full sm:w-96 border-l bg-background p-4 shadow-xl`.
  - Expand to `sm:w-[720px]` when menu open.
  - Header: `flex items-center justify-between` with `Close` ghost button.
  - Sections: table info card, waiter assignment, `TableOperations`, current order list, `Add Items` and `Request Bill` full-width buttons.

### 4.4 Reservations (`/reservations`)

- Header: title + no extra controls.
- New booking card: `rounded-md border p-4` with form `grid gap-3 sm:grid-cols-2 lg:grid-cols-4`.
- View tabs: `Today` / `Upcoming` using tab pattern.
- Reservation list: cards `rounded-md border p-4` with `sm:flex-row sm:items-center sm:justify-between`.
- Each card: guest name + status badge on left, phone/size/time/floor/table in body, action buttons on right.
- Actions: `Assign`, `Seat`, `No Show` (secondary), `Cancel` (destructive).

### 4.5 Menu (`/menu` — placeholder)

- Page header: `Menu` + category filter tabs.
- Grid: `grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4` of `MenuItemCard`.
- Empty: `EmptyState`.

### 4.6 Takeaway (`/takeaway`)

- Two-column layout on `lg`: left order builder, right cart/summary.
- Header: `Takeaway Orders`.
- Customer form: `rounded-md border p-4` with `grid gap-3 sm:grid-cols-2`.
- Active orders list: queue cards with customer/phone/items/status.
- `Mark All Ready` / `Bill & Pick Up` primary buttons.
- Payment: same `BillBuilder` pattern.

### 4.7 Kitchen (`/kitchen/:kitchenId`)

- Header: `Kitchen Board` + kitchen selector dropdown on right.
- Message banner same as Tables page.
- Tickets: `rounded-md border` per order.
- Ticket header: `border-b bg-muted/30 p-3` with order title and `TA` / `Dine-in` tag.
- Items grouped by KOT batch, `text-xs font-medium text-muted-foreground` batch label.
- Item row: `flex items-start justify-between rounded-md border p-2`.
- Non-kitchen items: `bg-muted/40 opacity-50`.
- Action button: `Button size="sm"` with `Accept` / `Start Cooking` / `Mark Ready` labels.
- Empty: `EmptyState`.

### 4.8 Kitchen Takeaway (`/kitchen/:kitchenId/takeaway`)

- Same header/ticket style as kitchen.
- Queue specifically for `takeaway` orders.
- Bottom `Mark All Ready` CTA only enabled when all items are `cooking`/`ready`.

### 4.9 Billing (`/billing`)

- Header: `Billing` + station selector.
- Two-stage layout:
  1. **Queue**: `grid gap-3 md:grid-cols-2 lg:grid-cols-3` of order cards.
     - Card: `rounded-md border p-4` with title, type, status badge, floor, total.
     - CTA: `Generate Bill` / `Open Bill`.
  2. **Bill builder** (when order selected): two columns on `lg`.
     - Left: `BillBuilder` with line items.
     - Right: discount, split, payment forms as `rounded-md border p-3` cards.
     - Totals: right-aligned, final total `text-lg font-bold`.
     - Close bill: full-width primary button at bottom.

### 4.10 Bill History (`/bills/history`)

- Header: `Bill History` + station selector.
- `DataTable` with columns: Bill #, Table/Customer, Date, Total, Status, Actions.
- Actions: `View` ghost icon button.
- Empty: `EmptyState`.

### 4.11 Bill Detail (`/bills/:id`)

- Header: `Bill {number}` + print icon button.
- Card layout: `rounded-lg border bg-card p-6 shadow-sm`.
- Receipt-style: restaurant name, bill #, date, line items table, taxes, discounts, total.
- Payment list and `Print` CTA.

### 4.12 Stock Out (`/stock-out`)

- Header: `Stock Out` + kitchen/floor filter.
- List of menu items in `DataTable` or card grid.
- Toggle: `Switch` (if shadcn switch is available) or `Button size="sm"` to mark out of stock.
- Out-of-stock row: `opacity-50` with `bg-red-100 text-red-800` badge.

### 4.13 Staff (`/staff`)

- Header: `Staff & Roles`.
- Tabs: `Staff` / `Permissions`.
- Staff tab:
  - New staff form in `rounded-md border p-4`.
  - Roles, floors, tables, kitchens as checkbox groups in `grid gap-4 sm:grid-cols-3`.
  - Staff list: `divide-y rounded-md border` rows with delete icon.
- Permissions tab:
  - One `rounded-md border p-4` card per role.
  - Permission grid `grid gap-2 sm:grid-cols-2 lg:grid-cols-3`.

### 4.14 Setup (`/setup`)

- Header: `Outlet Setup`.
- Tab bar for sub-sections: Org, Outlet, Floor, Kitchen, Billing, Table, Menu, Tax.
- Each section:
  - Add form in `rounded-md border p-4` using the form grid pattern.
  - List below using `divide-y rounded-md border`.
- Use `Plus` and `Trash2` icons for add/delete actions.

### 4.15 Settings (`/settings` — placeholder)

- Header: `Settings`.
- Section cards for Tax, Preferences, Organization.
- Use form inputs and save CTA.

### 4.16 Notifications (`/notifications`)

- Header: `Notifications`.
- Filter tabs: `All` / `Unread`.
- List: `divide-y rounded-md border`.
- Each row: icon per type, message, time, `Mark as read` / `Delete` actions.
- Unread: `bg-muted/50` or left `border-l-4 border-primary`.

### 4.17 Analytics (`/analytics`)

- Header: `Analytics` + date range inputs and granularity select on the right (`sm:flex-row`).
- Top KPI cards: `grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4`.
  - `rounded-lg border bg-card p-4 shadow-sm` with `text-sm text-muted-foreground` label and `text-2xl font-bold` value.
- Charts: `grid grid-cols-1 gap-6 lg:grid-cols-2`.
  - Each chart in `rounded-lg border bg-card p-4 shadow-sm` with `h-64`.
- Tables: same card style for best/worst dishes, staff, kitchen, etc.

### 4.18 Audit Logs (`/audit-logs`)

- Header: `Audit Logs`.
- Filter bar: entity type, staff, date range (compact form `grid gap-3 sm:grid-cols-4`).
- `DataTable` with columns: Time, Staff, Action, Entity, ID.
- Click row to open `AuditDiff` in a `rounded-md border p-4` detail panel or drawer.

### 4.19 Forbidden (`/forbidden`)

- Centered empty state with `Shield` icon, title `Access denied`, description, and `Go home` outline button.

### 4.20 Not Found (`*`

- Centered empty state with `FileQuestion` icon, title `Page not found`, description, and `Go home` outline button.

---

## 5. CSS additions to `frontend/src/index.css`

Add the following inside the `:root` block to expose new semantic tokens. They are not yet wired to Tailwind classes, but pages can use Tailwind equivalents (`bg-green-100`, etc.). Keep the existing `:focus-visible` rule.

```css
:root {
  /* existing tokens ... */

  --success: 142 76% 36%;
  --success-foreground: 0 0% 98%;
  --warning: 38 92% 50%;
  --warning-foreground: 0 0% 98%;
  --info: 217 91% 60%;
  --info-foreground: 0 0% 98%;
}
```

Optionally add a print utility for the bill detail page:

```css
@media print {
  aside, nav, .no-print {
    display: none !important;
  }
  main {
    margin-left: 0 !important;
    padding: 0 !important;
  }
  .print-receipt {
    box-shadow: none !important;
    border: none !important;
  }
}
```

---

## 6. Rules for parallel subagent work

1. **Start from this doc.** Read the relevant page file and this spec before editing.
2. **Do not invent new colors.** Use only the tokens and status map in Section 2.
3. **Use the components from Section 3.** If a component does not match, restyle the component, not every page.
4. **Preserve the page data and state logic.** Only change layout, spacing, colors, and typography.
5. **Do not add comments to explain design choices.** Code style is compact.
6. **After finishing a page, run `npm run build` in `frontend/`.** Fix any TS/Tailwind errors before declaring done.
7. **Update `IMPLEMENTATION_TODO.md` or `IMPLEMENTED.md` only if the spec itself changes.** Page-only CSS edits do not need backlog updates unless they add a new feature.
8. **Accessibility:** keep `aria-label`s, `role="status"`, and focus rings exactly as they exist today.

---

## 7. Suggested parallel task split

| Subagent | Page(s) / area | Notes |
|----------|----------------|-------|
| A | Global tokens + `index.css`, `AppShell`, `StatusBadge`, `DataTable`, `EmptyState`, `LoadingState` | Foundation first so others can use new classes. |
| B | `Login`, `Dashboard`, `NotFound`, `Forbidden`, `NotificationsPage` | Auth/empty-state flows. |
| C | `TablesPage`, `TableCard`, `TableOperations`, `MenuBrowser`, `MenuItemCard` | Floor operations and order drawer. |
| D | `ReservationsPage` | Booking list and actions. |
| E | `KitchenPage`, `KitchenTakeawayPage`, `OrderTicket`, `StockOutPage` | Kitchen ticket board. |
| F | `BillingPage`, `BillBuilder`, `BillHistoryPage`, `BillDetailPage` | Cashier flows and receipt. |
| G | `AnalyticsPage`, `AnalyticsChart` | Charts and KPIs. |
| H | `StaffPage`, `SetupPage`, `AuditLogsPage`, `AuditDiff` | Admin/management forms. |

---

*Last updated: 2026-08-31*
