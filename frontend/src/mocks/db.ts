import type {
  AuditLog,
  Database,
  Floor,
  Kitchen,
  MenuCategory,
  MenuItem,
  MenuItemFloorPrice,
  MenuItemVariant,
  Modifier,
  Notification,
  NotificationType,
  Order,
  OrderItem,
  Outlet,
  Payment,
  Reservation,
  Role,
  Staff,
  StaffFloorAssignment,
  StaffKitchenAssignment,
  StaffRole,
  StaffTableAssignment,
  Table,
  Tax,
} from "@/types";

export const generateId = () => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  const random = Math.floor(Math.random() * 1_000_000_000).toString(36);
  return `id-${Date.now()}-${random}`;
};

const mkId = (prefix: string, index: number) =>
  `${prefix}-${String(index).padStart(3, "0")}`;
const now = new Date().toISOString();

export const db: Database = {
  organizations: [],
  outlets: [],
  floors: [],
  kitchens: [],
  billingStations: [],
  tables: [],
  tableMergeGroups: [],
  tableMergeGroupMembers: [],
  tableTransfers: [],
  reservations: [],
  roles: [],
  permissions: [],
  rolePermissions: [],
  staff: [],
  staffRoles: [],
  staffFloorAssignments: [],
  staffTableAssignments: [],
  staffKitchenAssignments: [],
  menuCategories: [],
  menuItems: [],
  menuItemVariants: [],
  menuItemFloorPrices: [],
  menuItemStockStatus: [],
  modifiers: [],
  menuItemModifiers: [],
  orders: [],
  kotBatches: [],
  orderItems: [],
  orderItemModifiers: [],
  taxes: [],
  bills: [],
  billTaxes: [],
  billSplits: [],
  billSplitItems: [],
  discounts: [],
  payments: [],
  notifications: [],
  auditLogs: [],
  waitlist: [],
};

export class DataService<T extends { id: string }> {
  constructor(private items: T[]) {}

  findAll(): T[] {
    return [...this.items];
  }

  findById(id: string): T | undefined {
    return this.items.find((item) => item.id === id);
  }

  findOne(predicate: (item: T) => boolean): T | undefined {
    return this.items.find(predicate);
  }

  create(body: Omit<T, "id">): T {
    const item = { ...body, id: generateId() } as T;
    this.items.push(item);
    return item;
  }

  update(id: string, patch: Partial<T>): T | undefined {
    const index = this.items.findIndex((item) => item.id === id);
    if (index === -1) return undefined;
    this.items[index] = { ...this.items[index], ...patch };
    return this.items[index];
  }

  remove(id: string): boolean {
    const index = this.items.findIndex((item) => item.id === id);
    if (index === -1) return false;
    this.items.splice(index, 1);
    return true;
  }
}

export type CollectionWithId = {
  [K in keyof Database]: Database[K][number] extends { id: string } ? K : never;
}[keyof Database];

export function dataService<K extends CollectionWithId>(
  key: K
): DataService<Database[K][number]> {
  return new DataService(db[key] as Array<Database[K][number]>);
}

