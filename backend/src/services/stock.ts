import { eq, and, isNull } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { db } from "../db/index.ts";
import * as schema from "../db/schema.ts";
import { emitStockUpdate } from "./events.ts";

export async function toggleStockOut({
  menuItemId,
  variantId,
  staffId,
  outletId,
}: {
  menuItemId: string;
  variantId?: string;
  staffId: string;
  outletId?: string;
}) {
  const [menuItem] = await db
    .select()
    .from(schema.menuItems)
    .where(eq(schema.menuItems.id, menuItemId));
  if (!menuItem) throw new Error("menu item not found");

  const targetOutletId = outletId ?? menuItem.outletId;

  const staffWithRoles = await db
    .select()
    .from(schema.staff)
    .where(eq(schema.staff.id, staffId));
  if (staffWithRoles.length === 0) throw new Error("staff not found");
  const staff = staffWithRoles[0];

  const roles = await db
    .select()
    .from(schema.staffRoles)
    .where(eq(schema.staffRoles.staffId, staffId));
  const allowed = ["kitchen-manager", "admin", "outlet-manager"];
  if (!roles.some((r) => allowed.includes(r.role))) {
    throw new Error("only kitchen-manager, outlet-manager or admin can toggle stock");
  }

  const existing = await db
    .select()
    .from(schema.stockOuts)
    .where(
      and(
        eq(schema.stockOuts.menuItemId, menuItemId),
        eq(schema.stockOuts.active, true),
        variantId ? eq(schema.stockOuts.variantId, variantId) : isNull(schema.stockOuts.variantId)
      )
    );

  if (existing.length > 0) {
    const [released] = await db
      .update(schema.stockOuts)
      .set({ active: false })
      .where(eq(schema.stockOuts.id, existing[0].id))
      .returning();
    emitStockUpdate(targetOutletId, { menuItemId, variantId, outOfStock: false });
    return { ...released, outOfStock: false };
  }

  const [row] = await db
    .insert(schema.stockOuts)
    .values({
      id: randomUUID(),
      outletId: targetOutletId,
      kitchenId: menuItem.kitchenId,
      menuItemId,
      variantId,
      toggledBy: staff.userId,
      active: true,
    })
    .returning();

  emitStockUpdate(targetOutletId, { menuItemId, variantId, outOfStock: true });
  return { ...row, outOfStock: true };
}

export async function activeStockOuts(outletId: string) {
  return db
    .select({ menuItemId: schema.stockOuts.menuItemId, variantId: schema.stockOuts.variantId })
    .from(schema.stockOuts)
    .where(and(eq(schema.stockOuts.outletId, outletId), eq(schema.stockOuts.active, true)));
}
