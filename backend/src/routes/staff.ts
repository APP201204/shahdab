import { FastifyInstance } from "fastify";
import { z } from "zod";
import { eq, inArray } from "drizzle-orm";
import { db } from "../db/index.ts";
import * as schema from "../db/schema.ts";

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

    const rows = await db
      .select()
      .from(schema.staff)
      .where(eq(schema.staff.outletId, outletId));

    const roles = rows.length
      ? await db
          .select()
          .from(schema.staffRoles)
          .where(inArray(schema.staffRoles.staffId, rows.map((s) => s.id)))
      : [];

    const rolesByStaff = new Map<string, typeof roles>();
    for (const r of roles) {
      const list = rolesByStaff.get(r.staffId) ?? [];
      list.push(r);
      rolesByStaff.set(r.staffId, list);
    }

    return {
      staff: rows.map((s) => ({
        ...s,
        roles: rolesByStaff.get(s.id) ?? [],
      })),
    };
  });
}