const allPermissions = [
  { code: "organization.read", description: "View organization details" },
  { code: "organization.update", description: "Update organization" },
  { code: "outlet.create", description: "Create a new outlet" },
  { code: "outlet.read", description: "List and view outlets" },
  { code: "outlet.update", description: "Update outlet details" },
  { code: "floor.create", description: "Create a floor" },
  { code: "floor.update", description: "Update a floor" },
  { code: "kitchen.create", description: "Create a kitchen" },
  { code: "kitchen.update", description: "Update a kitchen" },
  { code: "billing_station.create", description: "Create a billing station" },
  { code: "table.create", description: "Create tables" },
  { code: "table.update", description: "Update table details" },
  { code: "table.merge", description: "Merge tables" },
  { code: "table.split", description: "Split merged tables" },
  { code: "table.transfer", description: "Transfer tables" },
  { code: "reservation.create", description: "Create reservations" },
  { code: "reservation.update", description: "Manage reservations" },
  { code: "reservation.seat", description: "Seat a reservation" },
  { code: "staff.create", description: "Create staff" },
  { code: "staff.update", description: "Update staff" },
  { code: "menu.create", description: "Create menu categories and items" },
  { code: "menu.update", description: "Update menu" },
  { code: "menu.read", description: "Browse the menu" },
  { code: "stock.update", description: "Toggle stock-out status" },
  { code: "order.create", description: "Create orders" },
  { code: "order.read", description: "View orders" },
  { code: "order.cancel", description: "Cancel order items" },
  { code: "kitchen.tickets.read", description: "View kitchen tickets" },
  { code: "kitchen.tickets.update", description: "Update kitchen item status" },
  { code: "kitchen.takeaway.read", description: "View takeaway queue" },
  { code: "bill.create", description: "Generate a bill" },
  { code: "bill.read", description: "View bills" },
  { code: "bill.discount.apply", description: "Apply discounts" },
  { code: "bill.split", description: "Split bills" },
  { code: "bill.payment.create", description: "Record payments" },
  { code: "bill.close", description: "Close a bill" },
  { code: "payment.read", description: "View payments" },
  { code: "analytics.read", description: "View analytics" },
  { code: "audit.read", description: "View audit logs" },
  { code: "notification.read", description: "View notifications" },
  { code: "setup.manage", description: "Manage outlet setup" },
];

export const permissionsMatrix: Record<string, string[]> = {
  admin: allPermissions.map((p) => p.code),
  outlet_manager: [
    "outlet.read",
    "outlet.update",
    "floor.create",
    "floor.update",
    "kitchen.create",
    "kitchen.update",
    "billing_station.create",
    "table.create",
    "table.update",
    "reservation.create",
    "reservation.update",
    "reservation.seat",
    "staff.create",
    "staff.update",
    "menu.create",
    "menu.update",
    "menu.read",
    "order.read",
    "kitchen.tickets.read",
    "bill.read",
    "payment.read",
    "analytics.read",
    "notification.read",
    "setup.manage",
  ],
  captain: [
    "table.merge",
    "table.split",
    "table.transfer",
    "reservation.create",
    "reservation.update",
    "reservation.seat",
    "menu.read",
    "order.create",
    "order.read",
    "order.cancel",
    "notification.read",
  ],
  waiter: [
    "order.read",
    "notification.read",
  ],
  kitchen_manager: [
    "kitchen.tickets.read",
    "kitchen.tickets.update",
    "kitchen.takeaway.read",
    "stock.update",
    "notification.read",
  ],
  cashier: [
    "bill.create",
    "bill.read",
    "bill.discount.apply",
    "bill.split",
    "bill.payment.create",
    "bill.close",
    "payment.read",
    "order.read",
    "notification.read",
  ],
};

export function can(roleNames: string[], permission: string): boolean {
  return roleNames.some((role) => permissionsMatrix[role]?.includes(permission));
}

