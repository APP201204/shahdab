# RestaurantOS Clone — Devin Build Prompts
Source reference: https://shahdab.lovable.app/ (Lovable app — "SHADAB RestaurantOS")
Stack: React (frontend) + .NET (backend, ASP.NET Core Web API) + PostgreSQL (database)

Feed these prompts to Devin **in order**, one per session/task. Each phase builds on the previous one. Adjust naming ("Shadab" / restaurant name) as needed — the prompts keep it generic where possible but call out the reference branding so the UI matches.

---

## PHASE 0 — Project setup & architecture

```
Create a new full-stack restaurant point-of-sale and management system called "RestaurantOS", cloned in structure and UI from a reference app at https://shahdab.lovable.app/ (I'll paste page-by-page details in later prompts).

Set up the repo as a monorepo with two top-level folders:
- /backend — ASP.NET Core 8 Web API (C#), Clean Architecture style (Api, Application, Domain, Infrastructure layers)
- /frontend — React 18 + TypeScript, Vite, TailwindCSS, React Router v6, TanStack Query for data fetching, Zustand (or Context) for local UI state

Backend requirements:
- PostgreSQL as the database, accessed via EF Core (Npgsql provider)
- EF Core Code-First migrations
- Repository/Service pattern in Application layer, Controllers in Api layer are thin
- JWT-based authentication (login endpoint returns access token), with a seeded demo user (username "shadab", password to be set), role-based authorization (Admin, Manager, Cashier, Waiter, Kitchen)
- Global error handling middleware returning consistent JSON error shape
- Swagger/OpenAPI enabled in development
- CORS configured to allow the frontend origin
- appsettings.json with a Postgres connection string placeholder; docker-compose.yml that spins up a Postgres 16 container plus the API

Frontend requirements:
- TypeScript strict mode
- TailwindCSS with a design token setup (CSS variables) so each "section" (restaurant room/counter) can later override brand colors
- A shared layout component: fixed left sidebar navigation + top header, matching a POS-style back-office app
- Axios or fetch wrapper with base URL from env var, attaching the JWT to requests
- React Router routes stubbed out (empty pages for now) for: /, /table-service, /quick-order, /kitchen, /delivery, /tables, /menu, /sections, /billing-stations, /reports, /login

Deliverable: a running skeleton — `docker-compose up` starts Postgres + API, `npm run dev` starts the frontend, login page works against a seeded user, and the sidebar navigates between empty placeholder pages.
```

---

## PHASE 1 — Data model & database schema

