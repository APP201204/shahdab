# Restaurant Management SaaS — React.js Implementation TODO

> Generated from `docs/workflow.md`, `docs/api_design_doc.md`, and `docs/db_schema.md`. The original `[Role Tabs doc]` referenced by `workflow.md` is still missing, but role and permission details are covered by the API and DB schema. **Per the latest direction:** subscription plans are ignored for now; notifications are strictly in-app (no browser push or external WebSocket). Real-time updates can be simulated with an in-app event bus.

---

## Roles

| Role | API shorthand | System scope |
|---|---|---|
| `admin` | `ADM` | Org owner; full access; manages organization, outlets, staff |
| `outlet_manager` | `OM` | Outlet-level admin; manages setup, staff, menu, analytics |
| `captain` | `CAP` | Floor/table operations, reservations, orders, table management, takeaway |
| `waiter` | `WTR` | Serves assigned tables, marks items `Served`, requests bills |
| `kitchen_manager` | `KM` | Owns kitchen board, item flow, stock-out |
| `cashier` | `CSH` | Floor billing station; bills, splits, payments, history |

---

## 1. Project setup & architecture

| # | What to build | Key implementation details | Dependencies / prerequisites | Acceptance criteria |
|---|---|---|---|---|
| 1.1 | Bootstrap React + TypeScript project | Use Vite; `strict` TypeScript; absolute imports (`@/`) | Node 18+, Vite, `typescript` | `npm run dev` and `npm run build` succeed |
| 1.2 | Install & configure Tailwind + shadcn/ui | `shadcn` init; base tokens; theme wrapper | `tailwindcss`, `shadcn/ui` CLI | shadcn components render correctly |
| 1.3 | Set up folder structure | `src/{app,components,pages,features,hooks,lib,types,mocks,services}` | — | Every feature has a predictable home |
| 1.4 | Add base utilities | `cn()` merge, date/currency formatting, timezone helpers | `clsx`, `tailwind-merge`, `date-fns` | No raw string/date formatting in components |
| 1.5 | Configure router | `react-router-dom` with `BrowserRouter`; protected route wrapper | `react-router-dom` | Routes load without reload; 404 exists |
| 1.6 | Define global state strategy | React Context for auth; Zustand for runtime data (orders, tables, notifications, audit) | `zustand` (optional) | State is accessible without prop drilling |
| 1.7 | In-app real-time event bus | `src/services/events.ts` — `on(event, cb)` / `emit(event, payload)` for kitchen tickets, table status, notifications | — | Component updates propagate without a backend |
| 1.8 | Mock service layer | `src/services/mockApi.ts` mirrors the API design endpoints; maps to in-memory data | — | Every feature uses `mockApi` instead of `fetch` |
| 1.9 | Configure linting & formatting | ESLint + Prettier; enforce import order and no `any` | `eslint`, `prettier` | `npm run lint` passes |

---

## 2. Data models & mock data

| # | What to build | Key implementation details | Dependencies / prerequisites | Acceptance criteria |
|---|---|---|---|---|
| 2.1 | Define TypeScript types from schema | `Organization`, `Outlet`, `Floor`, `Kitchen`, `BillingStation`, `Table`, `TableMergeGroup`, `TableTransfer`, `Reservation`, `Staff`, `Role`, `Permission`, `MenuCategory`, `MenuItem`, `MenuItemVariant`, `MenuItemFloorPrice`, `MenuItemStockStatus`, `Modifier`, `Order`, `KotBatch`, `OrderItem`, `OrderItemModifier`, `Tax`, `Bill`, `BillTax`, `BillSplit`, `BillSplitItem`, `Discount`, `Payment`, `Notification`, `AuditLog` | TypeScript | All types match the DB schema; all status fields use strict enums |
| 2.2 | Build mock in-memory database | `src/mocks/db.ts` exporting pre-seeded objects and lookup helpers | `nanoid` or `crypto.randomUUID` for IDs | Data is realistic and covers every workflow |
| 2.3 | Seed one complete demo org | Admin, 2 outlets, 2 floors, 3 kitchens, 1 billing station, 8 tables, 15 menu items, modifiers, variants, floor prices, 6 staff accounts, open/reserved tables, active orders | — | Login as any role and immediately see meaningful data |
| 2.4 | Implement mock persistence layer | `DataService` / `mockApi` with CRUD methods; all writes update the in-memory object | — | Every feature reads from the same in-memory store |
| 2.5 | Add tax / discount mock config | `Tax` table with `applicable_on: 'bill'|'item'`; `Discount` types `flat`/`percentage` | — | Bill calculations use configured rates |
| 2.6 | Seed notification and audit logs | Pre-populate a few notifications and audit entries so the feed and log pages are not empty | — | `/notifications` and `/audit-logs` show sample data |
| 2.7 | Add mock permissions matrix | Map each role to `Permission` codes; allow `admin` to edit per role later | — | RBAC uses permission codes, not just role names |

