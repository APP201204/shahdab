const API_BASE =
  ((import.meta.env as Record<string, string | undefined>)["VITE_API_URL"]) ??
  "http://localhost:4000/api/v1";

async function fetchApi<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Request failed: ${res.status}`);
  }
  return res.json();
}

function get(path: string) {
  return fetchApi<unknown>(path, { method: "GET" });
}

function post(path: string, body?: unknown) {
  const init: RequestInit = {
    method: "POST",
    body: body ? JSON.stringify(body) : null,
  };
  if (!body) init.headers = {};
  return fetchApi<unknown>(path, init);
}

function put(path: string, body?: unknown) {
  const init: RequestInit = {
    method: "PUT",
    body: body ? JSON.stringify(body) : null,
  };
  if (!body) init.headers = {};
  return fetchApi<unknown>(path, init);
}

export type StaffRole =
  | "captain"
  | "waiter"
  | "kitchen-manager"
  | "cashier"
  | "outlet-manager"
  | "admin";

export type Staff = {
  id: string;
  userId: string;
  outletId: string;
  name: string;
  phone: string;
  active: boolean;
  roles: StaffRole[];
  assignment?: string | null;
  createdAt: string;
};

export type PaymentMethod = "cash" | "card" | "upi" | "wallet";

export type Payment = {
  id: string;
  billId: string;
  method: PaymentMethod;
  amount: number;
};

export type BillItem = {
  id: string;
  billId: string;
  orderItemId: string;
  name: string;
  variant?: string | null;
  qty: number;
  unitPrice: number;
  mrp: boolean;
};

export type Bill = {
  id: string;
  number: string;
  outletId: string;
  orderId: string;
  sectionId: string;
  unitId: string;
  unitName: string;
  orderType: "dine-in" | "takeaway";
  customer?: string | null;
  subtotal: number;
  discount: number;
  tax: number;
  serviceCharge: number;
  total: number;
  status: "open" | "paid";
  cashierId: string;
  cashier: string;
  createdAt: string;
  closedAt?: string | null;
  items: BillItem[];
  payments: Payment[];
};

export type BillingQueueItem = {
  type: "table" | "merge" | "takeaway";
  unitId: string;
  unitName: string;
  sectionId: string;
  sectionName?: string;
  requested: boolean;
  waiter?: string;
  guests: number;
  startedAt?: string | null;
  order: { id: string; status: string } | null;
  items: OrderLine[];
};

export type BillPreview = {
  order: { id: string; status: string };
  items: OrderLine[];
  discountInput: { kind: "flat" | "percent"; value: number };
  serviceChargeRate: number;
  taxRates: { cgst: number; sgst: number };
  subtotal: number;
  discount: number;
  tax: number;
  serviceCharge: number;
  total: number;
  rounding: number;
};

export type Section = {
  id: string;
  outletId: string;
  name: string;
  type: "dine-in" | "takeaway";
  tagline?: string | null;
  serviceCharge: number;
  color?: string | null;
  ownBranding: boolean;
  active: boolean;
};

export type TableStatus =
  | "available"
  | "reserved"
  | "occupied"
  | "bill-requested"
  | "paid"
  | "needs-cleaning";

export type Table = {
  id: string;
  outletId: string;
  sectionId: string;
  floorId?: string | null;
  number: number;
  name: string;
  capacity: number;
  status: TableStatus;
  guests: number;
  waiterId?: string | null;
  waiter?: string;
  startedAt?: string | null;
  kots: number;
  mergeGroupId?: string | null;
  splitGroupId?: string | null;
  parentTableId?: string | null;
  suffix?: string | null;
  createdAt: string;
};

export type TableMergeGroup = {
  id: string;
  outletId: string;
  sectionId: string;
  name: string;
  status: "active" | "released";
  waiter?: string;
  guests: number;
  tableIds: string[];
};

export type TableSplitGroup = {
  id: string;
  outletId: string;
  parentTableId: string;
  sectionId: string;
  status: "active" | "released";
  subTableIds: string[];
};

export type ReservationStatus = "booked" | "seated" | "cancelled" | "no-show";

export type Reservation = {
  id: string;
  outletId: string;
  sectionId: string;
  tableId?: string | null;
  guestName: string;
  phone: string;
  partySize: number;
  time: string;
  status: ReservationStatus;
  createdAt: string;
};

export type OrderLine = {
  id: string;
  orderId: string;
  itemId: string;
  name: string;
  variant?: string | null;
  qty: number;
  unitPrice: number;
  batch?: number | null;
  note?: string | null;
  status?: string | null;
  kitchenStatus?: string | null;
  served: boolean;
  mrp: boolean;
};

export type OrderUnit = {
  id: string;
  orderId?: string;
  name: string;
  orderType?: "dine-in" | "takeaway";
  sectionId?: string | null;
  sectionName?: string;
  waiter?: string;
  lines: OrderLine[];
};

export type Notification = {
  id: string;
  outletId: string;
  userId?: string | null;
  message: string;
  read: boolean;
  at: string;
};

export type MenuItem = {
  id: string;
  outletId: string;
  categoryId: string;
  kitchenId?: string | null;
  name: string;
  foodType: "veg" | "non-veg";
  basePrice: number;
  favorite: boolean;
  spicy: boolean;
  mrp: boolean;
  status: "available" | "unavailable" | "not-offered" | "disabled";
  outOfStock?: boolean;
  variants?: MenuItemVariant[];
};

export type MenuItemVariant = {
  id: string;
  itemId: string;
  name: string;
  price: number;
  available: boolean;
};

export type MenuCategory = {
  id: string;
  outletId: string;
  name: string;
  sortOrder: number;
  items: MenuItem[];
};

export type CreateReservationInput = {
  outletId: string;
  guestName: string;
  phone: string;
  partySize: number;
  time: string;
  sectionId: string;
  tableId?: string;
};

export const api = {
  menu: {
    list: (outlet: string, includeOutOfStock?: boolean) =>
      get(
        `/menu?outlet=${encodeURIComponent(outlet)}${includeOutOfStock ? "&includeOutOfStock=true" : ""}`
      ) as Promise<{ categories: MenuCategory[] }>,
  },
  menuItems: {
    toggleStockOut: (id: string, staffId: string) =>
      post(`/menu-items/${encodeURIComponent(id)}/stock-out`, { staffId }) as Promise<{
        outOfStock: boolean;
      }>,
  },
  staff: {
    list: (outlet: string) =>
      get(`/staff?outlet=${encodeURIComponent(outlet)}`) as Promise<{ staff: Staff[] }>,
    create: (input: {
      outletId: string;
      name: string;
      phone: string;
      roles: StaffRole[];
      assignment?: string;
      active?: boolean;
    }) => post("/staff", input) as Promise<Staff>,
    update: (
      id: string,
      input: {
        name?: string;
        phone?: string;
        roles?: StaffRole[];
        assignment?: string;
        active?: boolean;
      }
    ) => put(`/staff/${encodeURIComponent(id)}`, input) as Promise<Staff>,
  },
  sections: {
    list: (outlet: string) =>
      get(`/sections?outlet=${encodeURIComponent(outlet)}`) as Promise<{ sections: Section[] }>,
  },
  bills: {
    list: (outlet: string) =>
      get(`/bills?outlet=${encodeURIComponent(outlet)}`) as Promise<{ bills: Bill[] }>,
    get: (id: string) => get(`/bills/${encodeURIComponent(id)}`) as Promise<Bill>,
  },
  billing: {
    queue: (outlet: string) =>
      get(`/billing/queue?outlet=${encodeURIComponent(outlet)}`) as Promise<{ queue: BillingQueueItem[] }>,
    preview: (orderId: string, discount?: { kind: "flat" | "percent"; value: number }) =>
      post("/billing/preview", { orderId, discount: discount ?? { kind: "flat", value: 0 } }) as Promise<BillPreview>,
    close: (body: {
      orderId: string;
      payments: { method: PaymentMethod; amount: number }[];
      cashierId: string;
      customer?: string;
      discount?: { kind: "flat" | "percent"; value: number };
    }) => post("/bills", body) as Promise<Bill>,
  },
  tables: {
    list: (outlet: string) =>
      get(`/tables?outlet=${encodeURIComponent(outlet)}`) as Promise<{ tables: Table[] }>,
    update: (id: string, body: { number?: number; capacity?: number; name?: string }) =>
      put(`/tables/${encodeURIComponent(id)}`, body) as Promise<Table>,
    groups: (outlet: string) =>
      get(`/tables/groups?outlet=${encodeURIComponent(outlet)}`) as Promise<{
        mergeGroups: TableMergeGroup[];
        splitGroups: TableSplitGroup[];
      }>,
    seat: (id: string, guests: number, waiterId?: string) =>
      post(`/tables/${encodeURIComponent(id)}/seat`, { guests, ...(waiterId ? { waiterId } : {}) }) as Promise<{
        table: Table;
        order: { id: string } | null;
      }>,
    requestBill: (id: string) =>
      post(`/tables/${encodeURIComponent(id)}/request-bill`) as Promise<Table>,
    needsCleaning: (id: string) =>
      post(`/tables/${encodeURIComponent(id)}/needs-cleaning`) as Promise<Table>,
    markCleaned: (id: string) =>
      post(`/tables/${encodeURIComponent(id)}/mark-cleaned`) as Promise<Table>,
    move: (id: string, toTableId: string) =>
      post(`/tables/${encodeURIComponent(id)}/move`, { toTableId }) as Promise<{ from: Table; to: Table }>,
    merge: (body: { tableIds: string[]; guests?: number; waiterId?: string; name?: string }) =>
      post("/table-merges", body) as Promise<unknown>,
    releaseMerge: (id: string) =>
      post(`/table-merges/${encodeURIComponent(id)}/release`) as Promise<unknown>,
    split: (tableId: string, subTables: { capacity: number; name?: string }[]) =>
      post("/table-splits", { tableId, subTables }) as Promise<unknown>,
    unsplit: (id: string) =>
      post(`/table-splits/${encodeURIComponent(id)}/unsplit`) as Promise<unknown>,
  },
  reservations: {
    list: (outlet: string) =>
      get(`/reservations?outlet=${encodeURIComponent(outlet)}`) as Promise<{
        reservations: Reservation[];
      }>,
    create: (input: CreateReservationInput) =>
      post("/reservations", input) as Promise<Reservation>,
    seat: (id: string, body?: { waiterId?: string }) =>
      post(`/reservations/${encodeURIComponent(id)}/seat`, body) as Promise<Reservation>,
    cancel: (id: string) =>
      post(`/reservations/${encodeURIComponent(id)}/cancel`) as Promise<Reservation>,
    noShow: (id: string) =>
      post(`/reservations/${encodeURIComponent(id)}/no-show`) as Promise<Reservation>,
  },
  orders: {
    active: (outlet: string) =>
      get(`/orders/active?outlet=${encodeURIComponent(outlet)}`) as Promise<{
        units: OrderUnit[];
      }>,
    addItems: (
      orderId: string,
      items: { menuItemId: string; variantId?: string; qty: number; note?: string }[]
    ) =>
      post(`/orders/${encodeURIComponent(orderId)}/items`, { items }) as Promise<{
        order: { id: string };
        items: OrderLine[];
      }>,
    sendToKitchen: (orderId: string, createdBy: string) =>
      post(`/orders/${encodeURIComponent(orderId)}/send-to-kitchen`, { createdBy }) as Promise<unknown>,
    createTakeaway: (body: {
      sectionId: string;
      customerName: string;
      customerPhone: string;
      items: { menuItemId: string; variantId?: string; qty: number; note?: string }[];
    }) =>
      post("/orders/takeaway", body) as Promise<{
        order: { id: string; status: string };
      }>,
    pickup: (orderId: string) =>
      post(`/orders/${encodeURIComponent(orderId)}/pickup`) as Promise<unknown>,
  },
  orderItems: {
    serve: (id: string) =>
      post(`/order-items/${encodeURIComponent(id)}/served`) as Promise<unknown>,
    updateNote: (id: string, note: string) =>
      put(`/order-items/${encodeURIComponent(id)}/note`, { note }) as Promise<unknown>,
    cancel: (id: string) =>
      post(`/order-items/${encodeURIComponent(id)}/cancel`) as Promise<unknown>,
  },
  kitchen: {
    tickets: (outlet: string) =>
      get(`/kitchen/tickets?outlet=${encodeURIComponent(outlet)}`) as Promise<{
        tickets: any[];
      }>,
    accept: (id: string) =>
      post(`/order-items/${encodeURIComponent(id)}/accept`) as Promise<unknown>,
    startCooking: (id: string) =>
      post(`/order-items/${encodeURIComponent(id)}/start-cooking`) as Promise<unknown>,
    markReady: (id: string) =>
      post(`/order-items/${encodeURIComponent(id)}/ready`) as Promise<unknown>,
    markAllReady: (orderId: string) =>
      post(`/orders/${encodeURIComponent(orderId)}/takeaway-all-ready`) as Promise<unknown>,
  },
  notifications: {
    list: (outletId: string) =>
      get(`/notifications?outletId=${encodeURIComponent(outletId)}`) as Promise<{
        notifications: Notification[];
      }>,
    markRead: (outletId: string, ids?: string[]) =>
      post("/notifications/read", { outletId, ...(ids?.length ? { ids } : {}) }) as Promise<unknown>,
  },
  auth: {
    login: (body: { phone: string; password: string }) =>
      post("/auth/login", body) as Promise<{
        staff: SessionStaff;
      }>,
    me: () => get("/auth/me") as Promise<{ staff: SessionStaff } | null>,
    logout: () => post("/auth/logout") as Promise<{ ok: boolean }>,
  },
};

export type SessionStaff = {
  userId: string;
  staffId: string;
  outletId: string;
  orgId: string;
  roles: StaffRole[];
  name: string;
  phone: string;
};
