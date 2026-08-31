# Restaurant Management SaaS — API Design Document

## Conventions

- **Base URL:** `https://api.{yourapp}.com/v1`
- **Auth:** `Authorization: Bearer <JWT>` — JWT carries `organization_id`, `outlet_id` (if scoped), `staff_id`, and `roles[]`. Every request is implicitly tenant-scoped from the token; no client ever passes `organization_id` in the body.
- **Multi-outlet header:** `X-Outlet-Id` required on outlet-scoped endpoints when a staff member has access to more than one outlet (Admin/Org-owner).
- **Response envelope:**
  ```json
  { "data": {...}, "error": null, "meta": { "request_id": "..." } }
  ```
- **Errors:** standard HTTP status codes; error body: `{ "data": null, "error": { "code": "TABLE_HAS_ACTIVE_ORDER", "message": "..." } }`
- **Pagination:** `?page=1&limit=25` → `meta.pagination: { page, limit, total }`
- **Real-time:** WebSocket channel `wss://api.{yourapp}.com/v1/ws?token=...` — used for kitchen ticket pushes, waiter "item ready" notifications, and live table-status sync. REST endpoints below are the source of truth; WS pushes mirror state changes.

Role column shorthand: `CAP`=Captain, `WTR`=Waiter, `KM`=Kitchen Manager, `CSH`=Cashier, `OM`=Outlet Manager, `ADM`=Admin.

---

## 1. Auth & Session

| Method | Path | Roles | Description |
|---|---|---|---|
| POST | `/auth/login` | all | Phone/email + password → JWT + refresh token |
| POST | `/auth/refresh` | all | Exchange refresh token for new JWT |
| POST | `/auth/logout` | all | Invalidate refresh token |
| GET | `/auth/me` | all | Current staff profile, roles, assigned outlet/floor/tables/kitchens |

---

## 2. Organizations & Subscription (SaaS layer)

| Method | Path | Roles | Description |
|---|---|---|---|
| POST | `/organizations` | public | Sign-up: creates organization + first Admin + trial subscription |
| GET | `/organizations/current` | ADM | Org profile, plan, usage (outlets/staff count vs plan limits) |
| PATCH | `/organizations/current` | ADM | Update org name, billing contact |
| GET | `/subscription-plans` | public | List available plans |
| GET | `/subscriptions/current` | ADM | Current plan, status, renewal date |
| POST | `/subscriptions/upgrade` | ADM | Change plan |
| GET | `/invoices` | ADM | Billing history for the org's own SaaS subscription |

---

## 3. Outlets, Floors, Kitchens, Billing Stations