```
Design and implement the PostgreSQL schema (via EF Core migrations) for RestaurantOS with these entities and relationships:

- Restaurant (Id, Name, Tagline, LogoUrl) — e.g. Name "SHADAB", Tagline "The Taste of Hyderabad"
- Section (Id, RestaurantId FK, Name, Type [DineIn | Takeaway], ServiceChargePercent decimal, BrandingMode [RestaurantDefault | OwnColours], PrimaryColor, LogoOverrideUrl, DisplayOrder)
  - Seed 6 sections: Dine In (DineIn, 0%), Mezzanine (DineIn, 0%), Aiwan-e-Khas (DineIn, 10%, own branding), AC Takeaway (Takeaway, 0%), AK Takeaway (Takeaway, 0%), Cafe (Takeaway, 0%, own branding)
- DiningTable (Id, SectionId FK, Number int, Seats int, Status [Available | Occupied | Reserved | NeedsCleaning])
  - Seed 12 tables distributed across Dine In / Mezzanine / Aiwan-e-Khas per the reference (table 1-4,11-12 = Dine In; 5-7 = Mezzanine; 8-10 = Aiwan-e-Khas)
- MenuCategory (Id, RestaurantId FK, Name, DisplayOrder) — seed: Biryani, Veg Soups, Non Veg Soups, Veg Starters, Non Veg Starters, Sea Food Kebabs, Breads, Curries, Beverages, Desserts
- MenuItem (Id, CategoryId FK, Name, IsSpicy bool, BaseAvailabilityStatus [Available | Unavailable | Disabled], IsMrpTaxInclusive bool)
- MenuItemVariant (Id, MenuItemId FK, Name e.g. "Regular"/"Dum"/"Family Pack"/"Standard", Price decimal)
- MenuItemSectionAvailability (Id, MenuItemId FK, SectionId FK, Status [Available | Unavailable | NotOffered]) — lets an item be available in some sections and "not offered" in others
- Session/Bill (Id, SectionId FK, DiningTableId FK nullable [null for takeaway/delivery], BillNumber string, GuestName string nullable, Status [Open | Placed | Billing | Completed | Cancelled], SubtotalPreTax, TaxAmount, ServiceChargeAmount, RoundingAdjustment, DiscountAmount, CreditNoteAmount, Total, PaymentMethod [Cash | Card | UPI] nullable, CreatedAt, ClosedAt)
- OrderLineItem (Id, SessionId FK, MenuItemVariantId FK, Quantity int, UnitPrice decimal, Notes string nullable e.g. "Extra spicy", Status [OnTable | Placed])
- KitchenOrderTicket / KOT (Id, SessionId FK, KotNumber string e.g. "KOT-812", DiningTableId FK nullable, SectionId FK, Status [New | Cooking | Ready | Bumped], CreatedAt)
- KotLineItem (Id, KotId FK, OrderLineItemId FK, Quantity, Notes)
- DeliveryOrder (Id, BillNumber, CustomerName, Area, RiderName, ItemCount int, Total decimal, PlacedAt time, Status [Packing | Dispatched | Delivered])
- BillingStation (Id, RestaurantId FK, Name, IsActive bool, Description)
- BillingStationSection (BillingStationId FK, SectionId FK) — many-to-many
- Discount (Id, RestaurantId FK, Name, Type [Percent | Flat], Value decimal, IsActive bool)
- Expense (Id, RestaurantId FK, Description, Amount, Date)
- CreditNote (Id, SessionId FK nullable, Amount, Reason, IsOwed bool)
- User (Id, Username, PasswordHash, DisplayName, Role)

Add EF Core configuration classes for each entity (fluent API), proper indexes (e.g. Section+Status on DiningTable, SessionId on OrderLineItem/KOT), and a DbSeeder that seeds realistic demo data matching these reference numbers so the UI looks identical to the source app:
- Menu: Mutton Biryani (3 variants: Regular ₹480, Dum ₹?, Family Pack ₹1150), Chicken Biryani (4 variants ₹400-₹980), Veg Dum Biryani (2 variants ₹320-₹760), Mutton Marag (Regular/Mini ₹120-₹180), Chicken Hot & Sour Soup ₹150, Sweet Corn Soup ₹130, Paneer 65 (Half/Full ₹160-₹260), Hara Bhara Kebab ₹240 (unavailable), Chicken 65 (Half/Full ₹180-₹290), Shadab Special Boti Kebab ₹360, Prawn Tawa Kebab ₹420, Fish Tikka ₹390 (not offered in current section filter), Rumali Roti ₹30, Tandoori Roti (Plain/Butter ₹25-₹35), Butter Chicken ₹380, Dal Tadka ₹210, Mineral Water 1L ₹20 (MRP tax inclusive), Irani Chai ₹40, Double Ka Meetha ₹140, Qubani Ka Meetha ₹150 (disabled)
- Sections service charge: Aiwan-e-Khas 10%, all others 0%
- Billing stations: "Main Counter" (Dine In + Mezzanine), "Banquet Desk" (Aiwan-e-Khas), "Parcel Counter" (AC Takeaway + AK Takeaway + Cafe)

Run the migration against the docker Postgres instance and confirm the seed data loads correctly.
```

---

## PHASE 2 — Backend API endpoints

