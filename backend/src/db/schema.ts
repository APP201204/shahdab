import {
  pgEnum,
  pgTable,
  uuid,
  text,
  integer,
  boolean,
  timestamp,
  uniqueIndex,
  primaryKey,
} from "drizzle-orm/pg-core";

export const sectionTypeEnum = pgEnum("section_type", ["dine-in", "takeaway"]);
export const tableStatusEnum = pgEnum("table_status", [
  "available",
  "reserved",
  "occupied",
  "bill-requested",
  "paid",
  "needs-cleaning",
]);
export const foodTypeEnum = pgEnum("food_type", ["veg", "non-veg", "egg"]);
export const menuItemStatusEnum = pgEnum("menu_item_status", [
  "available",
  "unavailable",
  "not-offered",
  "disabled",
]);
export const staffRoleEnum = pgEnum("staff_role", [
  "captain",
  "waiter",
  "kitchen-manager",
  "cashier",
  "outlet-manager",
  "admin",
]);
export const orderTypeEnum = pgEnum("order_type", ["dine-in", "takeaway"]);
export const orderStatusEnum = pgEnum("order_status", [
  "open",
  "partially-served",
  "fully-served",
  "billed",
  "closed",
]);
export const orderItemTableStatusEnum = pgEnum("order_item_table_status", [
  "pending",
  "on-table",
  "cancelled",
]);
export const orderItemKitchenStatusEnum = pgEnum("order_item_kitchen_status", [
  "placed",
  "accepted",
  "cooking",
  "ready",
  "served",
  "cancelled",
]);
export const billStatusEnum = pgEnum("bill_status", ["open", "paid", "refunded"]);
export const paymentMethodEnum = pgEnum("payment_method", ["cash", "card", "upi", "wallet"]);
export const reservationStatusEnum = pgEnum("reservation_status", [
  "booked",
  "seated",
  "cancelled",
  "no-show",
]);
export const mergeStatusEnum = pgEnum("merge_status", ["active", "released"]);
export const splitStatusEnum = pgEnum("split_status", ["active", "released"]);

export const organizations = pgTable("organizations", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  plan: text("plan").notNull().default("trial"),
  maxOutlets: integer("max_outlets").notNull().default(1),
  maxStaff: integer("max_staff").notNull().default(10),
});

export const outlets = pgTable("outlets", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  address: text("address"),
  timezone: text("timezone").notNull().default("Asia/Kolkata"),
  currency: text("currency").notNull().default("INR"),
  active: boolean("active").notNull().default(true),
});

export const floors = pgTable("floors", {
  id: uuid("id").primaryKey().defaultRandom(),
  outletId: uuid("outlet_id").notNull().references(() => outlets.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
});

export const sections = pgTable(
  "sections",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    outletId: uuid("outlet_id").notNull().references(() => outlets.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    type: sectionTypeEnum("type").notNull(),
    tagline: text("tagline"),
    serviceCharge: integer("service_charge").notNull().default(0),
    ownBranding: boolean("own_branding").notNull().default(false),
    color: text("color"),
    active: boolean("active").notNull().default(true),
  },
  (t) => [uniqueIndex("sections_outlet_name_idx").on(t.outletId, t.name)]
);

export const billingStations = pgTable(
  "billing_stations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sectionId: uuid("section_id").notNull().references(() => sections.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
  },
  (t) => [uniqueIndex("billing_stations_section_idx").on(t.sectionId)]
);

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    phone: text("phone").notNull(),
    email: text("email"),
    passwordHash: text("password_hash"),
    active: boolean("active").notNull().default(true),
  },
  (t) => [uniqueIndex("users_org_phone_idx").on(t.orgId, t.phone)]
);

export const staff = pgTable(
  "staff",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    outletId: uuid("outlet_id").notNull().references(() => outlets.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    phone: text("phone").notNull(),
    active: boolean("active").notNull().default(true),
  },
  (t) => [uniqueIndex("staff_user_idx").on(t.userId)]
);

export const staffRoles = pgTable(
  "staff_roles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    staffId: uuid("staff_id").notNull().references(() => staff.id, { onDelete: "cascade" }),
    outletId: uuid("outlet_id").notNull().references(() => outlets.id, { onDelete: "cascade" }),
    role: staffRoleEnum("role").notNull(),
    assignment: text("assignment"),
  },
  (t) => [uniqueIndex("staff_roles_unique_idx").on(t.staffId, t.outletId, t.role)]
);

