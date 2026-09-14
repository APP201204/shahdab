# Restaurant Management SaaS — Detailed Workflow Document

This document walks through every end-to-end process in the system: who does what, in what order, what the system does in response, and what happens at each decision/edge case. Read alongside the [Role Tabs doc] and [API Design doc] — this is the "what happens, step by step" layer that ties those two together.

---

## 1. Outlet Onboarding Workflow

**Actor:** Admin (org owner, first user after SaaS sign-up)

1. Admin signs up → organization created with a trial subscription.
2. Admin creates first **Outlet** (name, address, timezone, currency).
3. Admin (or delegated Outlet Manager) creates **Floors** under the outlet (e.g. Ground Floor, First Floor, Terrace).
4. Admin creates **Kitchens** (e.g. Veg, Non-Veg, Mocktails) — kitchens belong to the outlet, not to a specific floor.
5. For each floor, Admin/OM creates exactly **one Billing Station**.
6. Admin/OM creates **Tables** under each floor (table number, capacity).
7. Admin/OM builds the **Menu**: categories → items → variants (Full/Half/Family) → base price → per-floor price overrides if needed → assigns each item to a kitchen.
8. Admin/OM creates **Staff** accounts and assigns:
   - Role(s) per outlet (Captain, Waiter, Kitchen Manager, Cashier, OM, Admin)
   - Waiters → specific tables
   - Captains → specific floors
   - Kitchen Managers → specific kitchens
9. Outlet is now live — Captains can start seating guests and taking orders.

**Edge case:** If org's subscription plan has a `max_outlets` or `max_staff` cap, creation attempts beyond the limit are rejected with a plan-upgrade prompt.

---

## 2. Reservation Workflow

**Actors:** Captain (or Outlet Manager), guest (phone/walk-in)

1. Guest calls/asks to book a table → Captain opens **Reservations** and creates a booking: guest name, phone, party size, date/time, floor (table optionally pre-assigned).
2. Reservation appears in Captain's **Tables** tab as a time-flagged entry on the relevant table (or as an unassigned pending reservation if no table chosen yet).
3. As reservation time approaches, the table visually flags "Reserved" in the Tables grid.
4. **On guest arrival:** Captain opens the reservation → taps "Seat" → table status moves `Reserved → Occupied`, reservation status → `Seated`. Captain proceeds to normal order-taking (Section 3).
5. **No-show handling:** if guest doesn't arrive, Captain/OM manually marks reservation `No Show` → table reverts to `Vacant`.
6. **Cancellation:** guest cancels ahead of time → Captain/OM marks `Cancelled` → table (if pre-assigned) reverts to `Vacant`.

---

## 3. Dine-In Order Lifecycle (Master Flow)

**Actors:** Captain, Kitchen Manager(s), Waiter, Cashier

