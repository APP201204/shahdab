import { FastifyInstance } from "fastify";
import * as kitchen from "../services/kitchen.ts";

export default async function kitchenRoutes(app: FastifyInstance) {
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