```
Implement REST API controllers/endpoints in the ASP.NET Core backend for RestaurantOS, all returning JSON, all requiring JWT auth except /api/auth/login:

Auth
- POST /api/auth/login → { token, user }

Dashboard
- GET /api/dashboard/summary?date=YYYY-MM-DD → total revenue, % change vs prior period, tax/service/rounding breakdown, net revenue (minus credit notes), payment method breakdown with amounts and % change, financial adjustments (discounts, credit notes owed, expenses), total sessions with completed/cancelled/item counts
- GET /api/dashboard/revenue-breakdown?granularity=hourly
- GET /api/dashboard/dish-performance?type=best|worst&limit=5
- GET /api/dashboard/section-revenue → per-section revenue, bill count, percentage of total

Sections
- GET/POST/PUT/DELETE /api/sections
- GET /api/sections/{id}

Tables
- GET /api/tables?sectionId= → tables with live status and current KOT/item counts for occupied ones
- POST /api/tables/{id}/seat-guests { guestName, partySize }
- POST /api/tables/{id}/reserve
- POST /api/tables/{id}/mark-vacated
- POST /api/tables/{id}/mark-clean
- GET /api/tables/summary → total/occupied/available/other counts

Menu
- GET /api/menu-categories
- POST/PUT/DELETE /api/menu-categories
- GET /api/menu-items?sectionId=&categoryId= → items with variants and per-section availability status
- POST/PUT/DELETE /api/menu-items
- PATCH /api/menu-items/{id}/availability { sectionId, status }
- GET /api/menu/summary → total items, available, unavailable, not-offered, disabled counts

Table Service (dine-in POS)
- GET /api/table-service/tables (same as tables but filtered to active session summary: item count + KOT count shown as badges)
- GET /api/table-service/session/{tableId} → current open session with line items grouped, subtotal
- POST /api/table-service/session/{tableId}/items { menuItemVariantId, quantity, notes }
- PUT /api/table-service/session/{tableId}/items/{lineItemId}
- DELETE /api/table-service/session/{tableId}/items/{lineItemId}
- POST /api/table-service/session/{tableId}/send-to-kitchen → creates a KOT from "OnTable" items, marks them "Placed"
- POST /api/table-service/session/{tableId}/move-to-billing

Quick Order (takeaway/counter, multi-draft)
- GET /api/quick-order/drafts → list of held draft orders ("Active Orders")
- POST /api/quick-order/drafts → create new draft
- GET /api/quick-order/drafts/{id}
- POST /api/quick-order/drafts/{id}/items
- DELETE /api/quick-order/drafts/{id}
- GET /api/quick-order/favorites → items flagged as favorites
- GET /api/quick-order/recent-bills

Kitchen Display
- GET /api/kitchen/kots?status=all → open KOTs sorted oldest-first, with table/section, items, notes, age in minutes, status (new/cooking/ready)
- POST /api/kitchen/kots/{id}/start-cooking
- POST /api/kitchen/kots/{id}/mark-ready
- POST /api/kitchen/kots/{id}/bump
(Consider SignalR hub /hubs/kitchen for live push updates so KDS and Table Service refresh without polling.)

Delivery
- GET /api/delivery/orders?status= → bill no, customer, area, rider, item count, total, placed time, status
- POST /api/delivery/orders/{id}/dispatch
- POST /api/delivery/orders/{id}/mark-delivered

Billing Stations
- GET/POST/PUT/DELETE /api/billing-stations
- POST /api/billing-stations/{id}/open — returns sessions routed to this station's assigned sections

Reports
- GET /api/reports/sales?range=today|week|month&sectionId= → total revenue, sessions, net revenue, taxes & charges breakdown, sales trend series, sales by category (sessions, items, avg, total, discount, net)
- GET /api/reports/sessions
- GET /api/reports/cancellations
- GET /api/reports/discounts (CRUD for Discount entity)
- GET /api/reports/returns
- GET /api/reports/export?type=excel → returns an .xlsx file (use ClosedXML or EPPlus)

For every list/summary endpoint, write integration tests using WebApplicationFactory + a Testcontainers Postgres instance, seeding minimal fixture data and asserting shapes match the DTOs. Document all endpoints in Swagger with example responses.
```

---

## PHASE 3 — Frontend: Dashboard page