### 3.1 Order creation
1. Captain opens **Tables** tab, taps an Occupied/newly-seated table.
2. If no waiter is yet assigned to this table, Captain assigns one (or confirms the pre-assigned waiter).
3. Captain opens **Menu** (scoped to this floor's categories/items/prices), selects items, chooses variant (Full/Half/Family) and any modifiers (e.g. "no onion"), adds to cart.
4. Captain reviews in **Order Summary**, taps **Send to Kitchen**.
5. System creates an `order` (if none exists for this table) and a `kot_batch` #1 containing these items.

### 3.2 Multi-kitchen routing
6. System groups the batch's items by their `kitchen_id` and pushes a ticket to each relevant kitchen's live board via WebSocket.
7. Each kitchen's ticket shows the **full order** (for timing/context) but items not belonging to that kitchen are **greyed out and non-interactive**.
   - *Example:* Table 5 orders Paneer Tikka (Veg kitchen), Chicken Seekh (Non-veg kitchen), and a Mojito (Mocktail kitchen). All three kitchens see all three items on their ticket for Table 5; each kitchen can only act on its own item, the other two appear greyed.

### 3.3 Kitchen processing (per item, per kitchen)
8. Kitchen Manager taps their kitchen's item: `Placed → Accepted → Cooking → Ready`.
9. On `Ready`, system pushes a notification to the **specific waiter assigned to that table**: "Table 5: Paneer Tikka (Half) is ready."
10. This repeats independently per item, per kitchen — items finish at different times, and that's expected (no blocking between kitchens).

### 3.4 Serving
11. Waiter sees the notification, physically serves the dish, and marks that **individual item** as `Served` in their Order Status view.
12. Order's overall status auto-derives: `Open` (nothing served yet) → `Partially Served` (some items served, others still pending) → `Fully Served` (every item across every kitchen batch is Served).

### 3.5 Adding more items mid-meal
13. If the guest orders more (e.g. dessert after mains), Captain repeats step 3.1–3.2: a **new `kot_batch`** (#2, #3...) is created under the *same order*, and only the new items route to kitchens. Already-served/cooking items from batch #1 are untouched.
14. Order status recalculates including the new batch's items (a fully-served order can drop back to `Partially Served` when a new batch is added).

### 3.6 Requesting the bill
15. Guest asks for the bill → Waiter or Captain taps **Request Bill** on the table.
16. Table status → `Bill Requested`; system notifies the **Cashier at this floor's billing station**.

### 3.7 Billing (see Section 9 for full detail)
17. Cashier generates the bill, applies discounts/splits as needed, records payment(s), closes the bill.
18. On close: order → `Closed`, table → `Paid → Needs Cleaning`.
19. Once cleaned (manual confirm by waiter/captain, or auto-timer if you choose to add one later), table reverts to `Vacant` and can be booked/seated again.

---

## 4. Takeaway Order Lifecycle

**Actors:** Captain (or dedicated counter staff), Kitchen Manager

1. Captain opens the **Takeaway** tab (parallel to Tables — no table selection).
2. Captain enters **Customer Name** and **Phone Number** in place of a table.
3. Captain selects items/variants/modifiers exactly as in dine-in → **Send to Kitchen**.
4. System creates an `order` with `order_type = takeaway`, routes items to relevant kitchens exactly as in Section 3.2 — tickets appear in a **separate Takeaway queue** on each kitchen's display, tagged with customer name/phone.
5. **Key difference:** Kitchen Manager cannot mark items Ready individually for a takeaway order. The kitchen must bring every item to Cooking, and only once **all items across all involved kitchens** are ready does the order become eligible for the single **"Mark All Ready"** action (visible once every item is in `Cooking`/`Ready` internally — the UI exposes one combined action rather than per-item toggles).
6. On "Mark All Ready," system notifies Captain/counter: "Order for Ramesh (98xxxxxxxx) is ready for pickup."
7. Customer arrives, order is handed over, marked `Picked Up`.
8. Billing follows the same flow as Section 9, minus table/waiter-specific steps — cashier still generates the bill, can split if the customer requests (e.g. two people splitting one takeaway bill), records payment.

**Edge case:** if a takeaway order spans 2 kitchens and one kitchen finishes early, that kitchen's items sit in `Ready`-but-unexposed state internally until the last kitchen catches up — nothing is handed out piecemeal.

---

## 5. Table Merge Workflow

**Actor:** Captain

**Precondition:** none of the tables being merged has an order in `Open`, `Partially Served`, or `Fully Served` status (i.e., no unpaid/active order on any of them).

1. Captain opens **Tables** tab, selects 2+ vacant/about-to-seat tables, taps **Merge**.
2. If any selected table has an active order → request rejected with a clear message ("Table 6 has an active order — settle or close it before merging").
3. On success, system creates a `table_merge_group` linking the selected tables; all merged tables now render as **one logical unit** across Captain, Waiter, and Cashier views (e.g. "Table 5+6").
4. Any new order placed against this unit references the `merge_group_id` (not an individual `table_id`).
5. Waiter assignment: typically one waiter is assigned to the merged unit for the duration.

---

## 6. Table Split Workflow

**Actor:** Captain

**Scope:** The **Split** option is available for **every table** — not only merged groups. A single physical table can be divided into 2 or 3 logical sub-tables (e.g., Table 1 → Table 1a, 1b, 1c), and a merged group can still be split back into its original tables.

### 6.1 Split a single table

**Preconditions:**
- The table is **not already split** (a table can be split only once; sub-tables cannot be split again).
- The table has **no active/unpaid order** that is not explicitly assigned to a sub-table. If an order is already open, the Captain must choose which resulting sub-table keeps the order before the split completes.

**Example:** A table for 4 has 2 guests seated. The Captain can split it into Table 1a (2 seats for the current guests) and Table 1b (2 seats for the new guests) after confirming everyone is okay sharing the table.

1. Captain opens the table, taps **Split**.
2. System prompts the Captain to choose **2** or **3** sub-tables.
3. Captain assigns a capacity/guest count to each sub-table. The combined allocation cannot exceed the original table's capacity.
4. If an active order exists on the parent table, the Captain selects which sub-table it moves to.
5. System validates:
   - The table is not already a sub-table or part of an existing split.
   - No other active/unpaid order remains unassigned.
   - The total assigned seats do not exceed the original capacity.
6. If validation fails → request rejected with a clear message (e.g., "Table is already split", "Seat allocation exceeds capacity", or "Active order must be assigned to a sub-table").
7. On success:
   - The original table is marked as **Split** and is no longer independently bookable.
   - New sub-tables are created with suffixes **a, b, c** (e.g., Table 1a, 1b, 1c).
   - Each sub-table behaves like an independent table: it can be `Vacant`, `Reserved`, `Occupied`, `Bill Requested`, `Paid`, and `Needs Cleaning`.
   - Orders and bills are tracked per sub-table.
   - A table can be split **just once**; sub-tables cannot be split again.
8. To restore the original table, the Captain selects **Unsplit** when **all** sub-tables are `Vacant` with no active/unpaid orders. The sub-tables are removed and the parent table returns to `Vacant`.

### 6.2 Split a merged table group

**Precondition:** the merged group has no active/unpaid order (i.e., the group's shared order, if any, has already been billed and closed).

1. Captain opens the merged table unit, taps **Split**.
2. If an active order still exists on the group → rejected, same as merge.
3. On success, the `table_merge_group` is marked `Released`; each original table reverts to being independently bookable (`Vacant`), and the group's `merge_group_id` is no longer active.

---

## 7. Table Transfer Workflow

**Actor:** Captain

**Precondition (current scope):** the source table has no active/unpaid order — transfer is for moving a guest/booking *before* ordering, or reassigning a table *after* it's been paid and closed, not for relocating an in-progress meal.

1. Captain opens source table, taps **Transfer**, selects destination table (must itself be `Vacant`).
2. System validates: source has no active order, destination is vacant.
3. On success: any waiter assignment, and (if applicable) an unseated reservation, move to the destination table; source table resets to `Vacant`.

*(Flagged separately: if you want "live transfer" — moving an in-progress, still-cooking order to a different physical table — that's a distinct workflow not yet built; the order and its item states would move together while the table reference changes.)*

---

## 8. Order Item Cancellation Workflow

**Actor:** Captain

1. Captain selects an item within an open order to cancel.
2. System checks the item's status:
   - **`Placed` or `Accepted`** → cancellation allowed. Item status → `Cancelled`, removed from kitchen's active ticket, removed from eventual bill.
   - **`Cooking`, `Ready`, or `Served`** → cancellation **blocked**, error `ITEM_ALREADY_COOKING` returned. Captain is told to contact the Kitchen Manager/Manager-on-duty for manual handling outside the app (comp'ing after the fact is out of scope for now per your call).

---

## 9. Billing Workflow

**Actor:** Cashier (at the floor's single billing station)

1. Table/order appears in Cashier's **Bill Requests** queue (triggered by waiter/captain's "Request Bill" action, or automatically once an order is `Fully Served`).
2. Cashier opens the order → system computes subtotal from all served/active `order_items` (cancelled items excluded).
3. Cashier may **add or remove items** on the bill before finalizing (e.g. guest wants one more item added last-minute).
4. **Discount (optional):** Cashier applies a flat or percentage discount, either bill-level or against a specific item — applied immediately, no approval step, but logged with `applied_by` for the audit trail.
5. **Tax calculation:** system applies configured taxes (e.g. CGST/SGST/Service Charge) on top of the discounted subtotal.
6. **Split (optional):**
   - **By item:** Cashier assigns specific items to specific "sub-bills" (e.g. Person A gets the biryani + lassi, Person B gets the rest).
   - **By number:** Cashier enters N and system divides the total evenly across N sub-bills.
   - **No split:** single bill, single payment.
7. **Payment:** Cashier records payment method(s) per sub-bill (Cash/Card/UPI/Wallet) — a single sub-bill can even be paid via multiple methods (e.g. part cash, part card) if you want that flexibility; each partial payment is logged until the sub-bill's total is met.
8. Cashier taps **Close Bill** → validated that total payments received match total due → bill status → `Paid`.
9. System cascades: order → `Closed`, table → `Paid` → (after physical cleanup) `Needs Cleaning → Vacant`.
10. Bill appears in **Bill History** with reprint capability.

**Takeaway variant:** same flow, skipping table-state steps (7–9's table cascade doesn't apply); order simply closes and customer record (name/phone) stays attached to the bill for potential repeat-customer analytics later.

---

## 10. Stock-Out Workflow

**Actor:** Kitchen Manager

1. Kitchen Manager notices an ingredient/dish is unavailable, opens their kitchen's item list, toggles **Out of Stock** on that menu item.
2. System immediately pushes an update to every Captain's **Menu** tab across all floors that serve this item — item is visually disabled (e.g. greyed, "Unavailable" tag) and cannot be added to a new order.
3. Any item **already in an active order** (placed before the toggle) is unaffected — it continues through its existing kitchen workflow.
4. When back in stock, Kitchen Manager toggles it back on — item reappears as orderable.

---

## 11. Staff Notification Workflow (cross-cutting)

| Event | Trigger | Recipient | Channel |
|---|---|---|---|
| Item marked Ready | Kitchen Manager action | Assigned waiter for that table | Push + in-app badge |
| Takeaway order fully ready | Kitchen Manager "Mark All Ready" | Captain/counter staff | Push + in-app badge |
| Item marked Out of Stock | Kitchen Manager toggle | All Captains on outlet | Live menu update (silent UI change, not just a notification) |
| Bill requested | Waiter/Captain action | Cashier at that floor's billing station | Push + queue update |
| Reservation time approaching | System time-check | Captain assigned to that floor | In-app flag on Tables tab |
| Item cancellation attempted after cooking started | Captain action | (blocked, no notification — inline error only) | — |

---

## 12. Staff & Role Management Workflow

**Actor:** Outlet Manager / Admin

1. OM/Admin creates a staff record (name, phone, login credentials).
2. Assigns one or more roles to that staff member, **scoped per outlet** (a person could be a Captain at Outlet A and a Waiter at Outlet B, for multi-outlet orgs).
3. Role-specific assignment:
   - **Captain/Waiter** → assigned to floor(s) and/or specific tables.
   - **Kitchen Manager** → assigned to specific kitchen(s).
   - **Cashier** → implicitly scoped to their floor's single billing station.
4. Changes take effect immediately — e.g. reassigning a waiter's tables mid-shift updates whose notifications fire for those tables in real time.

---

## Summary: full state machine cross-reference

- **Table:** `Vacant → Reserved → Occupied → Bill Requested → Paid → Needs Cleaning → Vacant`
- **Order Item:** `Placed → Accepted → Cooking → Ready → Served` (or `Cancelled` if caught before `Cooking`)
- **Takeaway Order:** same item states internally, but exposed to kitchen UI as one combined `Ready` action for the whole order
- **Order (derived):** `Open → Partially Served → Fully Served → Billed → Closed`
- **Split Table (parent):** `Intact → Split` (one-time; creates sub-tables such as `1a`, `1b`, `1c`)
- **Split Table (sub-table):** `Vacant → Reserved → Occupied → Bill Requested → Paid → Needs Cleaning → Vacant` (same lifecycle as a normal table)
- **Table Merge Group:** `Active → Released`
- **Bill:** `Open → Paid` (`Refunded` reserved for future use)
- **Reservation:** `Booked → Seated` / `Cancelled` / `No Show`