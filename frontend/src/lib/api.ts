const API_BASE =
  ((import.meta.env as Record<string, string | undefined>)["VITE_API_URL"]) ??
  "http://localhost:4000/api/v1";

async function fetchApi<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
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
  return fetchApi<unknown>(path, {
    method: "POST",
    body: body ? JSON.stringify(body) : null,
  });
}

function put(path: string, body?: unknown) {
  return fetchApi<unknown>(path, {
    method: "PUT",
    body: body ? JSON.stringify(body) : null,
  });
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
  startedAt?: string | null;
  kots: number;
  mergeGroupId?: string | null;
  splitGroupId?: string | null;
  parentTableId?: string | null;
  suffix?: string | null;
  createdAt: string;
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
  tables: {
    list: (outlet: string) =>
      get(`/tables?outlet=${encodeURIComponent(outlet)}`) as Promise<{ tables: Table[] }>,
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
};
