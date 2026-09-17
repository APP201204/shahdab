import { FastifyInstance } from "fastify";
import { z } from "zod";
import { eq, inArray, asc, and } from "drizzle-orm";
import { db } from "../db/index.ts";
import * as schema from "../db/schema.ts";

export default async function menuRoutes(app: FastifyInstance) {
  const resolveOutletId = async (outlet?: string) => {
    if (!outlet) return null;
    const uuidCheck = z.string().uuid().safeParse(outlet);
    if (uuidCheck.success) return outlet;
    const [row] = await db
      .select()
      .from(schema.outlets)
      .where(eq(schema.outlets.name, outlet))
      .limit(1);
    return row?.id ?? null;
  };

  app.get("/menu", async (request, reply) => {
    const query = request.query as {
      outletId?: string;
      outlet?: string;
      includeOutOfStock?: string;
    };
    const includeOutOfStock = query.includeOutOfStock === "true" || query.includeOutOfStock === "1";
    const resolved = await resolveOutletId(query.outletId ?? query.outlet);
    if (!resolved) {
      return reply.status(400).send({ error: "outlet not found" });
    }
    const outletId = resolved;

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

  const CategoryBody = z.object({
    outletId: z.string().optional(),
    outlet: z.string().optional(),
    name: z.string().min(1),
  });

  app.post("/menu/categories", async (request, reply) => {
    const body = CategoryBody.safeParse(request.body);
    if (!body.success) return reply.status(400).send({ error: "name is required" });
    const outletId = await resolveOutletId(body.data.outletId ?? body.data.outlet);
    if (!outletId) return reply.status(400).send({ error: "outlet not found" });

    const existing = await db
      .select({ sortOrder: schema.menuCategories.sortOrder })
      .from(schema.menuCategories)
      .where(eq(schema.menuCategories.outletId, outletId));
    const sortOrder = existing.reduce((max, c) => Math.max(max, c.sortOrder), -1) + 1;

    const [category] = await db
      .insert(schema.menuCategories)
      .values({ outletId, name: body.data.name.trim(), sortOrder })
      .returning();
    return { category };
  });

  const ReorderBody = z.object({
    outletId: z.string().optional(),
    outlet: z.string().optional(),
    categoryIds: z.array(z.string().uuid()).min(1),
  });

  app.put("/menu/categories/reorder", async (request, reply) => {
    const body = ReorderBody.safeParse(request.body);
    if (!body.success) return reply.status(400).send({ error: "categoryIds are required" });
    const outletId = await resolveOutletId(body.data.outletId ?? body.data.outlet);
    if (!outletId) return reply.status(400).send({ error: "outlet not found" });

    await db.transaction(async (tx) => {
      for (const [index, id] of body.data.categoryIds.entries()) {
        await tx
          .update(schema.menuCategories)
          .set({ sortOrder: index })
          .where(
            and(eq(schema.menuCategories.id, id), eq(schema.menuCategories.outletId, outletId)),
          );
      }
    });
    return { ok: true };
  });

  const RenameBody = z.object({ name: z.string().min(1) });

  app.put("/menu/categories/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = RenameBody.safeParse(request.body);
    if (!body.success) return reply.status(400).send({ error: "name is required" });
    const [category] = await db
      .update(schema.menuCategories)
      .set({ name: body.data.name.trim() })
      .where(eq(schema.menuCategories.id, id))
      .returning();
    if (!category) return reply.status(404).send({ error: "category not found" });
    return { category };
  });

  app.delete("/menu/categories/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const [item] = await db
      .select({ id: schema.menuItems.id })
      .from(schema.menuItems)
      .where(eq(schema.menuItems.categoryId, id))
      .limit(1);
    if (item) {
      return reply.status(400).send({ error: "Category has menu items" });
    }
    const [deleted] = await db
      .delete(schema.menuCategories)
      .where(eq(schema.menuCategories.id, id))
      .returning();
    if (!deleted) return reply.status(404).send({ error: "category not found" });
    return { ok: true };
  });
}
