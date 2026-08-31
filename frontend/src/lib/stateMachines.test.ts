import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { deriveOrderStatus } from "@/pages/TablesPage";
import { dataService } from "@/mocks/db";
import type { OrderItem } from "@/types";

const orderId = "order-state-test";
const createdIds: string[] = [];

function seedItem(status: OrderItem["status"]) {
  const item = dataService("orderItems").create({
    organization_id: "org-001",
    order_id: orderId,
    kot_batch_id: "batch-001",
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

function cleanup() {
  for (const id of createdIds) dataService("orderItems").remove(id);
  createdIds.length = 0;
}

describe("order status derivation", () => {
  beforeEach(cleanup);
  afterAll(cleanup);

  it("returns open when there are no non-cancelled items", () => {
    expect(deriveOrderStatus(orderId)).toBe("open");
  });

  it("returns open when all items are placed or accepted", () => {
    seedItem("placed");
    seedItem("accepted");
    expect(deriveOrderStatus(orderId)).toBe("open");
  });

  it("returns partially_served when some items are served and others are not", () => {
    seedItem("served");
    seedItem("placed");
    expect(deriveOrderStatus(orderId)).toBe("partially_served");
  });

  it("returns fully_served when every non-cancelled item is served", () => {
    seedItem("served");
    expect(deriveOrderStatus(orderId)).toBe("fully_served");
  });

  it("ignores cancelled items when deriving the status", () => {
    seedItem("served");
    seedItem("cancelled");
    expect(deriveOrderStatus(orderId)).toBe("fully_served");
  });
});
