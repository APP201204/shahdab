import { FastifyInstance } from "fastify";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "../db/index.ts";
import * as schema from "../db/schema.ts";

export default async function sectionRoutes(app: FastifyInstance) {
  app.get("/sections", async (request, reply) => {
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

    const sections = await db
      .select()
      .from(schema.sections)
      .where(eq(schema.sections.outletId, outletId))
      .orderBy(schema.sections.name);

    return { sections };
  });
}
