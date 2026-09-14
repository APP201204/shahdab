import { FastifyInstance } from "fastify";
import { z } from "zod";
import { eq, inArray, asc } from "drizzle-orm";
import { db } from "../db/index.ts";
import * as schema from "../db/schema.ts";

export default async function menuRoutes(app: FastifyInstance) {
  app.get("/menu", async (request, reply) => {
    const query = request.query as { outletId?: string; outlet?: string };
    let outletId = query.outletId ?? query.outlet;

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

    const variants = items.length
      ? await db
          .select()
          .from(schema.menuItemVariants)
          .where(inArray(schema.menuItemVariants.itemId, items.map((i) => i.id)))
      : [];

    const variantsByItem = new Map<string, typeof variants>();
    for (const v of variants) {
      const list = variantsByItem.get(v.itemId) ?? [];
      list.push(v);
      variantsByItem.set(v.itemId, list);
    }

    const itemsByCategory = new Map<string, any[]>();
    for (const item of items) {
      const list = itemsByCategory.get(item.categoryId) ?? [];
      list.push({ ...item, variants: variantsByItem.get(item.id) ?? [] });
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