---

## 3. Authentication & role management

| # | What to build | Key implementation details | Dependencies / prerequisites | Acceptance criteria |
|---|---|---|---|---|
| 3.1 | Role-based login page | `src/pages/Login.tsx`; select organization slug (optional) and user; set `currentStaff` with `organization_id`, `outlet_id`, `roles[]` | `shadcn/ui` Select, Button | Login sets correct role and default outlet |
| 3.2 | AuthContext + `useAuth` hook | Exposes `staff`, `roles`, `outletId`, `can(permissionCode)` | — | Unauthorized access is blocked globally |
| 3.3 | Role guard component | `<PermissionGuard permission="..." fallback={<Forbidden/>} />` | — | Renders `Forbidden` when permission is missing |
| 3.4 | Multi-outlet role support | Staff object holds `staff_roles` + `staff_floor/table/kitchen_assignments`; active outlet selector | — | Switching outlet updates permissions and assignments in real time |
| 3.5 | Staff assignment data | Captains → floors; Waiters → tables; Kitchen Managers → kitchens | mock DB | Notifications and menus respect assignments |
| 3.6 | Mock logout / session expiry | Clear auth state; redirect to `/login` | — | Manual logout works |
| 3.7 | Notification feed page | `/notifications` list `notifications` for the logged-in staff; unread badge in nav | — | Users can mark notifications as read |

---

## 4. Routing & access control

| # | What to build | Key implementation details | Dependencies / prerequisites | Acceptance criteria |
|---|---|---|---|---|
| 4.1 | Define route map | `src/app/routes.tsx` with all protected routes and `requiredPermission` metadata | `react-router-dom` | Routes are declared in one place |
| 4.2 | Implement `<PrivateRoute>` | Checks auth; redirects to `/login` if not authenticated | AuthContext | `/tables` without login redirects |
| 4.3 | Implement `<PermissionRoute>` | Checks permission code; uses `<PermissionGuard>` | PermissionGuard | Admin can reach `/staff`, Waiter cannot |
| 4.4 | Default role-based redirect after login | Admin → `/setup`; Captain → `/tables`; Cashier → `/billing`; Kitchen Manager → `/kitchen/:id` | — | Post-login landing page matches role |
| 4.5 | Navigation sidebar / top bar | shadcn `Sidebar` or `Tabs`; items filtered by permission; notification bell with badge | `lucide-react`, `shadcn/ui` Nav | User only sees permitted nav links and unread count |

**Route list (aligned with API design):**

| Route | Purpose | Permission / Role |
|---|---|---|
| `/login` | Authentication | public |
| `/` | Outlet selector / dashboard | all |
| `/tables` | Live floor/table grid | CAP, WTR, OM, ADM |
| `/reservations` | Bookings and seating | CAP, OM |
| `/menu` | Order/menu browser (Captain) | CAP |
| `/takeaway` | Takeaway order creation | CAP |
| `/kitchen/:kitchenId` | Kitchen live ticket board | KM |
| `/kitchen/:kitchenId/takeaway` | Takeaway queue | KM |
| `/billing` | Cashier billing queue | CSH |
| `/bills/history` | Paid bill history | CSH, OM, ADM |
| `/bills/:id` | Bill detail / reprint | CSH, OM, ADM |
| `/stock-out` | Kitchen stock toggles | KM |
| `/staff` | Staff & role management | OM, ADM |
| `/setup` | Outlet/floor/kitchen/table/menu setup | OM, ADM |
| `/settings` | Tax, preferences | OM, ADM |
| `/notifications` | In-app notification feed | all |
| `/analytics` | Analytics dashboard | OM, ADM |
| `/audit-logs` | Audit trail | ADM |

---

## 5. Pages & features

### 5.1 Onboarding & setup