```
Build the Dashboard page (route "/") in the React frontend to visually match this reference layout from https://shahdab.lovable.app/ :

Header area: page greeting "Hi, {user.displayName}!" with today's date below it.

Top stat cards row:
1. "Total Revenue" big currency figure (₹ formatted with Indian digit grouping, e.g. ₹5,52,823.00), a small green "+8.4%" delta badge, a caption line "Taxes: ₹26,325 · Service: ₹12,140 · Rounded: ₹118", and a secondary line "Net Revenue (− ₹3,400 credit notes) ₹5,49,423.00"
2. "Payment Methods" card listing Cash / Card / UPI each with amount and a colored +/- % delta
3. "Financial Adjustments" card listing Discounts, Credit Notes (with "(Owed ₹X)" sub-label), Expenses
4. "Total Sessions" card with big count, and sub-line "X completed · Y cancelled · Z items"

Below that, a two/three-column section:
- "Revenue breakdown" card with an "Hourly" tab/toggle and a bar or line chart (use Recharts) of revenue by hour
- "Dish Performance" card with "Best 5" / "Worst 5" toggle tabs, showing a ranked list of dish name + revenue
- "Section Revenue" card listing each section (Dine In, Aiwan-e-Khas, Mezzanine, AC Takeaway, AK Takeaway, Cafe) with revenue, bill count, and percentage of total, rendered as a horizontal bar or progress-style row

Wire all of this to GET /api/dashboard/summary, /revenue-breakdown, /dish-performance, /section-revenue using TanStack Query. Use skeleton loaders while fetching. Format all currency using Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).

Match the visual style: dark sidebar with restaurant logo initials avatar ("SH"), restaurant name "SHADAB" + tagline "The Taste of Hyderabad" under it, a "Live" status pill with green dot and "SW" badge in the top-right of the sidebar header, grouped nav sections with small uppercase labels ("Operations", "Tables & Guests", "Menu", "Finance") each containing their route links, and a "Logout" link at the bottom. Use a clean, modern SaaS aesthetic — soft shadows, rounded-xl cards, subtle borders, a warm accent color fitting a Hyderabadi restaurant brand (deep maroon/gold accents) rather than generic blue.
```

---

## PHASE 4 — Frontend: Table Service (dine-in POS)

```
Build the Table Service page (route "/table-service") to match https://shahdab.lovable.app/table-service :

Layout: three-pane POS screen.
- Left/top strip: a horizontal scrollable grid of table cards (Table 1, Table 2, ... Table 12), each showing table number, its section name (Dine In / Mezzanine / Aiwan-e-Khas), and if occupied a small badge row showing item count and "KOT n" count (e.g. "3 · KOT 5"). Empty tables just show "0". Clicking a table selects it and loads its session into the right-hand order panel.
- Middle pane: category filter chips ("All Items", "Favorites", then each MenuCategory: Biryani, Veg Soups, Non Veg Soups, Veg Starters, Non Veg Starters, Sea Food Kebabs, Breads, Curries, Beverages, Desserts). Below, a grid/list of menu items for the selected category — items with multiple variants show "N variants" instead of a single price and open a variant picker on click; single-variant items show price directly; out-of-stock items show a muted "Out of Stock" tag and are unclickable.
- Right pane ("Table N" panel): header with table number, section, guest name if seated, and a live count like "3 Orders in Kitchen". Below it, grouped order lines: items already sent to kitchen under a "Placed"/"On Table" status tag with quantity × unit price = line total, and any notes (e.g. "Extra spicy") shown indented. Footer shows "Subtotal (pre-tax)" total and a primary "Move to Billing" button, plus a "Send to Kitchen" action for newly added OnTable items.

Behavior:
- Selecting a table calls GET /api/table-service/session/{tableId}
- Clicking a menu item (or choosing a variant) adds a line item via POST .../items, optimistically updating the right panel
- "Send to Kitchen" calls POST .../send-to-kitchen and shows a toast confirming a new KOT was created
- "Move to Billing" calls POST .../move-to-billing and navigates or shows a success state

Use TanStack Query mutations with optimistic updates + invalidation. Keep the table grid auto-refreshing (poll every 5-10s or subscribe via SignalR) so KOT/item counts stay live across cashier/waiter screens.
```

---

## PHASE 5 — Frontend: Quick Order, Kitchen Display, Delivery

