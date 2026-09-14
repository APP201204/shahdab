import { FastifyInstance } from "fastify";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "../db/index.ts";
import * as schema from "../db/schema.ts";
import * as billing from "../services/billing.ts";

export default async function billingRoutes(app: FastifyInstance) {
  app.get("/billing/queue", async (request, reply) => {
    const query = request.query as { outletId?: string; outlet?: string; sectionId?: string };
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

    return await billing.getBillQueue({ outletId, sectionId: query.sectionId });
  });

  const Discount = z.object({
    kind: z.enum(["flat", "percent"]),
    value: z.number().min(0),
  });

  const PreviewBody = z.object({
    orderId: z.string().uuid(),
    discount: Discount.default({ kind: "flat", value: 0 }),
  });

  app.post<{ Body: z.infer<typeof PreviewBody> }>(
    "/billing/preview",
    async (request, reply) => {
      const body = PreviewBody.safeParse(request.body);
      if (!body.success) {
        return reply.status(400).send({ error: body.error.message });
      }
      try {
        return await billing.previewBill(body.data);
      } catch (err: any) {
        return reply.status(409).send({ error: err.message });
      }
    }
  );

  const Payment = z.object({
    method: z.enum(["cash", "card", "upi", "wallet"]),
    amount: z.number().int().min(1),
  });

  const CloseBody = z.object({
    orderId: z.string().uuid(),
    payments: z.array(Payment).min(1),
    cashierId: z.string().uuid(),
    customer: z.string().optional(),
    discount: Discount.default({ kind: "flat", value: 0 }),
  });

  app.post<{ Body: z.infer<typeof CloseBody> }>("/bills", async (request, reply) => {
    const body = CloseBody.safeParse(request.body);
    if (!body.success) {
      return reply.status(400).send({ error: body.error.message });
    }
    try {
      return await billing.closeBill(body.data);
    } catch (err: any) {
      return reply.status(409).send({ error: err.message });
    }
  });

  app.get("/bills", async (request, reply) => {
    const query = request.query as { outletId?: string; outlet?: string; sectionId?: string };
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

    return await billing.listBills({ outletId, sectionId: query.sectionId });
  });

  app.get<{ Params: { id: string } }>("/bills/:id", async (request, reply) => {
    try {
      return await billing.getBill(request.params.id);
    } catch (err: any) {
      return reply.status(404).send({ error: err.message });
    }
  });
}