| # | What to build | Key implementation details | Dependencies / prerequisites | Acceptance criteria |
|---|---|---|---|---|
| 5.1.1 | Organization setup form | Create organization: name, slug, timezone, currency | shadcn Form, Input, Select | No subscription plan check (ignored) |
| 5.1.2 | Outlet setup form | Create outlet: name, address, timezone, currency | shadcn Form, Input, Select | Validates required fields |
| 5.1.3 | Floor management | Add floors under an outlet | — | Floors appear in table grid |
| 5.1.4 | Kitchen management | Add kitchens per outlet | — | Orders route by `kitchen_id` |
| 5.1.5 | Billing station setup | One per floor; assigned to Cashier | — | Validation prevents >1 per floor |
| 5.1.6 | Table management | Table number, capacity, floor assignment | — | Tables render in floor grid |
| 5.1.7 | Menu builder | Categories → items → variants (Full/Half/Family) → base price + per-floor overrides → `kitchen_id`; modifiers | — | Menu items scoped to kitchen and floor prices |
| 5.1.8 | Staff management page | Create staff: name/phone/credentials; assign roles per outlet; assign floor/table/kitchen | — | Staff appear in auth dropdown; roles scoped per outlet |
| 5.1.9 | Permissions matrix editor | Allow `admin` to toggle permissions per role | — | Permission changes take effect immediately |
| 5.1.10 | Tax settings | Add/edit `Tax` entries with `applicable_on` and percentage | — | Taxes available for bill calculation |

### 5.2 Reservations

| # | What to build | Key implementation details | Dependencies / prerequisites | Acceptance criteria |
|---|---|---|---|---|
| 5.2.1 | Reservations page | List today/upcoming; create booking: guest name, phone, party size, date/time, floor, optional table | shadcn Calendar, Dialog | Reservation created with `booked` status |
| 5.2.2 | Table reservation flags | Tables grid shows `reserved` at appropriate time | — | Visual flag appears before booking time |
| 5.2.3 | Seat / No Show / Cancel actions | Updates table status and reservation status | — | State machine: `booked → seated/cancelled/no_show` |
| 5.2.4 | Pending unassigned reservations | Display reservations without table; allow table assignment | — | Captain can assign a table later |

### 5.3 Dine-in orders

| # | What to build | Key implementation details | Dependencies / prerequisites | Acceptance criteria |
|---|---|---|---|---|
| 5.3.1 | Tables grid | Floor tabs, table cards with `vacant/reserved/occupied/bill_requested/paid/needs_cleaning` | — | Colors/badges reflect state machine |
| 5.3.2 | Table detail / order drawer | Tap table to view/manage current order and waiter assignment | — | Shows KOT batches and items |
| 5.3.3 | Menu browser (scoped) | `GET /floors/{id}/menu` — categories → items → variants, resolved to this floor's price, out-of-stock disabled | — | Only items for the table's floor are shown |
| 5.3.4 | Order summary / cart | Review items, modifiers, send to kitchen | — | Creates order + first `kot_batch` |
| 5.3.5 | Multi-KOT workflow | New batch for additional items; same order updated | — | Mid-meal orders append new batch |
| 5.3.6 | Order status derivation | Derived from item states: `open/partially_served/fully_served/billed/closed` | — | Status updates automatically |
| 5.3.7 | Item cancellation | Allow cancel only while `placed` or `accepted`; reject with `ITEM_ALREADY_COOKING` otherwise | — | Cancellation state logic correct |
| 5.3.8 | Request bill action | Table → `bill_requested`; creates notification for floor's cashier | — | Appears in billing queue and notification feed |
| 5.3.9 | Table merge | Select 2+ tables without active orders → create `table_merge_group`; render merged unit | — | Active order blocks merge |
| 5.3.10 | Table split | Release merge group if no active/unpaid order | — | Original tables revert to `vacant` |
| 5.3.11 | Table transfer | Move reservation/waiter from one vacant table to another | — | Rejects if source has active order or destination occupied |

### 5.4 Kitchen & stock

| # | What to build | Key implementation details | Dependencies / prerequisites | Acceptance criteria |
|---|---|---|---|---|
| 5.4.1 | Kitchen live board | Tickets by order/batch; non-kitchen items flagged `is_relevant: false` and greyed | — | KM can act only on own kitchen items |
| 5.4.2 | Item state transitions | `placed → accepted → cooking → ready` buttons per item | — | State machine enforced; logs `accepted_at`, `cooking_at`, `ready_at` |
| 5.4.3 | Waiter notifications on `Ready` | On `ready`, emit in-app notification to the assigned waiter | — | Notification appears in feed and (optional) toast |
| 5.4.4 | Stock-out toggles | `PATCH /menu-items/{id}/stock-status`; live disable in Captains' menu; emit event to all captains | — | Active order items unaffected |
| 5.4.5 | Takeaway queue | `GET /kitchens/{id}/takeaway-queue` — separate ticket list | — | Tagged with customer name/phone |
| 5.4.6 | Combined "Mark All Ready" (takeaway) | `PATCH /orders/{id}/mark-all-ready`; enabled only for takeaway when all items are cooking/ready | — | Notifies counter staff for pickup |