```
Build three more pages in the React frontend, matching https://shahdab.lovable.app/quick-order , /kitchen , /delivery :

1) Quick Order ("/quick-order")
- Same category chip filter bar as Table Service, sourced from GET /api/menu-categories
- "Active Orders" panel with a "New" button to start a fresh draft; shows "No active orders" empty state when there are none, otherwise a list of draft chips/tabs
- "Favorites" grid showing favorite-flagged items with name and price
- "Order Panel" on the right with "Recent Bills" access; shows "No draft selected — create or select a draft to start adding items." empty state, and once a draft is active, shows the same line-item list / subtotal / checkout UI pattern as Table Service but without a table attached (counter sale)
- Wire to GET/POST /api/quick-order/drafts, /favorites, /recent-bills

2) Kitchen Display ("/kitchen")
- Title "Kitchen Display" with subtitle "Live KOT queue — oldest tickets first, bump when plated."
- A responsive grid of KOT ticket cards, each showing: KOT number (e.g. "KOT-812"), origin ("Table 1 · Dine In" or "Counter · AC Takeaway"), a status pill (new / cooking / ready — color-coded, e.g. blue/amber/green), a bulleted list of items with quantity ("Mutton Biryani (Dum) × 2") and any special notes indented below an item ("Extra spicy"), an "Xm ago" age timestamp, and a primary action button that changes by status: "Start cooking" (new→cooking), "Mark ready" (cooking→ready), "Bump" (ready→bumped/cleared)
- Sort tickets oldest-first always. Auto-refresh via polling (5s) or SignalR hub subscription so tickets appear instantly when Table Service / Quick Order sends to kitchen.
- Wire buttons to POST /api/kitchen/kots/{id}/start-cooking|mark-ready|bump

3) Delivery ("/delivery")
- Title "Delivery" with subtitle "Orders going out for delivery — packing, dispatch and completion."
- A data table with columns: Bill No., Customer, Area, Rider, Items, Total, Placed (time), Status (packing/dispatched/delivered as colored pill), Action (button label changes: "Dispatch" while packing, "Mark delivered" while dispatched, disabled/hidden once delivered)
- Wire to GET /api/delivery/orders and the dispatch/mark-delivered POST endpoints, refetching the list after each action

Keep consistent spacing, card styles and color system with the Dashboard and Table Service pages already built. Use the same sidebar/header shell across all pages (shared Layout component).
```

---

## PHASE 6 — Frontend: Table Management, Menu Management, Sections, Billing Stations

```
Build the remaining setup/back-office pages, matching https://shahdab.lovable.app/tables , /menu , /sections , /billing-stations :

1) Table Management ("/tables")
- Title + subtitle "Floor plan, statuses and seating for every room."
- 4 summary stat tiles: Total Tables, Occupied, Available, Other
- A note line: "New tables will be created in the \"Dine In\" section."
- A grid of table cards, each showing a numbered badge, "Table N", "{seats} seats · {Section}", a status pill (Occupied / Available / Needs Cleaning / Reserved, color-coded — e.g. red=occupied, green=available, amber=needs cleaning), and contextual action buttons: Occupied → "Mark Vacated"; Available → "Seat Guests" + "Reserve"; Needs Cleaning → "Mark Clean"
- Wire to GET /api/tables, /api/tables/summary and the seat-guests/reserve/mark-vacated/mark-clean endpoints; open a small modal for "Seat Guests" to capture guest name + party size

2) Menu Management ("/menu")
- Breadcrumb-style label "RestaurantOS · Catalog · Menu", title "Menu Management", subtitle
- Action buttons top-right: "Manage Categories", "Add Category", "Customize", "Add item"
- 4 summary stat tiles: Total Items (in catalog), Available (on sale now), Unavailable (temporarily 86'd), Not Offered (not on this section's menu) — plus consider a 5th for Disabled (hidden everywhere)
- Section filter chip bar: "All sections" + each section name, filters the table below by per-section availability
- A data table: columns Item (with a colored initial-letter avatar, item name, variant count label like "3 sizes", and a status word available/unavailable/not offered/disabled), Category, Price (single value or "₹X–₹Y" range across variants), Variant availability (chips listing variant names e.g. "Regular Dum Family Pack"), Actions (edit/menu icon)
- Wire to GET /api/menu-items?sectionId=, /api/menu/summary, PATCH availability endpoint from a row action menu

3) Sections ("/sections")
- Label "Setup · Sections", title "Sections", subtitle
- Filter chips: All / Dine In / Takeaway
- 3 summary tiles: Sections count ("3 dine in · 3 takeaway"), Service Charge ("1 section(s) charge service" if Mixed), Own Branding count ("rooms with their own look")
- Grid of section cards: colored initial-letter avatar, section name + type badge, one-line description, branding line ("Own colours · restaurant logo" or "Restaurant default · no section branding"), service charge % badge, and a "Customize" button opening an edit modal/drawer (name, type, service charge %, branding toggle + color picker, logo upload)
- Wire to full CRUD on /api/sections

4) Billing Stations ("/billing-stations")
- Title "Billing Management", subtitle "Configure billing stations for your restaurant.", a "Create Billing Station" button top-right opening a modal (name, description, assign sections via multi-select, active toggle)
- List of station cards: name, "Active" status pill, description, "Assigned Sections" chip list, and an "Open Station" button that would route a cashier into that station's billing queue (can navigate to a stubbed /billing-stations/{id}/session route for now)
- Wire to full CRUD on /api/billing-stations plus the section-assignment relationship

Keep all forms using React Hook Form + Zod validation, and all destructive actions (delete category, remove section) behind a confirmation dialog.
```

