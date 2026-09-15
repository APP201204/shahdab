import { FastifyInstance } from "fastify";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "../db/index.ts";
import * as schema from "../db/schema.ts";
import * as kitchen from "../services/kitchen.ts";

export default async function kitchenRoutes(app: FastifyInstance) {
  app.get("/kitchen/tickets", async (request, reply) => {
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
      return await kitchen.getAllTickets({ outletId });
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  });

  app.get("/kitchens/:kitchenId/tickets", async (request, reply) => {
    const { kitchenId } = request.params as { kitchenId: string };
    try {
      return await kitchen.getTickets(kitchenId);
    } catch (err: any) {
      return reply.status(409).send({ error: err.message });
    }
  });

  app.post<{ Params: { orderItemId: string } }>(
    "/order-items/:orderItemId/accept",
    async (request, reply) => {
      try {
        return await kitchen.acceptItem({ orderItemId: request.params.orderItemId });
      } catch (err: any) {
        return reply.status(409).send({ error: err.message });
      }
    }
  );

  app.post<{ Params: { orderItemId: string } }>(
    "/order-items/:orderItemId/start-cooking",
    async (request, reply) => {
      try {
        return await kitchen.startCookingItem({ orderItemId: request.params.orderItemId });
      } catch (err: any) {
        return reply.status(409).send({ error: err.message });
      }
    }
  );

  app.post<{ Params: { orderItemId: string } }>(
    "/order-items/:orderItemId/ready",
    async (request, reply) => {
      try {
        return await kitchen.markItemReady({ orderItemId: request.params.orderItemId });
      } catch (err: any) {
        return reply.status(409).send({ error: err.message });
      }
    }
  );

  app.post<{ Params: { orderId: string } }>(
    "/orders/:orderId/takeaway-all-ready",
    async (request, reply) => {
      try {
        return await kitchen.markTakeawayAllReady({ orderId: request.params.orderId });
      } catch (err: any) {
        return reply.status(409).send({ error: err.message });
      }
    }
  );

  app.post<{ Params: { orderId: string } }>(
    "/orders/:orderId/pickup",
    async (request, reply) => {
      try {
        return await kitchen.markTakeawayPickedUp({ orderId: request.params.orderId });
      } catch (err: any) {
        return reply.status(409).send({ error: err.message });
      }
    }
  );
}
