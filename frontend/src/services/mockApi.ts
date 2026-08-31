import { dataService, db } from "@/mocks/db";
import type { CollectionWithId } from "@/mocks/db";
import type { Database, Table } from "@/types";
import { type ApiErrorCode, getErrorMessage } from "@/lib/apiErrors";

export interface ApiResponse<T> {
  data: T | null;
  error: { code: ApiErrorCode; message: string } | null;
  meta?: { requestId: string };
}

const pathToCollection: Record<string, CollectionWithId> = {
  organizations: "organizations",
  outlets: "outlets",
  floors: "floors",
  kitchens: "kitchens",
  "billing-stations": "billingStations",
  tables: "tables",
  reservations: "reservations",
  staff: "staff",
  roles: "roles",
  permissions: "permissions",
  "menu-categories": "menuCategories",
  "menu-items": "menuItems",
  orders: "orders",
  bills: "bills",
  taxes: "taxes",
  notifications: "notifications",
  "audit-logs": "auditLogs",
  "table-merge-groups": "tableMergeGroups",
  "order-items": "orderItems",
};

function parsePath(path: string): { collection: CollectionWithId | null; id: string | null } {
  const parts = path.replace(/^\/|\/$/g, "").split("/");
  const key = pathToCollection[parts[0] ?? ""];
  const id = parts.length > 2 ? null : parts[1] ?? null;
  return { collection: key ?? null, id };
}

const success = <T>(data: T): ApiResponse<T> => ({
  data,
  error: null,
  meta: { requestId: generateId() },
});

const failure = <T>(code: ApiErrorCode, detail?: string): ApiResponse<T> => ({
  data: null,
  error: { code, message: getErrorMessage(code, detail) },
  meta: { requestId: generateId() },
});

function generateId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  const random = Math.floor(Math.random() * 1_000_000_000).toString(36);
  return `req-${Date.now()}-${random}`;
}

function hasActiveOrder(tableId: string): boolean {
  return db.orders.some(
    (o) =>
      (o.table_id === tableId || o.merge_group_id) &&
      o.status !== "closed"
  );
}

type TableMergeBody = {
  table_ids?: string[];
  organization_id: string;
  outlet_id: string;
  floor_id: string;
  staff_id: string;
};

type TableTransferBody = {
  to_table_id?: string;
};

