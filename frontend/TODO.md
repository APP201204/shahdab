# Implementation TODO — Missing UI Mockups

Scope: front-end mockups only (React context + seed data, consistent with the existing prototype). No backend, no persistence. Ordered roughly by workflow importance. Cross-reference: `workflow.md` section numbers.

## 1. Cashier / Billing (workflow.md §9) — biggest gap ✅

- [x] Create `src/routes/billing.tsx` — Cashier workspace page
  - [x] Bill Requests queue (tables/orders awaiting billing, incl. merged groups)
  - [x] Bill detail view: line items with qty/variant/price, subtotal
  - [x] Discount controls: flat / percentage, applied_by label
  - [x] Tax breakdown (CGST/SGST) on discounted subtotal + section service charge
  - [x] Split bill: by item (Person A/B assignment) and by count (N even splits)
  - [x] Payment capture per sub-bill: Cash / Card / UPI / Wallet, multiple partial payments
  - [x] "Close Bill" validates payments == total due
  - [x] On close: order cleared, table → `paid` (→ Needs Cleaning via Tables page)
- [x] Create `src/routes/bill-history.tsx` — Bill History page
  - [x] List of closed bills (bill no, table/section, amount, time, cashier)
  - [x] Bill detail dialog + reprint button
- [x] "Request Bill" action on tables → sets `bill-requested` status + notifies
- [x] Nav entries under Finance: "Cashier", "Bill History"
- [ ] Add/remove items on the bill before finalizing (deferred — items editable in Table Service)

## 2. Reservations (workflow.md §2) ✅

- [x] Create `src/routes/reservations.tsx`
  - [x] Create booking form: guest name, phone, party size, time, section/table
  - [x] Reservation list sorted booked → seated → done
  - [x] Actions: Seat (→ Occupied / Seated), Cancel, No Show
- [x] `reserved` table status + badge on Tables grid
- [ ] Pending/unassigned reservations panel on Tables page (deferred — list lives on Reservations page)

## 3. Waiter / Order Status view (workflow.md §3.4, §3.5) ✅

- [x] Create `src/routes/order-status.tsx` — per-table item status board
  - [x] Mark individual items `Served` (strike-through)
  - [x] Derived order status: Open → Partially Served → Fully Served
  - [x] Items grouped by KOT batch
  - [ ] Kitchen-driven per-item statuses (Placed→Accepted→Cooking→Ready) shown read-only — currently kitchen uses local ticket state

## 4. Table lifecycle states (workflow.md §3.6–3.7) ✅

- [x] `TableStatus` extended: `reserved`, `bill-requested`, `paid`, `needs-cleaning`
- [x] Status colors/badges on Tables grid + Table Service
- [x] Actions per state: Seat / Release / Request Bill / Go to Billing / Send for Cleaning / Mark Cleaned

## 5. Kitchen Display upgrades (workflow.md §3.2, §4, §8, §10) ✅ (mock)

- [ ] Wire tickets to shared `orders` state (deferred — kitchen uses its own fixture tickets)
- [x] Multi-kitchen routing mock: non-owned items render greyed out
- [x] Per-item status progression: Placed → Accepted → Cooking → Ready
- [x] Takeaway queue tab: combined "Mark All Ready" (enabled when all items cooking/ready)
- [x] Out of Stock panel → disables items in Table Service & Quick Order (`stockOut` in app state)
- [ ] Remove cancelled items from kitchen tickets (deferred — no shared ticket state)

## 6. Order item cancellation (workflow.md §8) ✅

- [x] Cancel (×) on order lines in Table Service
- [x] Allowed for pending / sent-to-kitchen; blocked with toast for on-table (served)

## 7. Takeaway completion (workflow.md §4) ✅ (mock)

- [x] Quick Order: customer name + phone capture per order
- [x] Send to Kitchen → `sent` state; Mark Picked Up closes the order
- [ ] Route takeaway orders through cashier billing queue (deferred)

## 8. Staff & Role Management (workflow.md §12) ✅

- [x] Create `src/routes/staff.tsx` — staff list + create/edit dialog
- [x] Role assignment (Captain, Waiter, Kitchen Manager, Cashier, OM, Admin)
- [x] Assignments: floor / station / kitchen / table ranges

## 9. Notifications (workflow.md §11) ✅

- [x] Bell dropdown in top bar with unread badge + "mark all read"
- [x] Events emit notifications: bill requested, bill closed, item served, reservation seated, takeaway ready/picked up, out-of-stock

## 10. Outlet Onboarding / Admin (workflow.md §1) — not started

- [ ] Signup / org creation screen (trial subscription framing)
- [ ] Outlet creation form (name, address, timezone, currency)
- [ ] Floors + Kitchens setup screens
- [ ] Login / role-switcher screen for demoing personas

## Shared / infrastructure ✅

- [x] `app-state.tsx`: reservations, bills, notifications, stockOut, `notify()`
- [x] `seed.ts`: Reservation/Bill/Staff/Notification types + seeds, TAXES config
- [x] Routes registered in `side-nav.tsx` (Order Status, Reservations, Cashier, Bill History, Staff)
- [x] `TopBar` moved inside `AppStateProvider`
- [x] Verified: `tsc --noEmit` clean, `vite build` passes, eslint clean