| Method | Path | Roles | Description |
|---|---|---|---|
| POST | `/outlets` | ADM | Create outlet (checked against plan's `max_outlets`) |
| GET | `/outlets` | ADM, OM | List outlets in org |
| PATCH | `/outlets/{id}` | ADM | Update outlet details |
| POST | `/outlets/{id}/floors` | OM, ADM | Create floor |
| GET | `/outlets/{id}/floors` | all | List floors (used to populate Tables tab, menu scoping) |
| PATCH | `/floors/{id}` | OM, ADM | Rename/reorder floor |
| POST | `/outlets/{id}/kitchens` | OM, ADM | Create kitchen (e.g. Veg/Non-veg/Mocktail) |
| GET | `/outlets/{id}/kitchens` | all | List kitchens |
| POST | `/floors/{id}/billing-station` | OM, ADM | Create the one billing station for this floor |
| GET | `/outlets/{id}/billing-stations` | CSH, OM, ADM | List billing stations |

---

## 4. Tables, Merge/Split/Transfer, Reservations

| Method | Path | Roles | Description |
|---|---|---|---|
| POST | `/floors/{id}/tables` | OM, ADM | Create table |
| GET | `/floors/{id}/tables` | CAP, WTR, OM, ADM | Live table grid with status |
| GET | `/tables/{id}` | CAP, WTR | Table detail incl. active order summary |
| POST | `/tables/merge` | CAP | Body: `{ table_ids: [...] }`. **Rejects** with `TABLE_HAS_ACTIVE_ORDER` if any table has an open order. Creates `table_merge_group`. |
| POST | `/table-merge-groups/{id}/split` | CAP | Reverses a merge. Rejects if the merged group has an active order. |
| POST | `/tables/{id}/transfer` | CAP | Body: `{ to_table_id }`. Rejects if destination is occupied or source has an active order (per current scope — see open question below). |
| POST | `/reservations` | CAP, OM | Create booking: guest name, phone, party size, time, floor |
| GET | `/reservations` | CAP, OM | List upcoming reservations (feeds Tables tab auto-flagging) |
| PATCH | `/reservations/{id}` | CAP, OM | Update / cancel / mark no-show |
| POST | `/reservations/{id}/seat` | CAP | Converts Reserved → Occupied, links to a table |

---

## 5. Staff, Roles & Assignments

| Method | Path | Roles | Description |
|---|---|---|---|
| POST | `/staff` | OM, ADM | Create staff account (checked against plan's `max_staff`) |
| GET | `/staff` | OM, ADM | List staff for outlet |
| PATCH | `/staff/{id}` | OM, ADM | Update details, status (active/inactive) |
| POST | `/staff/{id}/roles` | OM, ADM | Assign role(s) scoped to an outlet |
| POST | `/staff/{id}/floor-assignments` | OM, ADM | Assign waiter/captain to a floor |
| POST | `/staff/{id}/table-assignments` | OM, ADM, CAP | Assign waiter to specific tables |
| POST | `/staff/{id}/kitchen-assignments` | OM, ADM | Assign kitchen manager to a kitchen |
| GET | `/roles` | OM, ADM | List roles + permission matrix |
| PATCH | `/roles/{id}/permissions` | ADM | Edit what a role can do |

---

## 6. Menu

| Method | Path | Roles | Description |
|---|---|---|---|
| POST | `/outlets/{id}/menu-categories` | OM, ADM | Create category |
| GET | `/outlets/{id}/menu-categories` | all | List categories |
| POST | `/menu-categories/{id}/items` | OM, ADM | Create menu item (assign kitchen) |
| GET | `/floors/{id}/menu` | CAP | **Captain's menu view** — categories → items → variants, resolved to this floor's price, with out-of-stock items flagged/hidden |
| PATCH | `/menu-items/{id}` | OM, ADM | Update name/description/kitchen mapping |
| POST | `/menu-items/{id}/variants` | OM, ADM | Add variant (Full/Half/Family) + base price |
| POST | `/menu-item-variants/{id}/floor-price` | OM, ADM | Set/override price for a specific floor |
| PATCH | `/menu-items/{id}/stock-status` | KM | Toggle out-of-stock — triggers WS push to all captains on outlet |
| POST | `/outlets/{id}/modifiers` | OM, ADM | Create modifier (e.g. "No onion") |
| POST | `/menu-items/{id}/modifiers` | OM, ADM | Attach modifier to item |

---

## 7. Orders & KOT

| Method | Path | Roles | Description |
|---|---|---|---|
| POST | `/orders` | CAP | Create order. Body includes `order_type` (`dine_in`/`takeaway`), `table_id` or `merge_group_id`, or `customer_name`/`customer_phone` for takeaway |
| POST | `/orders/{id}/items` | CAP | Add items to order (creates a new `kot_batch` on submit) → pushes ticket via WS to relevant kitchen(s) |
| POST | `/orders/{id}/kot-batches/{batchId}/send` | CAP | Finalize/send this batch to kitchen (if items were staged before sending) |
| GET | `/orders/{id}` | CAP, WTR, CSH | Full order detail: items, statuses, variants, modifiers |
| DELETE | `/order-items/{id}` | CAP | Cancel item — **only allowed** while status is `placed` or `accepted`; returns `409 ITEM_ALREADY_COOKING` otherwise |
| GET | `/orders?table_id=` | CAP, WTR | Active order for a table |
| GET | `/orders?status=open&floor_id=` | CAP, OM | Open orders overview |

---

## 8. Kitchen Display

| Method | Path | Roles | Description |
|---|---|---|---|
| GET | `/kitchens/{id}/tickets` | KM | Live KOT board — full order context per ticket, with non-kitchen items flagged `is_relevant: false` for greying out |
| PATCH | `/order-items/{id}/status` | KM | Advance item status: `accepted → cooking → ready`. Pushes WS notification to the item's assigned waiter on `ready`. |
| PATCH | `/orders/{id}/mark-all-ready` | KM | **Takeaway only** — marks every item in the order Ready simultaneously; disabled/hidden for `dine_in` orders |
| GET | `/kitchens/{id}/takeaway-queue` | KM | Separate queue view for takeaway tickets |

---

## 9. Waiter Actions

| Method | Path | Roles | Description |
|---|---|---|---|
| GET | `/staff/me/tables` | WTR | Tables currently assigned to this waiter, with live status |
| PATCH | `/order-items/{id}/serve` | WTR | Mark individual item Served |
| POST | `/tables/{id}/request-bill` | WTR, CAP | Flags table as `bill_requested`, notifies the floor's cashier |
| GET | `/staff/me/notifications` | WTR, KM, CAP | Unread notification feed (item ready, bill requested, out of stock, etc.) |
| PATCH | `/notifications/{id}/read` | all | Mark notification read |

---

## 10. Billing

| Method | Path | Roles | Description |
|---|---|---|---|
| GET | `/billing-stations/{id}/queue` | CSH | Tables/orders awaiting billing on this floor |
| POST | `/orders/{id}/bill` | CSH | Generate bill: computes subtotal, resolves applicable taxes |
| PATCH | `/bills/{id}/items` | CSH | Add/remove items on the bill before settlement |
| POST | `/bills/{id}/discounts` | CSH | Apply discount — flat or percentage, item-level or bill-level; no approval step |
| POST | `/bills/{id}/splits` | CSH | Body: `{ split_type: "by_item"|"by_number", splits: [...] }` |
| POST | `/bills/{id}/payments` | CSH | Record payment(s) — supports multiple methods across splits |
| POST | `/bills/{id}/close` | CSH | Finalize bill once fully paid → order → `closed`, table → `needs_cleaning` |
| GET | `/bills/{id}` | CSH, OM, ADM | Full bill detail incl. splits, discounts, payments, taxes |
| GET | `/billing-stations/{id}/bills` | CSH | Bill history for this station |
| POST | `/bills/{id}/reprint` | CSH | Returns print-ready receipt payload |

---

## 11. Analytics (read-only, OM scoped to own outlet / ADM org-wide)

| Method | Path | Roles | Description |
|---|---|---|---|
| GET | `/analytics/dishes/best-worst?range=` | OM, ADM | Top/bottom N dishes by quantity sold and revenue |
| GET | `/analytics/trends?granularity=daily\|weekly\|monthly\|annual` | OM, ADM | Revenue/order-count trend series |
| GET | `/analytics/items/{id}/performance` | OM, ADM | Per-item earning, discount total, quantity, trend |
| GET | `/analytics/categories/{id}/performance` | OM, ADM | Per-category earning, discount total |
| GET | `/analytics/staff-performance?role=` | OM, ADM | Orders served, avg turnover time, per staff member |
| GET | `/analytics/kitchen-efficiency` | OM, ADM | Avg prep time (accepted→ready) per kitchen/dish |
| GET | `/analytics/table-turnover?floor_id=` | OM, ADM | Avg dining duration, turns per table |
| GET | `/analytics/peak-hours` | OM, ADM | Order volume heatmap by day/hour |
| GET | `/analytics/payment-methods` | OM, ADM | Cash vs card vs UPI split over time |
| GET | `/analytics/voids-discounts` | OM, ADM | Discount frequency/value by staff member |

---

## 12. Audit

| Method | Path | Roles | Description |
|---|---|---|---|
| GET | `/audit-logs?entity_type=&staff_id=&from=&to=` | ADM | Full audit trail — discounts, item cancels, table merges/splits/transfers, stock toggles |

---

## Key business-rule enforcement (in application layer, not just DB)

- `POST /tables/merge` / `.../split` → reject unless all involved tables have no order in `open`/`partially_served`/`fully_served` status.
- `DELETE /order-items/{id}` → reject unless status is `placed` or `accepted`.
- `PATCH /orders/{id}/mark-all-ready` → only exposed/valid for `order_type = takeaway`; dine-in must use per-item `PATCH /order-items/{id}/status`.
- `POST /staff` and `POST /outlets` → check current usage against `subscription_plans.max_staff` / `max_outlets` before creating; return `402 PLAN_LIMIT_REACHED` if exceeded.
- All list/detail endpoints implicitly filter by `organization_id` from the JWT — never accept it as a client-supplied parameter, to prevent cross-tenant data leakage.

---

## Open question carried over

`POST /tables/{id}/transfer` above assumes transfer only happens on tables **without** an active order (matching your merge/split rule). If you also want a "live transfer" — moving an in-progress order to a new physical table mid-meal — that would need a separate endpoint (e.g. `POST /orders/{id}/reassign-table`) that moves the order reference without touching item states. Flag if you want that added.