### 5.5 Takeaway

| # | What to build | Key implementation details | Dependencies / prerequisites | Acceptance criteria |
|---|---|---|---|---|
| 5.5.1 | Takeaway order page | Customer name + phone instead of table | — | Creates `order_type = takeaway` |
| 5.5.2 | Combined "Mark All Ready" | Only enabled when every item in all involved kitchens is `cooking`/`ready` | — | Notification fires for counter staff |
| 5.5.3 | Pickup flow | Mark order `picked_up` and close after billing | — | Order closes and bill attaches customer record |
| 5.5.4 | Takeaway billing | Same as dine-in, skip table cascade | — | Bill totals correctly |

### 5.6 Billing

| # | What to build | Key implementation details | Dependencies / prerequisites | Acceptance criteria |
|---|---|---|---|---|
| 5.6.1 | Bill requests queue | Cashier sees all `bill_requested` and `fully_served` orders for their floor's billing station | — | Queue updates on action |
| 5.6.2 | Bill builder | Add/remove items, apply item-level/bill-level `Discount`, compute `Tax` (`bill_taxes`), show subtotal/tax/total | — | Subtotal/taxes/total correct |
| 5.6.3 | Split bill | `POST /bills/{id}/splits` — `by_item` or `by_number`; `bill_splits` and `bill_split_items` tables | — | Creates sub-bills |
| 5.6.4 | Payment recording | `POST /bills/{id}/payments` — Cash/Card/UPI/Wallet; multiple methods per `bill_split_id` or bill | — | Total payments must match total due before close |
| 5.6.5 | Close bill | `POST /bills/{id}/close`; order → `closed`, table → `needs_cleaning` | — | Cannot close if payment mismatch |
| 5.6.6 | Bill history | `GET /billing-stations/{id}/bills` — list paid bills with reprint view | — | Reprint renders printable receipt payload |
| 5.6.7 | Receipt print preview | Display `POST /bills/{id}/reprint` payload as a printable modal | — | Receipt content matches bill splits/payments/taxes |

### 5.7 Waiter actions

| # | What to build | Key implementation details | Dependencies / prerequisites | Acceptance criteria |
|---|---|---|---|---|
| 5.7.1 | My tables view | `GET /staff/me/tables` — tables assigned to the logged-in waiter with live status | — | Waiter sees only assigned tables |
| 5.7.2 | Mark item served | `PATCH /order-items/{id}/serve` — sets `served` and `served_by` | — | Item moves to `served`; order status recalculates |
| 5.7.3 | Request bill from table | `POST /tables/{id}/request-bill` | — | Table → `bill_requested`, cashier notified |

### 5.8 Analytics (OM / ADM only)

| # | What to build | Key implementation details | Dependencies / prerequisites | Acceptance criteria |
|---|---|---|---|---|
| 5.8.1 | Analytics dashboard | Page with date range and granularity filters | `recharts` or similar | OM/ADM can view metrics |
| 5.8.2 | Best/worst dishes | Top/bottom N by quantity and revenue | — | Derived from `order_items` |
| 5.8.3 | Revenue trends | Daily/weekly/monthly/annual trend series | — | Chart renders from bills |
| 5.8.4 | Per-item and per-category performance | Earnings, discount totals, quantities | — | Aggregated correctly |
| 5.8.5 | Staff performance | Orders served, average turnover time per staff | — | Derive from `served_by` and `closed_at` |
| 5.8.6 | Kitchen efficiency | Average prep time `ready_at - accepted_at` per kitchen/dish | — | Calculated per `order_item` |
| 5.8.7 | Table turnover | Average dining duration per table/floor | — | Derive from `orders.created_at` and `closed_at` |
| 5.8.8 | Peak hours and payment method split | Order volume heatmap and payment method split | — | Useful charts render |
| 5.8.9 | Voids & discounts report | Discount frequency/value by staff | — | Audit + discount data combined |

### 5.9 Audit (ADM only)

