import { describe, it, expect, afterAll } from "vitest";
import { dataService, db } from "@/mocks/db";
import { mockApi } from "@/services/mockApi";
import type { OrderItem, Table } from "@/types";

const org = db.organizations[0];
const outlet = db.outlets[0];
const floor = db.floors[0];
const staff = db.staff[0];

describe("mockApi table operations", () => {
  const created: { tables: string[]; group: string | null; reservation: string | null } = {
    tables: [],
    group: null,
    reservation: null,
  };

  afterAll(() => {
    if (created.reservation) dataService("reservations").remove(created.reservation);
    if (created.group) dataService("tableMergeGroups").remove(created.group);
    db.tableMergeGroupMembers = db.tableMergeGroupMembers.filter(
      (m) => !created.tables.includes(m.table_id) && !(created.group && m.merge_group_id === created.group)
    );
    for (const id of created.tables) dataService("tables").remove(id);
  });

  function makeTable(status: Table["status"]) {
    const table = dataService("tables").create({
      organization_id: org.id,
      outlet_id: outlet.id,
      floor_id: floor.id,
      table_number: `T-${Date.now()}-${created.tables.length}`,
      capacity: 4,
      status,
      merge_group_id: null,
      is_active: true,
    } as Omit<Table, "id">);
    created.tables.push(table.id);
    return table;
  }

  it("merges vacant tables and splits them back", async () => {
    const t1 = makeTable("vacant");
    const t2 = makeTable("vacant");

    const res = await mockApi.post("/tables/merge", {
      table_ids: [t1.id, t2.id],
      organization_id: org.id,
      outlet_id: outlet.id,
      floor_id: floor.id,
      staff_id: staff.id,
    });

    expect(res.error).toBeNull();
    const group = res.data as { id: string };
    created.group = group.id;

    const members = db.tableMergeGroupMembers.filter((m) => m.merge_group_id === group.id);
    expect(members).toHaveLength(2);
    expect(dataService("tables").findById(t1.id)?.merge_group_id).toBe(group.id);

    const split = await mockApi.post(`/table-merge-groups/${group.id}/split`, {});
    expect(split.error).toBeNull();
    expect(dataService("tableMergeGroups").findById(group.id)?.status).toBe("released");
    expect(dataService("tables").findById(t1.id)?.status).toBe("vacant");
    expect(dataService("tables").findById(t1.id)?.merge_group_id).toBeNull();
  });

  it("rejects merge when a table has an active order", async () => {
    const occupied = db.tables.find((t) => t.status === "occupied");
    expect(occupied).toBeDefined();
    const other = makeTable("vacant");

    const res = await mockApi.post("/tables/merge", {
      table_ids: [occupied!.id, other.id],
      organization_id: org.id,
      outlet_id: outlet.id,
      floor_id: floor.id,
      staff_id: staff.id,
    });

    expect(res.error?.code).toBe("TABLE_HAS_ACTIVE_ORDER");
  });

  it("transfers a reservation and assignments to another table", async () => {
    const source = makeTable("reserved");
    const dest = makeTable("vacant");

    const reservation = dataService("reservations").create({
      organization_id: org.id,
      outlet_id: outlet.id,
      floor_id: floor.id,
      table_id: source.id,
      guest_name: "Guest",
      guest_phone: "+91-99999-99999",
      party_size: 2,
      reservation_time: new Date().toISOString(),
      status: "booked",
      created_by: staff.id,
      created_at: new Date().toISOString(),
    });
    created.reservation = reservation.id;

    const res = await mockApi.post(`/tables/${source.id}/transfer`, {
      to_table_id: dest.id,
    });

    expect(res.error).toBeNull();
    expect(dataService("tables").findById(source.id)?.status).toBe("vacant");
    expect(dataService("tables").findById(dest.id)?.status).toBe("reserved");
    expect(dataService("reservations").findById(reservation.id)?.table_id).toBe(dest.id);
  });
});

describe("mockApi order item cancellation", () => {
  const createdIds: string[] = [];

  afterAll(() => {
    for (const id of createdIds) dataService("orderItems").remove(id);
  });

  function makeItem(status: OrderItem["status"]) {
    const item = dataService("orderItems").create({
      organization_id: org.id,
      order_id: "order-002",
      kot_batch_id: "batch-002",
      menu_item_id: "item-001",
      menu_item_variant_id: "var-001",
      kitchen_id: "kit-001",
      quantity: 1,
      unit_price: 100,
      status,
      accepted_at: null,
      cooking_at: null,
      ready_at: null,
      served_at: null,
      served_by: null,
      created_at: new Date().toISOString(),
    } as Omit<OrderItem, "id">);
    createdIds.push(item.id);
    return item;
  }

  it("cancels a placed order item", async () => {
    const item = makeItem("placed");
    const res = await mockApi.post(`/order-items/${item.id}/cancel`, {});
    expect(res.error).toBeNull();
    expect(dataService("orderItems").findById(item.id)?.status).toBe("cancelled");
  });

  it("rejects cancellation once cooking has started", async () => {
    const item = makeItem("cooking");
    const res = await mockApi.post(`/order-items/${item.id}/cancel`, {});
    expect(res.error?.code).toBe("ITEM_ALREADY_COOKING");
  });
});
