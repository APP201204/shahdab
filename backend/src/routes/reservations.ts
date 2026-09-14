import { FastifyInstance } from "fastify";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "../db/index.ts";
import * as schema from "../db/schema.ts";
import * as reservations from "../services/reservations.ts";

export default async function reservationRoutes(app: FastifyInstance) {
  app.get("/reservations", async (request, reply) => {
    const query = request.query as { outletId?: string; outlet?: string; sectionId?: string; status?: string };
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

    const rows = await reservations.listReservations({
      outletId,
      sectionId: query.sectionId,
      status: query.status,
    });
    return { reservations: rows };
  });

  const CreateBody = z.object({
    outletId: z.string().uuid(),
    guestName: z.string().min(1),
    phone: z.string().min(1),
    partySize: z.number().int().min(1),
    time: z.string().datetime(),
    sectionId: z.string().uuid(),
    tableId: z.string().uuid().optional(),
  });

  app.post<{ Body: z.infer<typeof CreateBody> }>("/reservations", async (request, reply) => {
    const body = CreateBody.safeParse(request.body);
    if (!body.success) {
      return reply.status(400).send({ error: body.error.message });
    }
    try {
      const reservation = await reservations.createReservation({
        ...body.data,
        time: new Date(body.data.time),
      });
      return reservation;
    } catch (err: any) {
      return reply.status(409).send({ error: err.message });
    }
  });

  const SeatBody = z.object({
    waiterId: z.string().uuid().optional(),
  });

  app.post<{ Params: { id: string }; Body: z.infer<typeof SeatBody> }>(
    "/reservations/:id/seat",
    async (request, reply) => {
      const body = SeatBody.safeParse(request.body);
      if (!body.success) {
        return reply.status(400).send({ error: body.error.message });
      }
      try {
        return await reservations.seatReservation({
          reservationId: request.params.id,
          waiterId: body.data.waiterId,
        });
      } catch (err: any) {
        return reply.status(409).send({ error: err.message });
      }
    }
  );

  app.post<{ Params: { id: string } }>("/reservations/:id/cancel", async (request, reply) => {
    try {
      return await reservations.cancelReservation({ reservationId: request.params.id });
    } catch (err: any) {
      return reply.status(409).send({ error: err.message });
    }
  });

  app.post<{ Params: { id: string } }>("/reservations/:id/no-show", async (request, reply) => {
    try {
      return await reservations.noShowReservation({ reservationId: request.params.id });
    } catch (err: any) {
      return reply.status(409).send({ error: err.message });
    }
  });
}
