import { FastifyInstance } from "fastify";
import { z } from "zod";
import * as notifications from "../services/notifications.ts";

export default async function notificationRoutes(app: FastifyInstance) {
  app.get("/notifications", async (request, reply) => {
    const query = request.query as { userId?: string; outletId?: string };
    if (!query.userId && !query.outletId) {
      return reply.status(400).send({ error: "userId or outletId is required" });
    }
    try {
      return await notifications.listNotifications(query as any);
    } catch (err: any) {
      return reply.status(409).send({ error: err.message });
    }
  });

  const ReadBody = z.object({
    userId: z.string().uuid().optional(),
    outletId: z.string().uuid().optional(),
    ids: z.array(z.string().uuid()).optional(),
  });

  app.post<{ Body: z.infer<typeof ReadBody> }>("/notifications/read", async (request, reply) => {
    const body = ReadBody.safeParse(request.body);
    if (!body.success) {
      return reply.status(400).send({ error: body.error.message });
    }
    if (!body.data.userId && !body.data.outletId) {
      return reply.status(400).send({ error: "userId or outletId is required" });
    }
    try {
      return await notifications.markRead(body.data);
    } catch (err: any) {
      return reply.status(409).send({ error: err.message });
    }
  });
}
