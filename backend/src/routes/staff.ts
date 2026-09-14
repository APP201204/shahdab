import { FastifyInstance } from "fastify";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "../db/index.ts";
import * as schema from "../db/schema.ts";
import * as staff from "../services/staff.ts";

export default async function staffRoutes(app: FastifyInstance) {
  app.get("/staff", async (request, reply) => {
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

    return await staff.listStaff({ outletId });
  });

  const StaffRole = z.enum([
    "captain",
    "waiter",
    "kitchen-manager",
    "cashier",
    "outlet-manager",
    "admin",
  ]);

  const CreateBody = z.object({
    outletId: z.string().uuid(),
    name: z.string().min(1),
    phone: z.string().min(1),
    roles: z.array(StaffRole).min(1),
    assignment: z.string().optional(),
    active: z.boolean().default(true),
  });

  app.post<{ Body: z.infer<typeof CreateBody> }>("/staff", async (request, reply) => {
    const body = CreateBody.safeParse(request.body);
    if (!body.success) {
      return reply.status(400).send({ error: body.error.message });
    }
    const [outlet] = await db
      .select()
      .from(schema.outlets)
      .where(eq(schema.outlets.id, body.data.outletId))
      .limit(1);
    if (!outlet) {
      return reply.status(400).send({ error: "outlet not found" });
    }
    try {
      return await staff.createStaff({
        orgId: outlet.orgId,
        ...body.data,
      });
    } catch (err: any) {
      return reply.status(409).send({ error: err.message });
    }
  });

  const UpdateBody = z.object({
    name: z.string().min(1).optional(),
    phone: z.string().min(1).optional(),
    roles: z.array(StaffRole).min(1).optional(),
    assignment: z.string().optional(),
    active: z.boolean().optional(),
  });

  app.put<{ Params: { id: string }; Body: z.infer<typeof UpdateBody> }>(
    "/staff/:id",
    async (request, reply) => {
      const body = UpdateBody.safeParse(request.body);
      if (!body.success) {
        return reply.status(400).send({ error: body.error.message });
      }
      try {
        return await staff.updateStaff({ staffId: request.params.id, ...body.data });
      } catch (err: any) {
        return reply.status(409).send({ error: err.message });
      }
    }
  );
}