| # | What to build | Key implementation details | Dependencies / prerequisites | Acceptance criteria |
|---|---|---|---|---|
| 5.9.1 | Audit log page | `GET /audit-logs` with filters: entity type, staff, date range | — | ADM can view full trail |
| 5.9.2 | Audit log entries | Log discounts, item cancels, table merges/splits/transfers, stock toggles | — | Every sensitive action creates an `audit_log` with `before_json` and `after_json` |
| 5.9.3 | Audit detail drawer | Show JSON diff for a selected log entry | — | Before/after state is human-readable |

---

## 6. Reusable UI components

| # | What to build | Key implementation details | Dependencies / prerequisites | Acceptance criteria |
|---|---|---|---|---|
| 6.1 | `<StatusBadge>` | `table`, `order`, `item`, `bill`, `reservation` variants | shadcn Badge | Colors match each state |
| 6.2 | `<TableCard>` | Shows table number, capacity, status, assigned waiter, merged label | — | Click opens table detail |
| 6.3 | `<OrderTicket>` | Used in kitchen; shows full order, greys non-kitchen items, state controls | — | Kitchen-specific interaction |
| 6.4 | `<MenuItemCard>` | Image (optional), name, variants, price, stock-out state, add button | — | Disabled when out of stock |
| 6.5 | `<CartSummary>` | List of added items, variant/modifier, totals | — | Send to Kitchen triggers batch |
| 6.6 | `<BillBuilder>` | Line items, `Discount`, `Tax`, `BillSplit`, `Payment` inputs | shadcn Table, Input | Totals update reactively |
| 6.7 | `<NotificationBell>` | Bell icon with unread count; dropdown of recent in-app notifications | `sonner` or shadcn Toast + Popover | Badge and feed work |
| 6.8 | `<NotificationToast>` | In-app toast for item ready, bill requested, out of stock | `sonner` or shadcn Toast | Displays mapped notification types |
| 6.9 | `<Forbidden>` / `<NotFound>` | Empty/error state pages | — | Clear messaging |
| 6.10 | `<DataTable>` generic | For staff, bills, reservations, notifications, audit | `shadcn/ui` Table | Sortable columns, empty state |
| 6.11 | `<AnalyticsChart>` | Reusable line/bar/pie chart wrapper | `recharts` | Consistent chart styling |
| 6.12 | `<AuditDiff>` | Render `before_json` / `after_json` diff | — | JSON changes are readable |

---

## 7. Validation & error/empty/loading states

| # | What to build | Key implementation details | Dependencies / prerequisites | Acceptance criteria |
|---|---|---|---|---|
| 7.1 | Form validation schemas | Zod schemas for org, outlet, staff, reservation, order, bill, payment | `zod`, `react-hook-form` | All forms reject invalid input |
| 7.2 | API-style error responses | `mockApi` returns `{ data, error: { code, message }, meta }` (e.g. `TABLE_HAS_ACTIVE_ORDER`, `ITEM_ALREADY_COOKING`) | — | Components show human-readable messages |
| 7.3 | Loading states | Skeleton screens for async-looking operations | `shadcn/ui` Skeleton | No jarring blank screens |
| 7.4 | Empty states | No tables, no orders, no bills, no reservations | — | Helpful CTA when empty |
| 7.5 | Error boundaries | React Error Boundary around route shell | — | Crashes show fallback UI, not white screen |
| 7.6 | Confirmation dialogs | Destructive actions: cancel item, close bill, merge/split, delete staff | shadcn AlertDialog | User must confirm before irreversible action |

---

## 8. Testing

| # | What to build | Key implementation details | Dependencies / prerequisites | Acceptance criteria |
|---|---|---|---|---|
| 8.1 | Unit tests for state machines | Table, order, item, bill, reservation status transitions | `vitest` | All transitions tested |
| 8.2 | Unit tests for `mockApi` and `DataService` | CRUD, stock-out, merge/split guard, cancellation guard, bill math | `vitest` | Passes with edge cases |
| 8.3 | Component tests for login / RBAC | `render` with `AuthProvider`; assert role-based redirects | `@testing-library/react`, `vitest` | Passes for all roles |
| 8.4 | Component tests for key workflows | Create order, mark ready, bill close, takeaway mark-all-ready | `@testing-library/user-event` | User-flow tests pass |
| 8.5 | Visual smoke test | One `npm run build` and preview | — | Production build succeeds |
| 8.6 | Manual role walkthrough checklist | Documented in a scratchpad or README | — | Every role can log in and perform primary actions |