---

## PHASE 7 — Frontend: Reports & Discounts

```
Build the Reports & Discounts page (route "/reports"), matching https://shahdab.lovable.app/reports :

- Title "Reports & Analytics", subtitle "Comprehensive business insights and performance metrics.", and a context line "Showing all sections · Today" with dropdowns to change section filter and date range (Today / Week / Month / custom)
- Tab bar: Sales Reports | Session Reports | Cancellation Reports | Discounts | Returns & More

Sales Reports tab (default/active):
- 4 stat cards: Total Revenue (+ "From N completed sessions"), Total Sessions (+ "N completed · N voided"), Net Revenue (+ "After discounts: ₹X"), Taxes & Charges (+ "Tax ₹X · Service ₹X · Rounding ₹X")
- "Sales Trend" card with a line/area chart (Recharts) of revenue over the selected range
- "Sales by Category" section with an "Export to Excel" button (calls GET /api/reports/export?type=excel and downloads the file), listing each MenuCategory as a row/card: category name, "{sessions} sessions · {items} items · avg ₹{avg}", and bold inline stats "Total ₹X", "Discount ₹X", "Net ₹X"

Session Reports tab: table of sessions with table/section, guest, item count, subtotal, discount, total, payment method, status, time
Cancellation Reports tab: table of cancelled/voided sessions with reason if captured, who cancelled, amount
Discounts tab: CRUD list of Discount rules (name, type Percent/Flat, value, active toggle, edit/delete), "Add Discount" button opening a form modal
Returns & More tab: table of CreditNotes (amount, reason, owed status, linked session)

Wire each tab to its corresponding GET /api/reports/* endpoint via TanStack Query, refetching when the section/date filters change. Keep the same stat-card and card styling used on the Dashboard for visual consistency across the app.
```

---

## PHASE 8 — Polish, real-time sync, and QA pass

```
Do a final polish pass across the whole RestaurantOS app:

1. Real-time sync: ensure SignalR (or polling fallback) keeps Table Service table badges, Kitchen Display tickets, and Dashboard "Total Sessions" in sync across browser tabs when orders are sent to kitchen, KOTs are bumped, or bills are closed.
2. Responsive/tablet layout: Table Service, Quick Order and Kitchen Display are used on tablets at the counter — verify they work well down to ~1024px width; back-office pages (Menu, Sections, Reports) can be desktop-only.
3. Empty/loading/error states on every page (skeletons while loading, friendly empty states like the reference "No active orders" / "No draft selected" copy).
4. Currency & number formatting consistency (₹ with Indian lakh/crore grouping) across every page.
5. Auth guard: redirect unauthenticated users to /login; role-gate the setup pages (Menu Management, Sections, Billing Stations) to Admin/Manager roles only.
6. Write a README documenting: how to run docker-compose, run backend migrations, run the frontend dev server, seeded demo login credentials, and an architecture diagram/description of the folder structure.
7. Add basic frontend component tests (Vitest + React Testing Library) for the Dashboard stat cards, Table Service order panel, and Kitchen Display ticket status transitions.

Confirm the whole flow end-to-end manually: seat a table in Table Management → add items and send to kitchen in Table Service → ticket appears in Kitchen Display → bump through statuses → move session to billing → session reflected in Dashboard and Reports.
```

---

### Tips for using these with Devin
- Paste phases one at a time as separate Devin sessions/tasks — this keeps context tight and makes review/rollback easier per phase.
- Point Devin at the live reference (`https://shahdab.lovable.app/`) if it has browsing access, so it can visually verify against the real pages, not just this spec.
- If Devin has computer/browser use enabled, add "Take a screenshot of each finished page and compare side-by-side with the reference URL" as a QA step at the end of Phases 3-7.
- Consider asking Devin to generate the OpenAPI client for the frontend (`openapi-typescript` or NSwag) right after Phase 2 so frontend calls stay type-safe as the API evolves.
