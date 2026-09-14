import { FastifyInstance } from "fastify";
import { z } from "zod";
import { eq, inArray, asc, and } from "drizzle-orm";
import { db } from "../db/index.ts";
import * as schema from "../db/schema.ts";

export default async function menuRoutes(app: FastifyInstance) {
  app.get("/menu", async (request, reply) => {
    const query = request.query as {
      outletId?: string;
      outlet?: string;
      includeOutOfStock?: string;
    };
    let outletId = query.outletId ?? query.outlet;
    const includeOutOfStock = query.includeOutOfStock === "true" || query.includeOutOfStock === "1";

    if (!outletId) {
      return reply.status(400).send({ error: "outletId or outlet query param is required" });
    }

    const uuidCheck = z.string().uuid().safeParse(outletId);
    if (!uuidCheck.success) {
      const [outlet] = await db
        .select()
        .from(schema.outlets)
        .where(eq(schema.outlets.name, outletId))
        .limit(1);
      if (!outlet) {
        return reply.status(400).send({ error: "outlet not found" });
      }
      outletId = outlet.id;
    }

    const categories = await db
      .select()
      .from(schema.menuCategories)
      .where(eq(schema.menuCategories.outletId, outletId))
      .orderBy(asc(schema.menuCategories.sortOrder));

    const items = await db
      .select()
      .from(schema.menuItems)
      .where(eq(schema.menuItems.outletId, outletId));

    const stockOuts = await db
      .select({ menuItemId: schema.stockOuts.menuItemId })
      .from(schema.stockOuts)
      .where(and(eq(schema.stockOuts.outletId, outletId), eq(schema.stockOuts.active, true)));
    const outOfStock = new Set(stockOuts.map((s) => s.menuItemId));

    const visibleItems = includeOutOfStock ? items : items.filter((i) => !outOfStock.has(i.id));

    const variants = visibleItems.length
      ? await db
          .select()
          .from(schema.menuItemVariants)
          .where(inArray(schema.menuItemVariants.itemId, visibleItems.map((i) => i.id)))
      : [];

    const variantsByItem = new Map<string, typeof variants>();
    for (const v of variants) {
      const list = variantsByItem.get(v.itemId) ?? [];
      list.push(v);
      variantsByItem.set(v.itemId, list);
    }

    const itemsByCategory = new Map<string, any[]>();
    for (const item of visibleItems) {
      const list = itemsByCategory.get(item.categoryId) ?? [];
      const enriched = { ...item, variants: variantsByItem.get(item.id) ?? [], outOfStock: outOfStock.has(item.id) };
      if (!includeOutOfStock) {
        delete (enriched as any).outOfStock;
      }
      list.push(enriched);
      itemsByCategory.set(item.categoryId, list);
    }

    return {
      categories: categories.map((c) => ({
        ...c,
        items: itemsByCategory.get(c.id) ?? [],
      })),
    };
  });
}