export const tables = pgTable("tables", {
  id: uuid("id").primaryKey().defaultRandom(),
  outletId: uuid("outlet_id").notNull().references(() => outlets.id, { onDelete: "cascade" }),
  sectionId: uuid("section_id").notNull().references(() => sections.id, { onDelete: "cascade" }),
  floorId: uuid("floor_id").references(() => floors.id),
  number: integer("number").notNull(),
  name: text("name").notNull(),
  capacity: integer("capacity").notNull().default(4),
  status: tableStatusEnum("status").notNull().default("available"),
  guests: integer("guests").notNull().default(0),
  waiterId: uuid("waiter_id").references(() => staff.id),
  startedAt: timestamp("started_at", { withTimezone: true }),
  kots: integer("kots").notNull().default(0),
  mergeGroupId: uuid("merge_group_id"),
  splitGroupId: uuid("split_group_id"),
  parentTableId: uuid("parent_table_id"),
  suffix: text("suffix"),
});

export const tableMergeGroups = pgTable("table_merge_groups", {
  id: uuid("id").primaryKey().defaultRandom(),
  outletId: uuid("outlet_id").notNull().references(() => outlets.id, { onDelete: "cascade" }),
  sectionId: uuid("section_id").notNull().references(() => sections.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  status: mergeStatusEnum("status").notNull(),
  waiterId: uuid("waiter_id").references(() => staff.id),
  guests: integer("guests").notNull().default(0),
});

export const tableMergeGroupTables = pgTable(
  "table_merge_group_tables",
  {
    mergeGroupId: uuid("merge_group_id").notNull().references(() => tableMergeGroups.id, { onDelete: "cascade" }),
    tableId: uuid("table_id").notNull().references(() => tables.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.mergeGroupId, t.tableId] })]
);

export const tableSplitGroups = pgTable("table_split_groups", {
  id: uuid("id").primaryKey().defaultRandom(),
  outletId: uuid("outlet_id").notNull().references(() => outlets.id, { onDelete: "cascade" }),
  parentTableId: uuid("parent_table_id").notNull().references(() => tables.id, { onDelete: "cascade" }),
  sectionId: uuid("section_id").notNull().references(() => sections.id, { onDelete: "cascade" }),
  status: splitStatusEnum("status").notNull(),
});