function seed() {
  const orgId = mkId("org", 1);
  db.organizations.push({
    id: orgId,
    name: "Shahdab Demo",
    slug: "shahdab-demo",
    timezone: "Asia/Kolkata",
    currency: "INR",
    status: "active",
    created_at: now,
    updated_at: now,
  });

  const outlets: Outlet[] = [
    {
      id: mkId("out", 1),
      organization_id: orgId,
      name: "Mumbai Central",
      address: "123 Marine Drive, Mumbai",
      timezone: "Asia/Kolkata",
      currency: "INR",
      is_active: true,
      created_at: now,
    },
    {
      id: mkId("out", 2),
      organization_id: orgId,
      name: "Delhi NCR",
      address: "45 Connaught Place, New Delhi",
      timezone: "Asia/Kolkata",
      currency: "INR",
      is_active: true,
      created_at: now,
    },
  ];
  db.outlets.push(...outlets);

  const floors: Floor[] = [
    {
      id: mkId("flr", 1),
      organization_id: orgId,
      outlet_id: outlets[0].id,
      name: "Ground Floor",
      display_order: 1,
      is_active: true,
    },
    {
      id: mkId("flr", 2),
      organization_id: orgId,
      outlet_id: outlets[0].id,
      name: "First Floor",
      display_order: 2,
      is_active: true,
    },
  ];
  db.floors.push(...floors);

  const kitchens: Kitchen[] = [
    {
      id: mkId("kit", 1),
      organization_id: orgId,
      outlet_id: outlets[0].id,
      name: "Veg Kitchen",
      is_active: true,
    },
    {
      id: mkId("kit", 2),
      organization_id: orgId,
      outlet_id: outlets[0].id,
      name: "Non-Veg Kitchen",
      is_active: true,
    },
    {
      id: mkId("kit", 3),
      organization_id: orgId,
      outlet_id: outlets[0].id,
      name: "Bar & Beverages",
      is_active: true,
    },
  ];
  db.kitchens.push(...kitchens);

  db.billingStations.push(
    {
      id: mkId("bill-station", 1),
      organization_id: orgId,
      outlet_id: outlets[0].id,
      floor_id: floors[0].id,
      name: "Ground Floor Counter",
      is_active: true,
    },
    {
      id: mkId("bill-station", 2),
      organization_id: orgId,
      outlet_id: outlets[0].id,
      floor_id: floors[1].id,
      name: "First Floor Counter",
      is_active: true,
    }
  );

  const tableStatuses: Table["status"][] = [
    "occupied",
    "reserved",
    "bill_requested",
    "vacant",
    "vacant",
    "vacant",
    "vacant",
    "needs_cleaning",
  ];
  const tablePartySizes = [4, 0, 4, 0, 0, 0, 0, 0];
  const tables: Table[] = Array.from({ length: 8 }, (_, i) => {
    const occupiedCount = tablePartySizes[i] || null;
    const isOccupied = occupiedCount !== null && tableStatuses[i] !== "vacant" && tableStatuses[i] !== "needs_cleaning";
    const expectedVacantAt =
      isOccupied
        ? new Date(Date.now() + occupiedCount * 30 * 60_000).toISOString()
        : null;
    return {
      id: mkId("tbl", i + 1),
      organization_id: orgId,
      outlet_id: outlets[0].id,
      floor_id: i < 4 ? floors[0].id : floors[1].id,
      table_number: String(i + 1),
      capacity: i % 2 === 0 ? 4 : 6,
      status: tableStatuses[i],
      merge_group_id: null,
      is_active: true,
      avg_time_per_person: 30,
      occupied_at: isOccupied ? now : null,
      occupied_by_count: occupiedCount,
      expected_vacant_at: expectedVacantAt,
    };
  });
  db.tables.push(...tables);

  const roles: Role[] = [
    { id: mkId("role", 1), organization_id: null, name: "admin", is_system_role: true },
    { id: mkId("role", 2), organization_id: null, name: "outlet_manager", is_system_role: true },
    { id: mkId("role", 3), organization_id: null, name: "captain", is_system_role: true },
    { id: mkId("role", 4), organization_id: null, name: "waiter", is_system_role: true },
    { id: mkId("role", 5), organization_id: null, name: "kitchen_manager", is_system_role: true },
    { id: mkId("role", 6), organization_id: null, name: "cashier", is_system_role: true },
  ];
  db.roles.push(...roles);

  db.permissions.push(
    ...allPermissions.map((p, i) => ({
      id: mkId("perm", i + 1),
      code: p.code,
      description: p.description,
    }))
  );

  for (const role of roles) {
    const codes = permissionsMatrix[role.name] ?? [];
    for (const code of codes) {
      const permission = db.permissions.find((p) => p.code === code);
      if (permission) {
        db.rolePermissions.push({ role_id: role.id, permission_id: permission.id });
      }
    }
  }

  const staffList: Staff[] = [
    {
      id: mkId("staff", 1),
      organization_id: orgId,
      outlet_id: null,
      name: "Rahul Sharma",
      phone: "+91-90000-00001",
      email: "rahul@shahdab.demo",
      password_hash: "demo-admin",
      status: "active",
      created_at: now,
    },
    {
      id: mkId("staff", 2),
      organization_id: orgId,
      outlet_id: outlets[0].id,
      name: "Priya Patel",
      phone: "+91-90000-00002",
      email: "priya@shahdab.demo",
      password_hash: "demo-om",
      status: "active",
      created_at: now,
    },
    {
      id: mkId("staff", 3),
      organization_id: orgId,
      outlet_id: outlets[0].id,
      name: "Amit Kumar",
      phone: "+91-90000-00003",
      email: "amit@shahdab.demo",
      password_hash: "demo-cap",
      status: "active",
      created_at: now,
    },
    {
      id: mkId("staff", 4),
      organization_id: orgId,
      outlet_id: outlets[0].id,
      name: "Sita Devi",
      phone: "+91-90000-00004",
      email: "sita@shahdab.demo",
      password_hash: "demo-wtr",
      status: "active",
      created_at: now,
    },
    {
      id: mkId("staff", 5),
      organization_id: orgId,
      outlet_id: outlets[0].id,
      name: "Vikram Rao",
      phone: "+91-90000-00005",
      email: "vikram@shahdab.demo",
      password_hash: "demo-km",
      status: "active",
      created_at: now,
    },
    {
      id: mkId("staff", 6),
      organization_id: orgId,
      outlet_id: outlets[0].id,
      name: "Neha Gupta",
      phone: "+91-90000-00006",
      email: "neha@shahdab.demo",
      password_hash: "demo-csh",
      status: "active",
      created_at: now,
    },
  ];
  db.staff.push(...staffList);

  const staffRoles: StaffRole[] = [
    { staff_id: staffList[0].id, role_id: roles[0].id, outlet_id: outlets[0].id },
    { staff_id: staffList[1].id, role_id: roles[1].id, outlet_id: outlets[0].id },
    { staff_id: staffList[2].id, role_id: roles[2].id, outlet_id: outlets[0].id },
    { staff_id: staffList[3].id, role_id: roles[3].id, outlet_id: outlets[0].id },
    { staff_id: staffList[4].id, role_id: roles[4].id, outlet_id: outlets[0].id },
    { staff_id: staffList[5].id, role_id: roles[5].id, outlet_id: outlets[0].id },
  ];
  db.staffRoles.push(...staffRoles);

  const staffFloorAssignments: StaffFloorAssignment[] = [
    { staff_id: staffList[2].id, floor_id: floors[0].id },
    { staff_id: staffList[3].id, floor_id: floors[0].id },
    { staff_id: staffList[3].id, floor_id: floors[1].id },
  ];
  db.staffFloorAssignments.push(...staffFloorAssignments);

  const staffTableAssignments: StaffTableAssignment[] = [
    { staff_id: staffList[3].id, table_id: tables[0].id, assigned_at: now },
    { staff_id: staffList[3].id, table_id: tables[1].id, assigned_at: now },
    { staff_id: staffList[3].id, table_id: tables[4].id, assigned_at: now },
  ];
  db.staffTableAssignments.push(...staffTableAssignments);

  const staffKitchenAssignments: StaffKitchenAssignment[] = [
    { staff_id: staffList[4].id, kitchen_id: kitchens[0].id },
    { staff_id: staffList[4].id, kitchen_id: kitchens[1].id },
  ];
  db.staffKitchenAssignments.push(...staffKitchenAssignments);

  const categories: MenuCategory[] = [
    { id: mkId("cat", 1), organization_id: orgId, outlet_id: outlets[0].id, name: "Starters", display_order: 1, is_active: true },
    { id: mkId("cat", 2), organization_id: orgId, outlet_id: outlets[0].id, name: "Main Course", display_order: 2, is_active: true },
    { id: mkId("cat", 3), organization_id: orgId, outlet_id: outlets[0].id, name: "Breads & Rice", display_order: 3, is_active: true },
    { id: mkId("cat", 4), organization_id: orgId, outlet_id: outlets[0].id, name: "Beverages", display_order: 4, is_active: true },
  ];
  db.menuCategories.push(...categories);

  const menuSeed: {
    name: string;
    categoryId: string;
    kitchenId: string;
    hasVariants: boolean;
    basePrice: number;
  }[] = [
    { name: "Paneer Tikka", categoryId: categories[0].id, kitchenId: kitchens[0].id, hasVariants: true, basePrice: 320 },
    { name: "Veg Seekh Kebab", categoryId: categories[0].id, kitchenId: kitchens[0].id, hasVariants: false, basePrice: 280 },
    { name: "Chicken Tikka", categoryId: categories[0].id, kitchenId: kitchens[1].id, hasVariants: true, basePrice: 360 },
    { name: "Mutton Seekh", categoryId: categories[0].id, kitchenId: kitchens[1].id, hasVariants: false, basePrice: 420 },
    { name: "Dal Makhani", categoryId: categories[1].id, kitchenId: kitchens[0].id, hasVariants: true, basePrice: 260 },
    { name: "Butter Chicken", categoryId: categories[1].id, kitchenId: kitchens[1].id, hasVariants: true, basePrice: 380 },
    { name: "Palak Paneer", categoryId: categories[1].id, kitchenId: kitchens[0].id, hasVariants: false, basePrice: 300 },
    { name: "Mixed Veg", categoryId: categories[1].id, kitchenId: kitchens[0].id, hasVariants: false, basePrice: 240 },
    { name: "Naan", categoryId: categories[2].id, kitchenId: kitchens[0].id, hasVariants: true, basePrice: 60 },
    { name: "Roti", categoryId: categories[2].id, kitchenId: kitchens[0].id, hasVariants: false, basePrice: 25 },
    { name: "Jeera Rice", categoryId: categories[2].id, kitchenId: kitchens[0].id, hasVariants: false, basePrice: 180 },
    { name: "Veg Biryani", categoryId: categories[2].id, kitchenId: kitchens[0].id, hasVariants: true, basePrice: 220 },
    { name: "Chicken Biryani", categoryId: categories[2].id, kitchenId: kitchens[1].id, hasVariants: true, basePrice: 340 },
    { name: "Fresh Lime Soda", categoryId: categories[3].id, kitchenId: kitchens[2].id, hasVariants: false, basePrice: 120 },
    { name: "Masala Chai", categoryId: categories[3].id, kitchenId: kitchens[2].id, hasVariants: false, basePrice: 60 },
  ];

  const menuItems: MenuItem[] = menuSeed.map((m, i) => ({
    id: mkId("item", i + 1),
    organization_id: orgId,
    outlet_id: outlets[0].id,
    category_id: m.categoryId,
    kitchen_id: m.kitchenId,
    name: m.name,
    description: null,
    image_url: null,
    is_active: true,
  }));
  db.menuItems.push(...menuItems);

  let variantIndex = 1;
  const variants: MenuItemVariant[] = [];
  const floorPrices: MenuItemFloorPrice[] = [];

  for (let i = 0; i < menuItems.length; i += 1) {
    const item = menuItems[i];
    const base = menuSeed[i].basePrice;

    variants.push({
      id: mkId("var", variantIndex++),
      menu_item_id: item.id,
      variant_name: "Full",
      base_price: base,
      is_default: true,
    });

    if (menuSeed[i].hasVariants) {
      variants.push({
        id: mkId("var", variantIndex++),
        menu_item_id: item.id,
        variant_name: "Half",
        base_price: Math.round((base * 0.6) * 100) / 100,
        is_default: false,
      });
      if (i % 3 === 0) {
        variants.push({
          id: mkId("var", variantIndex++),
          menu_item_id: item.id,
          variant_name: "Family",
          base_price: Math.round(base * 1.8 * 100) / 100,
          is_default: false,
        });
      }
    }
  }

  for (const variant of variants) {
    floorPrices.push(
      { id: mkId("floor-price", floorPrices.length + 1), menu_item_variant_id: variant.id, floor_id: floors[0].id, price: variant.base_price },
      { id: mkId("floor-price", floorPrices.length + 2), menu_item_variant_id: variant.id, floor_id: floors[1].id, price: variant.base_price + 10 }
    );
  }

  db.menuItemVariants.push(...variants);
  db.menuItemFloorPrices.push(...floorPrices);

  db.menuItemStockStatus.push({
    id: mkId("stock", 1),
    menu_item_id: menuItems[13].id,
    outlet_id: outlets[0].id,
    is_out_of_stock: true,
    updated_by: staffList[4].id,
    updated_at: now,
  });

  const modifiers: Modifier[] = [
    { id: mkId("mod", 1), organization_id: orgId, outlet_id: outlets[0].id, name: "Extra Spicy" },
    { id: mkId("mod", 2), organization_id: orgId, outlet_id: outlets[0].id, name: "No Onion" },
    { id: mkId("mod", 3), organization_id: orgId, outlet_id: outlets[0].id, name: "Less Oil" },
  ];
  db.modifiers.push(...modifiers);

  for (let i = 0; i < menuItems.length; i += 1) {
    if (menuItems[i].category_id !== categories[3].id) {
      db.menuItemModifiers.push(
        { menu_item_id: menuItems[i].id, modifier_id: modifiers[0].id },
        { menu_item_id: menuItems[i].id, modifier_id: modifiers[1].id }
      );
    }
  }

  const taxes: Tax[] = [
    { id: mkId("tax", 1), organization_id: orgId, outlet_id: outlets[0].id, name: "CGST", percentage: 2.5, applicable_on: "bill", is_active: true },
    { id: mkId("tax", 2), organization_id: orgId, outlet_id: outlets[0].id, name: "SGST", percentage: 2.5, applicable_on: "bill", is_active: true },
    { id: mkId("tax", 3), organization_id: orgId, outlet_id: outlets[0].id, name: "Service Charge", percentage: 10, applicable_on: "bill", is_active: true },
  ];
  db.taxes.push(...taxes);

  const orderId = mkId("order", 1);
  db.orders.push({
    id: orderId,
    organization_id: orgId,
    outlet_id: outlets[0].id,
    floor_id: floors[0].id,
    order_type: "dine_in",
    table_id: tables[0].id,
    merge_group_id: null,
    customer_name: null,
    customer_phone: null,
    captain_id: staffList[2].id,
    status: "open",
    created_at: now,
    closed_at: null,
  } as Order);

  const kotId = mkId("kot", 1);
  db.kotBatches.push({
    id: kotId,
    order_id: orderId,
    batch_number: 1,
    created_by: staffList[2].id,
    created_at: now,
  });

  const orderItems: OrderItem[] = [
    {
      id: mkId("oi", 1),
      organization_id: orgId,
      order_id: orderId,
      kot_batch_id: kotId,
      menu_item_id: menuItems[0].id,
      menu_item_variant_id: variants[0].id,
      kitchen_id: menuItems[0].kitchen_id,
      quantity: 1,
      unit_price: 320,
      status: "cooking",
      accepted_at: now,
      cooking_at: now,
      ready_at: null,
      served_at: null,
      served_by: null,
      created_at: now,
    },
    {
      id: mkId("oi", 2),
      organization_id: orgId,
      order_id: orderId,
      kot_batch_id: kotId,
      menu_item_id: menuItems[5].id,
      menu_item_variant_id: variants.find((v) => v.menu_item_id === menuItems[5].id && v.variant_name === "Full")?.id ?? variants[0].id,
      kitchen_id: menuItems[5].kitchen_id,
      quantity: 1,
      unit_price: 380,
      status: "placed",
      accepted_at: null,
      cooking_at: null,
      ready_at: null,
      served_at: null,
      served_by: null,
      created_at: now,
    },
    {
      id: mkId("oi", 3),
      organization_id: orgId,
      order_id: orderId,
      kot_batch_id: kotId,
      menu_item_id: menuItems[8].id,
      menu_item_variant_id: variants.find((v) => v.menu_item_id === menuItems[8].id && v.variant_name === "Full")?.id ?? variants[0].id,
      kitchen_id: menuItems[8].kitchen_id,
      quantity: 2,
      unit_price: 60,
      status: "ready",
      accepted_at: now,
      cooking_at: now,
      ready_at: now,
      served_at: null,
      served_by: null,
      created_at: now,
    },
  ];
  db.orderItems.push(...orderItems);

  db.orderItemModifiers.push(
    { order_item_id: orderItems[0].id, modifier_id: modifiers[0].id },
    { order_item_id: orderItems[1].id, modifier_id: modifiers[1].id }
  );

  const reservation: Reservation = {
    id: mkId("res", 1),
    organization_id: orgId,
    outlet_id: outlets[0].id,
    floor_id: floors[0].id,
    table_id: tables[1].id,
    guest_name: "Arjun Mehta",
    guest_phone: "+91-90000-00009",
    party_size: 4,
    reservation_time: new Date(Date.now() + 3_600_000).toISOString(),
    status: "booked",
    created_by: staffList[2].id,
    created_at: now,
  };
  db.reservations.push(reservation);

  const billId = mkId("bill", 1);
  db.bills.push({
    id: billId,
    organization_id: orgId,
    outlet_id: outlets[0].id,
    billing_station_id: db.billingStations[0].id,
    order_id: orderId,
    bill_number: "BILL-0001",
    subtotal: 820,
    discount_amount: 0,
    tax_amount: 123,
    total_amount: 943,
    status: "open",
    created_by: staffList[5].id,
    created_at: now,
    closed_at: null,
  });

  db.billTaxes.push(
    { bill_id: billId, tax_id: taxes[0].id, amount: 20.5 },
    { bill_id: billId, tax_id: taxes[1].id, amount: 20.5 },
    { bill_id: billId, tax_id: taxes[2].id, amount: 82 }
  );

  db.discounts.push({
    id: mkId("discount", 1),
    bill_id: billId,
    order_item_id: null,
    discount_type: "percentage",
    value: 10,
    amount_deducted: 82,
    applied_by: staffList[5].id,
    reason: "Loyalty discount",
    created_at: now,
  });

  const payment: Payment = {
    id: mkId("pay", 1),
    bill_id: billId,
    bill_split_id: null,
    payment_method: "card",
    amount: 943,
    transaction_ref: "TXN-1234",
    paid_at: now,
  };
  db.payments.push(payment);

  const notifications: Notification[] = [
    {
      id: mkId("notif", 1),
      organization_id: orgId,
      staff_id: staffList[3].id,
      type: "item_ready" as NotificationType,
      message: "Butter Chicken is ready to serve",
      related_order_id: orderId,
      related_order_item_id: orderItems[1].id,
      is_read: false,
      created_at: now,
    },
    {
      id: mkId("notif", 2),
      organization_id: orgId,
      staff_id: staffList[5].id,
      type: "bill_requested" as NotificationType,
      message: `Table ${tables[2].table_number} requested the bill`,
      related_order_id: null,
      related_order_item_id: null,
      is_read: false,
      created_at: now,
    },
  ];
  db.notifications.push(...notifications);

  const auditLogs: AuditLog[] = [
    {
      id: mkId("audit", 1),
      organization_id: orgId,
      outlet_id: outlets[0].id,
      staff_id: staffList[4].id,
      action: "stock.update",
      entity_type: "menu_item",
      entity_id: menuItems[13].id,
      before_json: { is_out_of_stock: false },
      after_json: { is_out_of_stock: true },
      created_at: now,
    },
    {
      id: mkId("audit", 2),
      organization_id: orgId,
      outlet_id: outlets[0].id,
      staff_id: staffList[2].id,
      action: "order.create",
      entity_type: "order",
      entity_id: orderId,
      before_json: null,
      after_json: { status: "open" },
      created_at: now,
    },
  ];
  db.auditLogs.push(...auditLogs);
}

seed();
