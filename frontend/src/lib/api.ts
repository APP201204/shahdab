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

export const api = {
  bills: {
    list: (outlet: string) =>
      get(`/bills?outlet=${encodeURIComponent(outlet)}`) as Promise<{ bills: Bill[] }>,
    get: (id: string) => get(`/bills/${encodeURIComponent(id)}`) as Promise<Bill>,
  },
};