export const kitchens = pgTable("kitchens", {
  id: uuid("id").primaryKey().defaultRandom(),
  outletId: uuid("outlet_id").notNull().references(() => outlets.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  color: text("color"),
});

export const menuCategories = pgTable("menu_categories", {
  id: uuid("id").primaryKey().defaultRandom(),
  outletId: uuid("outlet_id").notNull().references(() => outlets.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const menuItems = pgTable("menu_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  outletId: uuid("outlet_id").notNull().references(() => outlets.id, { onDelete: "cascade" }),
  categoryId: uuid("category_id").notNull().references(() => menuCategories.id, { onDelete: "cascade" }),
  kitchenId: uuid("kitchen_id").references(() => kitchens.id),
  name: text("name").notNull(),
  foodType: foodTypeEnum("food_type").notNull(),
  basePrice: integer("base_price").notNull(),
  favorite: boolean("favorite").notNull().default(false),
  spicy: boolean("spicy").notNull().default(false),
  mrp: boolean("mrp").notNull().default(false),
  status: menuItemStatusEnum("status").notNull().default("available"),
});

export const menuItemVariants = pgTable("menu_item_variants", {
  id: uuid("id").primaryKey().defaultRandom(),
  itemId: uuid("item_id").notNull().references(() => menuItems.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  price: integer("price").notNull(),
  available: boolean("available").notNull().default(true),
});

export const stockOuts = pgTable("stock_outs", {
  id: uuid("id").primaryKey().defaultRandom(),
  outletId: uuid("outlet_id").notNull().references(() => outlets.id, { onDelete: "cascade" }),
  kitchenId: uuid("kitchen_id").references(() => kitchens.id),
  menuItemId: uuid("menu_item_id").notNull().references(() => menuItems.id, { onDelete: "cascade" }),
  variantId: uuid("variant_id").references(() => menuItemVariants.id),
  toggledAt: timestamp("toggled_at", { withTimezone: true }).notNull().defaultNow(),
  toggledBy: uuid("toggled_by").notNull().references(() => users.id),
  active: boolean("active").notNull().default(true),
});

export const orders = pgTable("orders", {
  id: uuid("id").primaryKey().defaultRandom(),
  outletId: uuid("outlet_id").notNull().references(() => outlets.id, { onDelete: "cascade" }),
  sectionId: uuid("section_id").notNull().references(() => sections.id),
  tableId: uuid("table_id").references(() => tables.id),
  mergeGroupId: uuid("merge_group_id"),
  customerName: text("customer_name"),
  customerPhone: text("customer_phone"),
  orderType: orderTypeEnum("order_type").notNull(),
  status: orderStatusEnum("status").notNull().default("open"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  closedAt: timestamp("closed_at", { withTimezone: true }),
});

export const kotBatches = pgTable("kot_batches", {
  id: uuid("id").primaryKey().defaultRandom(),
  orderId: uuid("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
  batchNumber: integer("batch_number").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  createdBy: uuid("created_by").notNull().references(() => staff.id),
});

export const orderItems = pgTable("order_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  orderId: uuid("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
  kotBatchId: uuid("kot_batch_id").references(() => kotBatches.id),
  kitchenId: uuid("kitchen_id").references(() => kitchens.id),
  menuItemId: uuid("menu_item_id").notNull().references(() => menuItems.id),
  variantId: uuid("variant_id").references(() => menuItemVariants.id),
  name: text("name").notNull(),
  variant: text("variant"),
  qty: integer("qty").notNull(),
  unitPrice: integer("unit_price").notNull(),
  tableStatus: orderItemTableStatusEnum("table_status").notNull().default("pending"),
  kitchenStatus: orderItemKitchenStatusEnum("kitchen_status"),
  mrp: boolean("mrp").notNull().default(false),
  note: text("note"),
  servedAt: timestamp("served_at", { withTimezone: true }),
});

export const bills = pgTable("bills", {
  id: uuid("id").primaryKey().defaultRandom(),
  number: text("number").notNull().unique(),
  outletId: uuid("outlet_id").notNull().references(() => outlets.id, { onDelete: "cascade" }),
  orderId: uuid("order_id").references(() => orders.id),
  sectionId: uuid("section_id").notNull().references(() => sections.id),
  unitId: uuid("unit_id").notNull(),
  unitName: text("unit_name").notNull(),
  orderType: orderTypeEnum("order_type").notNull(),
  customer: text("customer"),
  subtotal: integer("subtotal").notNull().default(0),
  discount: integer("discount").notNull().default(0),
  tax: integer("tax").notNull().default(0),
  serviceCharge: integer("service_charge").notNull().default(0),
  total: integer("total").notNull().default(0),
  status: billStatusEnum("status").notNull().default("open"),
  cashierId: uuid("cashier_id").notNull().references(() => staff.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  closedAt: timestamp("closed_at", { withTimezone: true }),
});

export const billItems = pgTable("bill_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  billId: uuid("bill_id").notNull().references(() => bills.id, { onDelete: "cascade" }),
  orderItemId: uuid("order_item_id").references(() => orderItems.id),
  name: text("name").notNull(),
  variant: text("variant"),
  qty: integer("qty").notNull(),
  unitPrice: integer("unit_price").notNull(),
  mrp: boolean("mrp").notNull().default(false),
});

export const billPayments = pgTable("bill_payments", {
  id: uuid("id").primaryKey().defaultRandom(),
  billId: uuid("bill_id").notNull().references(() => bills.id, { onDelete: "cascade" }),
  method: paymentMethodEnum("method").notNull(),
  amount: integer("amount").notNull(),
});

export const billNumberCounters = pgTable("bill_number_counters", {
  outletId: uuid("outlet_id").primaryKey().references(() => outlets.id, { onDelete: "cascade" }),
  lastNumber: integer("last_number").notNull().default(0),
});

export const reservations = pgTable("reservations", {
  id: uuid("id").primaryKey().defaultRandom(),
  outletId: uuid("outlet_id").notNull().references(() => outlets.id, { onDelete: "cascade" }),
  guestName: text("guest_name").notNull(),
  phone: text("phone").notNull(),
  partySize: integer("party_size").notNull(),
  time: timestamp("time", { withTimezone: true }).notNull(),
  sectionId: uuid("section_id").notNull().references(() => sections.id),
  tableId: uuid("table_id").references(() => tables.id),
  status: reservationStatusEnum("status").notNull(),
});

export const notifications = pgTable("notifications", {
  id: uuid("id").primaryKey().defaultRandom(),
  outletId: uuid("outlet_id").notNull().references(() => outlets.id, { onDelete: "cascade" }),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
  message: text("message").notNull(),
  read: boolean("read").notNull().default(false),
  at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
});