---

## 9. Final polish & verification

| # | What to build | Key implementation details | Dependencies / prerequisites | Acceptance criteria |
|---|---|---|---|---|
| 9.1 | README with run instructions | `npm install`, `npm run dev`, mock login credentials per role | — | New dev can run in 2 minutes |
| 9.2 | Mock credential cheat sheet | List of seeded users and roles | — | No need to read code to log in |
| 9.3 | Final build & type check | `tsc --noEmit` and `npm run build` | — | Zero TypeScript/build errors |
| 9.4 | Accessibility pass | Keyboard navigation, focus management, ARIA labels on status badges | — | Login and main flows keyboard-navigable |
| 9.5 | Responsive sanity check | Mobile-width table grid and kitchen board are usable | — | Core flows work on 375px width |
| 9.6 | Final review against docs | Re-read all three docs; confirm every section is represented in code or intentionally out-of-scope | — | Gaps are either built or documented |

---

## Role × page access matrix

| Page / Feature | Admin | Outlet Manager | Captain | Waiter | Kitchen Manager | Cashier |
|---|---|---|---|---|---|---|
| Login | Y | Y | Y | Y | Y | Y |
| Outlet selector / dashboard | Y | Y | Y | Y | Y | Y |
| Setup: organization, outlets, floors, kitchens | Y | Y | — | — | — | — |
| Setup: billing stations, tables, menu, taxes | Y | Y | — | — | — | — |
| Staff management / permissions | Y | Y | — | — | — | — |
| Tables grid | Y | Y | Y | view | — | — |
| Reservations | Y | Y | Y | — | — | — |
| Menu (order browser) | Y | Y | Y | — | — | — |
| Takeaway | Y | Y | Y | — | — | — |
| Order detail / KOT | Y | Y | Y | view | — | — |
| Table merge / split / transfer | Y | Y | Y | — | — | — |
| My tables (waiter) | — | — | — | Y | — | — |
| Mark item `Served` | — | — | — | Y | — | — |
| Request bill from table | — | — | Y | Y | — | — |
| Kitchen board | — | — | — | — | Y | — |
| Stock-out | — | — | — | — | Y | — |
| Billing queue | — | — | — | — | — | Y |
| Bill builder / split / payment / close | Y | Y | — | — | — | Y |
| Bill history / reprint | Y | Y | — | — | — | Y |
| Notification feed | Y | Y | Y | Y | Y | Y |
| Analytics | Y | Y | — | — | — | — |
| Audit logs | Y | — | — | — | — | — |

**Legend:** `Y` = can create/manage; `view` = read-only or limited interaction; `—` = no access.

---

## Ambiguous or missing requirements

1. **Role Tabs doc still missing**: `docs/workflow.md` references a `[Role Tabs doc]` that was not found. The API and DB schema provide enough role/permission detail, so the matrix above was derived from them.
2. **Subscription plans ignored**: Per the latest direction, `subscription_plans`, `max_outlets`, `max_staff` checks, and SaaS billing are out of scope for now. Organization creation is still a setup step, but no plan enforcement is implemented.
3. **Notifications are in-app only**: No browser push or service worker. Real-time updates are simulated with an in-app event bus. The original doc mentioned WebSocket for kitchen tickets and live table status — this is mocked locally.
4. **Live table transfer**: API doc and workflow explicitly limit transfer to tables with no active order. A "live transfer" of an in-progress order is an open future workflow.
5. **Order item cancellation refund/comping**: Comping after serving is out of scope; cancellation removes the item from the bill only while `placed` or `accepted`.
6. **Tax calculation details**: The DB schema supports `applicable_on: 'bill'|'item'`, but exact ordering of discount-before-tax vs tax-before-discount is not specified. Assumed: discount applied first, then taxes on the discounted amount.
7. **Table auto-release to `vacant` after `needs_cleaning`**: No auto-timer specified; manual confirm by waiter/captain for the first pass.
8. **Multi-payment on a single sub-bill / bill**: Allowed by API and schema, but the exact UI (e.g. adding partial payment rows) is not specified.
9. **Print receipt format**: `POST /bills/{id}/reprint` returns a "print-ready payload," but no layout/fonts are defined. Build a simple printable modal.
10. **Analytics implementation**: Schema notes say analytics are views/aggregations, not tables. Decide whether to compute on demand in the frontend from the in-memory store or pre-aggregate.
