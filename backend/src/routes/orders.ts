import { FastifyInstance } from "fastify";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "../db/index.ts";
import * as schema from "../db/schema.ts";
import * as orders from "../services/orders.ts";

export default async function orderRoutes(app: FastifyInstance) {
  app.get("/orders", async (request, reply) => {
    const query = request.query as { tableId?: string; mergeGroupId?: string };
    if (!query.tableId && !query.mergeGroupId) {
      return reply.status(400).send({ error: "tableId or mergeGroupId is required" });
    }
    const order = await orders.getOrderByUnit(query);
    if (!order) {
      return reply.status(404).send({ error: "order not found" });
    }
    return order;
  });

  app.get("/orders/active", async (request, reply) => {
    const query = request.query as { outlet?: string };
    if (!query.outlet) {
      return reply.status(400).send({ error: "outlet is required" });
    }

    let outletId = query.outlet;
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

    try {
      return await orders.getActiveOrderUnits({ outletId });
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  });

  const AddItemsBody = z.object({
    items: z
      .array(
        z.object({
          menuItemId: z.string().uuid(),
          variantId: z.string().uuid().optional(),
          qty: z.number().int().min(1),
          note: z.string().optional(),
        })
      )
      .min(1),
  });

  app.post<{ Params: { orderId: string }; Body: z.infer<typeof AddItemsBody> }>(
    "/orders/:orderId/items",
    async (request, reply) => {
      const body = AddItemsBody.safeParse(request.body);
      if (!body.success) {
        return reply.status(400).send({ error: body.error.message });
      }
      try {
        return await orders.addOrderItems({
          orderId: request.params.orderId,
          items: body.data.items,
        });
      } catch (err: any) {
        return reply.status(409).send({ error: err.message });
      }
    }
  );

  const SendToKitchenBody = z.object({
    createdBy: z.string().uuid(),
  });

  app.post<{ Params: { orderId: string }; Body: z.infer<typeof SendToKitchenBody> }>(
    "/orders/:orderId/send-to-kitchen",
    async (request, reply) => {
      const body = SendToKitchenBody.safeParse(request.body);
      if (!body.success) {
        return reply.status(400).send({ error: body.error.message });
      }
      try {
        return await orders.sendToKitchen({
          orderId: request.params.orderId,
          createdBy: body.data.createdBy,
        });
      } catch (err: any) {
        return reply.status(409).send({ error: err.message });
      }
    }
  );

  const NoteBody = z.object({
    note: z.string(),
  });

  app.put<{ Params: { orderItemId: string }; Body: z.infer<typeof NoteBody> }>(
    "/order-items/:orderItemId/note",
    async (request, reply) => {
      const body = NoteBody.safeParse(request.body);
      if (!body.success) {
        return reply.status(400).send({ error: body.error.message });
      }
      try {
        return await orders.updateItemNote({
          orderItemId: request.params.orderItemId,
          note: body.data.note,
        });
      } catch (err: any) {
        return reply.status(409).send({ error: err.message });
      }
    }
  );

  app.post<{ Params: { orderItemId: string } }>(
    "/order-items/:orderItemId/cancel",
    async (request, reply) => {
      try {
        return await orders.cancelItem({ orderItemId: request.params.orderItemId });
      } catch (err: any) {
        return reply.status(409).send({ error: err.message });
      }
    }
  );

  app.post<{ Params: { orderItemId: string } }>(
    "/order-items/:orderItemId/served",
    async (request, reply) => {
      try {
        return await orders.serveItem({ orderItemId: request.params.orderItemId });
      } catch (err: any) {
        return reply.status(409).send({ error: err.message });
      }
    }
  );
}
