-- ============================================================================
-- RESTAURANT MANAGEMENT SAAS — DATABASE SCHEMA (PostgreSQL)
-- ============================================================================
-- Multi-tenancy strategy: shared schema, row-level isolation via
-- organization_id (denormalized onto high-traffic tables so Postgres Row
-- Level Security policies can filter without extra joins). Every tenant-owned
-- table ultimately traces back to organizations.id.
--
-- Naming: snake_case, UUID primary keys, soft-deletable where it matters
-- (is_active flags) rather than hard deletes for anything with financial
-- or historical significance (menu items, staff, tables).
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto; -- for gen_random_uuid()

-- ============================================================================
-- SECTION 1: SAAS / TENANCY
-- ============================================================================

CREATE TABLE organizations (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(150) NOT NULL,
    slug            VARCHAR(80) UNIQUE NOT NULL,       -- used for subdomain/login
    status          VARCHAR(20) NOT NULL DEFAULT 'active'
                        CHECK (status IN ('trial','active','suspended','cancelled')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE subscription_plans (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(80) NOT NULL,              -- e.g. Starter, Growth, Enterprise
    billing_cycle   VARCHAR(20) NOT NULL CHECK (billing_cycle IN ('monthly','annual')),
    price           NUMERIC(10,2) NOT NULL,
    max_outlets     INTEGER,                           -- NULL = unlimited
    max_staff       INTEGER,
    features_json   JSONB NOT NULL DEFAULT '{}',       -- feature flags per plan
    is_active       BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE subscriptions (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id     UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    plan_id             UUID NOT NULL REFERENCES subscription_plans(id),
    status              VARCHAR(20) NOT NULL DEFAULT 'trialing'
                            CHECK (status IN ('trialing','active','past_due','cancelled')),
    trial_ends_at       TIMESTAMPTZ,
    current_period_start TIMESTAMPTZ NOT NULL DEFAULT now(),
    current_period_end   TIMESTAMPTZ NOT NULL,
    cancelled_at        TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE invoices (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    subscription_id UUID NOT NULL REFERENCES subscriptions(id),
    amount          NUMERIC(10,2) NOT NULL,
    status          VARCHAR(20) NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending','paid','failed','refunded')),
    issued_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    paid_at         TIMESTAMPTZ
);

-- ============================================================================
-- SECTION 2: OUTLETS & PHYSICAL STRUCTURE
-- ============================================================================

CREATE TABLE outlets (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name            VARCHAR(150) NOT NULL,
    address         TEXT,
    timezone        VARCHAR(50) NOT NULL DEFAULT 'Asia/Kolkata',
    currency        VARCHAR(10) NOT NULL DEFAULT 'INR',
    is_active       BOOLEAN NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE floors (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    outlet_id       UUID NOT NULL REFERENCES outlets(id) ON DELETE CASCADE,
    name            VARCHAR(80) NOT NULL,               -- e.g. "Ground Floor", "Terrace"
    display_order   INTEGER NOT NULL DEFAULT 0,
    is_active       BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE kitchens (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    outlet_id       UUID NOT NULL REFERENCES outlets(id) ON DELETE CASCADE,
    name            VARCHAR(80) NOT NULL,               -- e.g. "Veg", "Non-Veg", "Mocktails"
    is_active       BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE billing_stations (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    outlet_id       UUID NOT NULL REFERENCES outlets(id) ON DELETE CASCADE,
    floor_id        UUID NOT NULL UNIQUE REFERENCES floors(id) ON DELETE CASCADE, -- exactly one per floor
    name            VARCHAR(80) NOT NULL,
    is_active       BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE tables (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    outlet_id       UUID NOT NULL REFERENCES outlets(id) ON DELETE CASCADE,
    floor_id        UUID NOT NULL REFERENCES floors(id) ON DELETE CASCADE,
    table_number    VARCHAR(20) NOT NULL,
    capacity        INTEGER NOT NULL DEFAULT 4,
    status          VARCHAR(20) NOT NULL DEFAULT 'vacant'
                        CHECK (status IN ('vacant','reserved','occupied','bill_requested',
                                           'paid','needs_cleaning')),
    merge_group_id  UUID REFERENCES table_merge_groups(id), -- NULL unless part of active merge
    is_active       BOOLEAN NOT NULL DEFAULT true,
    UNIQUE (floor_id, table_number)
);

-- Note: table_merge_groups is created below and tables.merge_group_id is
-- added via ALTER to avoid a forward-reference issue.
CREATE TABLE table_merge_groups (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    outlet_id       UUID NOT NULL REFERENCES outlets(id) ON DELETE CASCADE,
    floor_id        UUID NOT NULL REFERENCES floors(id) ON DELETE CASCADE,
    status          VARCHAR(20) NOT NULL DEFAULT 'active'
                        CHECK (status IN ('active','released')),
    created_by      UUID NOT NULL, -- FK to staff, added after staff table exists
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    released_at     TIMESTAMPTZ
);

ALTER TABLE tables
    ADD CONSTRAINT fk_tables_merge_group
    FOREIGN KEY (merge_group_id) REFERENCES table_merge_groups(id);

CREATE TABLE table_merge_group_members (
    merge_group_id  UUID NOT NULL REFERENCES table_merge_groups(id) ON DELETE CASCADE,
    table_id        UUID NOT NULL REFERENCES tables(id) ON DELETE CASCADE,
    PRIMARY KEY (merge_group_id, table_id)
);

-- Table transfer history (audit trail of the captain's transfer action)
CREATE TABLE table_transfers (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    from_table_id   UUID NOT NULL REFERENCES tables(id),
    to_table_id     UUID NOT NULL REFERENCES tables(id),
    transferred_by  UUID NOT NULL, -- FK to staff
    transferred_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    reason          VARCHAR(255)
);

CREATE TABLE reservations (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    outlet_id       UUID NOT NULL REFERENCES outlets(id) ON DELETE CASCADE,
    floor_id        UUID NOT NULL REFERENCES floors(id),
    table_id        UUID REFERENCES tables(id),          -- nullable until assigned
    guest_name      VARCHAR(100) NOT NULL,
    guest_phone     VARCHAR(20) NOT NULL,
    party_size      INTEGER NOT NULL DEFAULT 2,
    reservation_time TIMESTAMPTZ NOT NULL,
    status          VARCHAR(20) NOT NULL DEFAULT 'booked'
                        CHECK (status IN ('booked','seated','cancelled','no_show')),
    created_by      UUID NOT NULL, -- FK to staff
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- SECTION 3: STAFF, ROLES & PERMISSIONS
-- ============================================================================

CREATE TABLE roles (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE, -- NULL = system default role
    name            VARCHAR(50) NOT NULL,               -- Captain, Waiter, Kitchen Manager, Cashier, Outlet Manager, Admin
    is_system_role  BOOLEAN NOT NULL DEFAULT false,
    UNIQUE (organization_id, name)
);

CREATE TABLE permissions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code            VARCHAR(80) UNIQUE NOT NULL,          -- e.g. 'order.create', 'bill.discount.apply'
    description     VARCHAR(255)
);

CREATE TABLE role_permissions (
    role_id         UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    permission_id   UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE staff (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    outlet_id       UUID REFERENCES outlets(id),          -- primary outlet; NULL for org-level admins
    name            VARCHAR(100) NOT NULL,
    phone           VARCHAR(20) NOT NULL,
    email           VARCHAR(150),
    password_hash   VARCHAR(255) NOT NULL,
    status          VARCHAR(20) NOT NULL DEFAULT 'active'
                        CHECK (status IN ('active','inactive','on_leave')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (organization_id, phone)
);

CREATE TABLE staff_roles (
    staff_id        UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
    role_id         UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    outlet_id       UUID NOT NULL REFERENCES outlets(id) ON DELETE CASCADE, -- role is scoped per outlet
    PRIMARY KEY (staff_id, role_id, outlet_id)
);

CREATE TABLE staff_floor_assignments (
    staff_id        UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
    floor_id        UUID NOT NULL REFERENCES floors(id) ON DELETE CASCADE,
    PRIMARY KEY (staff_id, floor_id)
);

CREATE TABLE staff_table_assignments (
    staff_id        UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,   -- waiter
    table_id        UUID NOT NULL REFERENCES tables(id) ON DELETE CASCADE,
    assigned_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (staff_id, table_id)
);

CREATE TABLE staff_kitchen_assignments (
    staff_id        UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,   -- kitchen manager
    kitchen_id      UUID NOT NULL REFERENCES kitchens(id) ON DELETE CASCADE,
    PRIMARY KEY (staff_id, kitchen_id)
);

-- ============================================================================
-- SECTION 4: MENU
-- ============================================================================

CREATE TABLE menu_categories (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    outlet_id       UUID NOT NULL REFERENCES outlets(id) ON DELETE CASCADE,
    name            VARCHAR(80) NOT NULL,
    display_order   INTEGER NOT NULL DEFAULT 0,
    is_active       BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE menu_items (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    outlet_id       UUID NOT NULL REFERENCES outlets(id) ON DELETE CASCADE,
    category_id     UUID NOT NULL REFERENCES menu_categories(id),
    kitchen_id      UUID NOT NULL REFERENCES kitchens(id),   -- which kitchen preps this item
    name            VARCHAR(150) NOT NULL,
    description     TEXT,
    image_url       VARCHAR(500),
    is_active       BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE menu_item_variants (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    menu_item_id    UUID NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
    variant_name    VARCHAR(50) NOT NULL,                -- Full / Half / Family / Regular
    base_price      NUMERIC(10,2) NOT NULL,
    is_default      BOOLEAN NOT NULL DEFAULT false,
    UNIQUE (menu_item_id, variant_name)
);

-- Per-floor price override (same item, different price on different floors)
CREATE TABLE menu_item_floor_prices (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    menu_item_variant_id    UUID NOT NULL REFERENCES menu_item_variants(id) ON DELETE CASCADE,
    floor_id                UUID NOT NULL REFERENCES floors(id) ON DELETE CASCADE,
    price                   NUMERIC(10,2) NOT NULL,       -- overrides base_price for this floor
    UNIQUE (menu_item_variant_id, floor_id)
);

-- Availability toggle (kitchen manager's "out of stock" switch)
CREATE TABLE menu_item_stock_status (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    menu_item_id    UUID NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
    outlet_id       UUID NOT NULL REFERENCES outlets(id) ON DELETE CASCADE,
    is_out_of_stock BOOLEAN NOT NULL DEFAULT false,
    updated_by      UUID NOT NULL,  -- FK to staff (kitchen manager)
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (menu_item_id, outlet_id)
);

CREATE TABLE modifiers (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    outlet_id       UUID NOT NULL REFERENCES outlets(id) ON DELETE CASCADE,
    name            VARCHAR(80) NOT NULL                 -- "No onion", "Extra spicy"
);

CREATE TABLE menu_item_modifiers (
    menu_item_id    UUID NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
    modifier_id     UUID NOT NULL REFERENCES modifiers(id) ON DELETE CASCADE,
    PRIMARY KEY (menu_item_id, modifier_id)
);

-- ============================================================================
-- SECTION 5: ORDERS & KOT (KITCHEN ORDER TICKETS)
-- ============================================================================

CREATE TABLE orders (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id     UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    outlet_id           UUID NOT NULL REFERENCES outlets(id) ON DELETE CASCADE,
    floor_id            UUID NOT NULL REFERENCES floors(id),
    order_type          VARCHAR(20) NOT NULL CHECK (order_type IN ('dine_in','takeaway')),
    table_id            UUID REFERENCES tables(id),           -- NULL for takeaway
    merge_group_id      UUID REFERENCES table_merge_groups(id), -- set instead of table_id if merged
    customer_name       VARCHAR(100),                          -- takeaway only
    customer_phone      VARCHAR(20),                           -- takeaway only
    captain_id          UUID NOT NULL,                         -- FK to staff, who placed the order
    status              VARCHAR(20) NOT NULL DEFAULT 'open'
                            CHECK (status IN ('open','partially_served','fully_served',
                                               'billed','closed')),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    closed_at           TIMESTAMPTZ,
    CHECK (
        (order_type = 'dine_in' AND (table_id IS NOT NULL OR merge_group_id IS NOT NULL))
        OR
        (order_type = 'takeaway' AND table_id IS NULL AND customer_name IS NOT NULL AND customer_phone IS NOT NULL)
    )
);

-- Each "Send to Kitchen" action from the captain creates a new batch,
-- so appended items after the first KOT are trackable separately.
CREATE TABLE kot_batches (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id        UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    batch_number    INTEGER NOT NULL,                    -- 1, 2, 3... per order
    created_by      UUID NOT NULL,                       -- FK to staff (captain)
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (order_id, batch_number)
);

CREATE TABLE order_items (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id     UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    order_id            UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    kot_batch_id        UUID NOT NULL REFERENCES kot_batches(id) ON DELETE CASCADE,
    menu_item_id        UUID NOT NULL REFERENCES menu_items(id),
    menu_item_variant_id UUID NOT NULL REFERENCES menu_item_variants(id),
    kitchen_id          UUID NOT NULL REFERENCES kitchens(id), -- denormalized for fast kitchen-display queries
    quantity            INTEGER NOT NULL DEFAULT 1,
    unit_price          NUMERIC(10,2) NOT NULL,           -- price snapshot at time of order
    status              VARCHAR(20) NOT NULL DEFAULT 'placed'
                            CHECK (status IN ('placed','accepted','cooking','ready','served','cancelled')),
    -- cancellation only permitted while status IN ('placed','accepted') — enforce in application layer
    accepted_at         TIMESTAMPTZ,
    cooking_at          TIMESTAMPTZ,
    ready_at            TIMESTAMPTZ,
    served_at           TIMESTAMPTZ,
    served_by           UUID,                             -- FK to staff (waiter)
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE order_item_modifiers (
    order_item_id   UUID NOT NULL REFERENCES order_items(id) ON DELETE CASCADE,
    modifier_id     UUID NOT NULL REFERENCES modifiers(id),
    PRIMARY KEY (order_item_id, modifier_id)
);

-- ============================================================================
-- SECTION 6: BILLING
-- ============================================================================

CREATE TABLE taxes (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    outlet_id       UUID NOT NULL REFERENCES outlets(id) ON DELETE CASCADE,
    name            VARCHAR(50) NOT NULL,                -- CGST, SGST, Service Charge
    percentage      NUMERIC(5,2) NOT NULL,
    applicable_on   VARCHAR(20) NOT NULL DEFAULT 'bill' CHECK (applicable_on IN ('bill','item')),
    is_active       BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE bills (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id     UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    outlet_id           UUID NOT NULL REFERENCES outlets(id) ON DELETE CASCADE,
    billing_station_id  UUID NOT NULL REFERENCES billing_stations(id),
    order_id            UUID NOT NULL REFERENCES orders(id),
    bill_number         VARCHAR(30) NOT NULL,             -- sequential, per outlet
    subtotal            NUMERIC(10,2) NOT NULL,
    discount_amount     NUMERIC(10,2) NOT NULL DEFAULT 0,
    tax_amount          NUMERIC(10,2) NOT NULL DEFAULT 0,
    total_amount        NUMERIC(10,2) NOT NULL,
    status              VARCHAR(20) NOT NULL DEFAULT 'open'
                            CHECK (status IN ('open','paid','refunded')),
    created_by          UUID NOT NULL,                    -- FK to staff (cashier)
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    closed_at           TIMESTAMPTZ,
    UNIQUE (outlet_id, bill_number)
);

CREATE TABLE bill_taxes (
    bill_id         UUID NOT NULL REFERENCES bills(id) ON DELETE CASCADE,
    tax_id          UUID NOT NULL REFERENCES taxes(id),
    amount          NUMERIC(10,2) NOT NULL,
    PRIMARY KEY (bill_id, tax_id)
);

-- A bill can be divided into N splits (by item or by number)
CREATE TABLE bill_splits (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bill_id         UUID NOT NULL REFERENCES bills(id) ON DELETE CASCADE,
    split_type      VARCHAR(20) NOT NULL CHECK (split_type IN ('by_item','by_number','none')),
    split_label     VARCHAR(50),                          -- "Person 1", "Guest A"
    amount          NUMERIC(10,2) NOT NULL
);

-- Only populated when split_type = 'by_item'
CREATE TABLE bill_split_items (
    bill_split_id   UUID NOT NULL REFERENCES bill_splits(id) ON DELETE CASCADE,
    order_item_id   UUID NOT NULL REFERENCES order_items(id),
    quantity        INTEGER NOT NULL DEFAULT 1,
    amount          NUMERIC(10,2) NOT NULL,
    PRIMARY KEY (bill_split_id, order_item_id)
);

CREATE TABLE discounts (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bill_id         UUID NOT NULL REFERENCES bills(id) ON DELETE CASCADE,
    order_item_id   UUID REFERENCES order_items(id),      -- NULL = bill-level discount
    discount_type   VARCHAR(20) NOT NULL CHECK (discount_type IN ('flat','percentage')),
    value           NUMERIC(10,2) NOT NULL,
    amount_deducted NUMERIC(10,2) NOT NULL,               -- resolved rupee amount
    applied_by      UUID NOT NULL,                        -- FK to staff (cashier) — no approval needed
    reason          VARCHAR(255),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE payments (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bill_id         UUID NOT NULL REFERENCES bills(id) ON DELETE CASCADE,
    bill_split_id   UUID REFERENCES bill_splits(id),      -- NULL if paid as one lump sum
    payment_method  VARCHAR(20) NOT NULL CHECK (payment_method IN ('cash','card','upi','wallet')),
    amount          NUMERIC(10,2) NOT NULL,
    transaction_ref VARCHAR(100),
    paid_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- SECTION 7: NOTIFICATIONS & AUDIT
-- ============================================================================

CREATE TABLE notifications (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id     UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    staff_id            UUID NOT NULL,                    -- FK to staff (recipient)
    type                VARCHAR(50) NOT NULL,             -- 'item_ready','bill_requested','out_of_stock', etc.
    message             VARCHAR(255) NOT NULL,
    related_order_id    UUID REFERENCES orders(id),
    related_order_item_id UUID REFERENCES order_items(id),
    is_read             BOOLEAN NOT NULL DEFAULT false,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE audit_logs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    outlet_id       UUID REFERENCES outlets(id),
    staff_id        UUID NOT NULL,                        -- FK to staff (actor)
    action          VARCHAR(80) NOT NULL,                 -- 'discount.apply','item.cancel','table.merge'
    entity_type     VARCHAR(50) NOT NULL,                 -- 'order_item','bill','table', etc.
    entity_id       UUID NOT NULL,
    before_json     JSONB,
    after_json      JSONB,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- SECTION 8: INDEXES (high-traffic query paths)
-- ============================================================================

CREATE INDEX idx_tables_outlet_status ON tables (outlet_id, status);
CREATE INDEX idx_order_items_kitchen_status ON order_items (kitchen_id, status);
CREATE INDEX idx_order_items_order ON order_items (order_id);
CREATE INDEX idx_orders_outlet_status ON orders (outlet_id, status);
CREATE INDEX idx_bills_outlet_status ON bills (outlet_id, status);
CREATE INDEX idx_notifications_staff_unread ON notifications (staff_id, is_read);
CREATE INDEX idx_menu_items_outlet_category ON menu_items (outlet_id, category_id);
CREATE INDEX idx_reservations_floor_time ON reservations (floor_id, reservation_time);
CREATE INDEX idx_audit_logs_org_entity ON audit_logs (organization_id, entity_type, entity_id);

-- ============================================================================
-- NOTES FOR ANALYTICS LAYER (build as views / materialized views on top of
-- the above, refreshed periodically — not raw tables):
--   - best/worst dishes            -> aggregate order_items by menu_item_id
--   - daily/weekly/monthly/annual  -> group bills.created_at by date_trunc
--   - per-item earning & discount  -> join order_items + discounts
--   - per-category earning         -> join order_items -> menu_items -> menu_categories
--   - staff performance            -> group order_items.served_by / orders.captain_id
--   - kitchen prep time            -> ready_at - accepted_at per order_item
--   - table turnover                -> orders.closed_at - orders.created_at per table_id
-- ============================================================================

-- ============================================================================
-- NOTES FOR SAAS ROW-LEVEL SECURITY (Postgres RLS, illustrative):
--   ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
--   CREATE POLICY tenant_isolation ON orders
--       USING (organization_id = current_setting('app.current_org_id')::uuid);
--   Set app.current_org_id per-connection/session at the application layer
--   right after authenticating the request's tenant.
-- ============================================================================