import { FastifyInstance } from "fastify";
import { z } from "zod";
import * as reports from "../services/reports.ts";

export default async function reportRoutes(app: FastifyInstance) {
  app.get("/reports/dashboard", async (_request, reply) => {
    try {
      return await reports.dashboard();
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  });

  const DateQuery = z.object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  });

  app.get("/reports/hourly-revenue", async (request, reply) => {
    const query = request.query as { date?: string };
    const parsed = DateQuery.safeParse(query);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.message });
    }
    try {
      return await reports.hourlyRevenue(parsed.data.date);
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  });

  app.get("/reports/section-revenue", async (request, reply) => {
    const query = request.query as { date?: string };
    const parsed = DateQuery.safeParse(query);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.message });
    }
    try {
      return await reports.sectionRevenue(parsed.data.date);
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  });
}
