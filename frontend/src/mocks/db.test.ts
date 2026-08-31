import { describe, it, expect } from "vitest";
import { DataService, can } from "@/mocks/db";

interface TestItem {
  id: string;
  name: string;
}

describe("DataService", () => {
  it("creates, finds, updates and removes items", () => {
    const service = new DataService<TestItem>([]);

    const created = service.create({ name: "Paneer Tikka" });
    expect(created.id).toBeDefined();
    expect(created.name).toBe("Paneer Tikka");

    const found = service.findById(created.id);
    expect(found).toEqual(created);

    const all = service.findAll();
    expect(all).toHaveLength(1);

    const updated = service.update(created.id, { name: "Paneer Tikka Full" });
    expect(updated?.name).toBe("Paneer Tikka Full");

    const removed = service.remove(created.id);
    expect(removed).toBe(true);
    expect(service.findById(created.id)).toBeUndefined();
  });

  it("returns undefined for unknown ids", () => {
    const service = new DataService<TestItem>([]);
    expect(service.findById("missing")).toBeUndefined();
    expect(service.update("missing", { name: "x" })).toBeUndefined();
    expect(service.remove("missing")).toBe(false);
  });
});

describe("can", () => {
  it("grants admin every permission", () => {
    expect(can(["admin"], "bill.close")).toBe(true);
    expect(can(["admin"], "audit.read")).toBe(true);
  });

  it("grants role-specific permissions", () => {
    expect(can(["captain"], "order.create")).toBe(true);
    expect(can(["cashier"], "bill.payment.create")).toBe(true);
    expect(can(["kitchen_manager"], "kitchen.tickets.update")).toBe(true);
  });

  it("denies permissions outside a role", () => {
    expect(can(["waiter"], "order.create")).toBe(false);
    expect(can(["captain"], "bill.payment.create")).toBe(false);
    expect(can(["cashier"], "kitchen.tickets.update")).toBe(false);
  });
});
