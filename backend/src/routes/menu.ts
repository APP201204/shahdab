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
      .where(eq(schema.menuItems.outletId, outletId))
      .orderBy(asc(schema.menuItems.name));

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

    const itemSections = visibleItems.length
      ? await db
          .select()
          .from(schema.menuItemSections)
          .where(inArray(schema.menuItemSections.itemId, visibleItems.map((i) => i.id)))
      : [];

    const sectionsByItem = new Map<string, string[]>();
    for (const s of itemSections) {
      const list = sectionsByItem.get(s.itemId) ?? [];
      list.push(s.sectionId);
      sectionsByItem.set(s.itemId, list);
    }

    const itemsByCategory = new Map<string, any[]>();
    for (const item of visibleItems) {
      const list = itemsByCategory.get(item.categoryId) ?? [];
      const enriched = {
        ...item,
        variants: variantsByItem.get(item.id) ?? [],
        sectionIds: sectionsByItem.get(item.id) ?? [],
        outOfStock: outOfStock.has(item.id),
      };
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

  const VariantBody = z.object({
    name: z.string().min(1),
    price: z.number().int().min(0),
    available: z.boolean().default(true),
  });

  const ItemStatus = z.enum(["available", "unavailable", "not-offered", "disabled"]);

  const CreateItemBody = z.object({
    outletId: z.string().optional(),
    outlet: z.string().optional(),
    categoryId: z.string().uuid(),
    name: z.string().min(1),
    foodType: z.enum(["veg", "non-veg", "egg"]),
    price: z.number().int().min(0),
    favorite: z.boolean().default(false),
    spicy: z.boolean().default(false),
    mrp: z.boolean().default(false),
    status: ItemStatus.default("available"),
    variants: z.array(VariantBody).default([]),
    sectionIds: z.array(z.string().uuid()).default([]),
  });

  app.post("/menu/items", async (request, reply) => {
    const body = CreateItemBody.safeParse(request.body);
    if (!body.success) return reply.status(400).send({ error: body.error.message });
    const outletId = await resolveOutletId(body.data.outletId ?? body.data.outlet);
    if (!outletId) return reply.status(400).send({ error: "outlet not found" });
    const { variants, sectionIds, outlet: _o, outletId: _oid, price, ...fields } = body.data;

    const item = await db.transaction(async (tx) => {
      const [created] = await tx
        .insert(schema.menuItems)
        .values({ ...fields, outletId, basePrice: price })
        .returning();
      for (const v of variants) {
        await tx.insert(schema.menuItemVariants).values({ ...v, itemId: created.id });
      }
      if (sectionIds.length) {
        await tx.insert(schema.menuItemSections).values(
          sectionIds.map((sectionId) => ({ itemId: created.id, sectionId })),
        );
      }
      return created;
    });
    return { item };
  });

  const UpdateItemBody = z.object({
    categoryId: z.string().uuid().optional(),
    name: z.string().min(1).optional(),
    foodType: z.enum(["veg", "non-veg", "egg"]).optional(),
    price: z.number().int().min(0).optional(),
    favorite: z.boolean().optional(),
    spicy: z.boolean().optional(),
    mrp: z.boolean().optional(),
    status: ItemStatus.optional(),
    variants: z.array(VariantBody).optional(),
    sectionIds: z.array(z.string().uuid()).optional(),
  });

  app.put("/menu/items/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = UpdateItemBody.safeParse(request.body);
    if (!body.success) return reply.status(400).send({ error: body.error.message });
    const { variants, sectionIds, price, ...fields } = body.data;

    const item = await db.transaction(async (tx) => {
      const update: Record<string, unknown> = { ...fields };
      if (price !== undefined) update.basePrice = price;
      const [updated] = await tx
        .update(schema.menuItems)
        .set(update)
        .where(eq(schema.menuItems.id, id))
        .returning();
      if (!updated) return null;
      if (variants) {
        await tx.delete(schema.menuItemVariants).where(eq(schema.menuItemVariants.itemId, id));
        for (const v of variants) {
          await tx.insert(schema.menuItemVariants).values({ ...v, itemId: id });
        }
      }
      if (sectionIds) {
        await tx.delete(schema.menuItemSections).where(eq(schema.menuItemSections.itemId, id));
        if (sectionIds.length) {
          await tx.insert(schema.menuItemSections).values(
            sectionIds.map((sectionId) => ({ itemId: id, sectionId })),
          );
        }
      }
      return updated;
    });
    if (!item) return reply.status(404).send({ error: "item not found" });
    return { item };
  });

  app.delete("/menu/items/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const [used] = await db
      .select({ id: schema.orderItems.id })
      .from(schema.orderItems)
      .where(eq(schema.orderItems.menuItemId, id))
      .limit(1);
    if (used) {
      return reply.status(400).send({ error: "Item is used in orders" });
    }
    const [deleted] = await db
      .delete(schema.menuItems)
      .where(eq(schema.menuItems.id, id))
      .returning();
    if (!deleted) return reply.status(404).send({ error: "item not found" });
    return { ok: true };
  });
}