function handleCustomPost<T>(path: string, body: unknown): ApiResponse<T> | null {
  const clean = path.replace(/^\/|\/$/g, "");
  const parts = clean.split("/");
  const now = new Date().toISOString();

  if (clean === "tables/merge") {
    const payload = body as TableMergeBody | undefined;
    if (!payload) {
      return failure("INVALID_BODY", "Request body is required");
    }
    const ids = payload.table_ids;
    if (!ids || ids.length < 2) {
      return failure("INVALID_BODY", "At least two table IDs are required");
    }
    for (const id of ids) {
      if (hasActiveOrder(id)) return failure("TABLE_HAS_ACTIVE_ORDER");
    }
    const group = dataService("tableMergeGroups").create({
      organization_id: payload.organization_id,
      outlet_id: payload.outlet_id,
      floor_id: payload.floor_id,
      status: "active",
      created_by: payload.staff_id,
      created_at: now,
      released_at: null,
    });
    for (const id of ids) {
      dataService("tables").update(id, { merge_group_id: group.id });
      db.tableMergeGroupMembers.push({ merge_group_id: group.id, table_id: id });
    }
    return success(group as T);
  }

  if (parts[0] === "table-merge-groups" && parts[2] === "split") {
    const groupId = parts[1];
    const group = dataService("tableMergeGroups").findById(groupId);
    if (!group) return failure("NOT_FOUND", `tableMergeGroups with id ${groupId}`);
    const members = db.tableMergeGroupMembers
      .filter((m) => m.merge_group_id === group.id)
      .map((m) => db.tables.find((t) => t.id === m.table_id))
      .filter((t): t is Table => t !== undefined);
    for (const m of members) {
      if (hasActiveOrder(m.id)) return failure("TABLE_HAS_ACTIVE_ORDER");
    }
    dataService("tableMergeGroups").update(group.id, {
      status: "released",
      released_at: now,
    });
    for (const m of members) {
      dataService("tables").update(m.id, { merge_group_id: null, status: "vacant" });
    }
    return success({} as T);
  }

  if (parts[0] === "tables" && parts[2] === "transfer") {
    const sourceId = parts[1];
    const payload = body as TableTransferBody | undefined;
    const toId = payload?.to_table_id;
    if (!toId) return failure("INVALID_BODY", "to_table_id is required");
    if (hasActiveOrder(sourceId)) return failure("TABLE_HAS_ACTIVE_ORDER");
    const source = dataService("tables").findById(sourceId);
    const dest = dataService("tables").findById(toId);
    if (!source || !dest) return failure("NOT_FOUND", "table");
    if (dest.status !== "vacant" || hasActiveOrder(dest.id)) {
      return failure("TABLE_NOT_VACANT");
    }
    const reservations = db.reservations.filter(
      (r) => r.table_id === source.id && r.status === "booked"
    );
    for (const res of reservations) {
      dataService("reservations").update(res.id, { table_id: dest.id });
    }
    const assignments = db.staffTableAssignments.filter(
      (a) => a.table_id === source.id
    );
    for (const asgn of assignments) {
      const existsAtDest = db.staffTableAssignments.some(
        (a) => a.staff_id === asgn.staff_id && a.table_id === dest.id
      );
      if (existsAtDest) {
        db.staffTableAssignments = db.staffTableAssignments.filter(
          (a) => !(a.staff_id === asgn.staff_id && a.table_id === source.id)
        );
      } else {
        asgn.table_id = dest.id;
      }
    }
    dataService("tables").update(source.id, { status: "vacant" });
    if (reservations.length > 0) {
      dataService("tables").update(dest.id, { status: "reserved" });
    }
    return success({} as T);
  }

  if (parts[0] === "order-items" && parts[2] === "cancel") {
    const itemId = parts[1];
    const item = dataService("orderItems").findById(itemId);
    if (!item) return failure("NOT_FOUND", `orderItems with id ${itemId}`);
    if (item.status !== "placed" && item.status !== "accepted") {
      return failure("ITEM_ALREADY_COOKING");
    }
    dataService("orderItems").update(item.id, { status: "cancelled" });
    return success(item as T);
  }

  return null;
}

export const mockApi = {
  async get<T>(path: string): Promise<ApiResponse<T>> {
    const { collection, id } = parsePath(path);
    if (!collection) {
      return failure("NOT_FOUND", `No collection found for ${path}`);
    }
    const service = dataService(collection);
    if (id) {
      const item = service.findById(id);
      if (!item) return failure("NOT_FOUND", `${collection} with id ${id} not found`);
      return success(item as T);
    }
    return success(service.findAll() as T);
  },

  async post<T, B = unknown>(
    path: string,
    body?: B
  ): Promise<ApiResponse<T>> {
    const custom = handleCustomPost<T>(path, body);
    if (custom) return custom;

    const { collection } = parsePath(path);
    if (!collection) {
      return failure("NOT_FOUND", `No collection found for ${path}`);
    }
    const service = dataService(collection);
    if (!body || typeof body !== "object") {
      return failure("INVALID_BODY", "Request body is required");
    }
    const item = service.create(body as Omit<Database[typeof collection][number], "id">);
    return success(item as T);
  },

  async patch<T, B = unknown>(
    path: string,
    body?: B
  ): Promise<ApiResponse<T>> {
    const { collection, id } = parsePath(path);
    if (!collection || !id) {
      return failure("INVALID_PATH", "PATCH requires /:collection/:id");
    }
    const service = dataService(collection);
    if (!body || typeof body !== "object") {
      return failure("INVALID_BODY", "Request body is required");
    }
    const item = service.update(id, body as Partial<Database[typeof collection][number]>);
    if (!item) return failure("NOT_FOUND", `${collection} with id ${id} not found`);
    return success(item as T);
  },

  async remove<T>(path: string): Promise<ApiResponse<T>> {
    const { collection, id } = parsePath(path);
    if (!collection || !id) {
      return failure("INVALID_PATH", "DELETE requires /:collection/:id");
    }
    const service = dataService(collection);
    const removed = service.remove(id);
    if (!removed) return failure("NOT_FOUND", `${collection} with id ${id} not found`);
    return success({} as T);
  },
};
