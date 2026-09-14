import { FastifyInstance } from "fastify";
import { z } from "zod";
import { eq, inArray } from "drizzle-orm";
import { db } from "../db/index.ts";
import * as schema from "../db/schema.ts";
import * as tables from "../services/tables.ts";

export default async function tableRoutes(app: FastifyInstance) {
  app.get("/tables", async (request, reply) => {
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
      .from(schema.tables)
      .where(eq(schema.tables.outletId, outletId));

    const waiterIds = [...new Set(rows.map((r) => r.waiterId).filter(Boolean))] as string[];
    const staff = waiterIds.length
      ? await db.select().from(schema.staff).where(inArray(schema.staff.id, waiterIds))
      : [];
    const staffById = new Map(staff.map((s) => [s.id, s.name]));

    return { tables: rows.map((t) => ({ ...t, waiter: t.waiterId ? staffById.get(t.waiterId) : undefined })) };
  });

  app.get("/tables/groups", async (request, reply) => {
    const query = request.query as { outletId?: string; outlet?: string };
    let outletId = query.outletId ?? query.outlet;
    if (!outletId) {
      return reply.status(400).send({ error: "outletId or outlet query param is required" });
    }
    const uuidCheck = z.string().uuid().safeParse(outletId);
    if (!uuidCheck.success) {
      const [outlet] = await db.select().from(schema.outlets).where(eq(schema.outlets.name, outletId)).limit(1);
      if (!outlet) {
        return reply.status(400).send({ error: "outlet not found" });
      }
      outletId = outlet.id;
    }
    try {
      return await tables.getTableGroups({ outletId });
    } catch (err: any) {
      return reply.status(409).send({ error: err.message });
    }
  });

  const UpdateTableBody = z.object({
    number: z.number().int().min(1).optional(),
    capacity: z.number().int().min(1).optional(),
    name: z.string().optional(),
  });

  app.put<{ Params: { tableId: string }; Body: z.infer<typeof UpdateTableBody> }>(
    "/tables/:tableId",
    async (request, reply) => {
      const body = UpdateTableBody.safeParse(request.body);
      if (!body.success) {
        return reply.status(400).send({ error: body.error.message });
      }
      try {
        return await tables.updateTable({ tableId: request.params.tableId, ...body.data });
      } catch (err: any) {
        return reply.status(409).send({ error: err.message });
      }
    }
  );

  const SeatBody = z.object({
    guests: z.number().int().min(1),
    waiterId: z.string().uuid().optional(),
  });

  app.post<{ Params: { tableId: string }; Body: z.infer<typeof SeatBody> }>(
    "/tables/:tableId/seat",
    async (request, reply) => {
      const { tableId } = request.params;
      const body = SeatBody.safeParse(request.body);
      if (!body.success) {
        return reply.status(400).send({ error: body.error.message });
      }
      try {
        const table = await tables.seatTable({ tableId, ...body.data });
        return table;
      } catch (err: any) {
        return reply.status(409).send({ error: err.message });
      }
    }
  );

  app.post<{ Params: { tableId: string } }>(
    "/tables/:tableId/request-bill",
    async (request, reply) => {
      try {
        return await tables.requestBill({ tableId: request.params.tableId });
      } catch (err: any) {
        return reply.status(409).send({ error: err.message });
      }
    }
  );

  app.post<{ Params: { tableId: string } }>(
    "/tables/:tableId/needs-cleaning",
    async (request, reply) => {
      try {
        return await tables.markNeedsCleaning({ tableId: request.params.tableId });
      } catch (err: any) {
        return reply.status(409).send({ error: err.message });
      }
    }
  );

  app.post<{ Params: { tableId: string } }>(
    "/tables/:tableId/mark-cleaned",
    async (request, reply) => {
      try {
        return await tables.markCleaned({ tableId: request.params.tableId });
      } catch (err: any) {
        return reply.status(409).send({ error: err.message });
      }
    }
  );

  const MoveBody = z.object({
    toTableId: z.string().uuid(),
  });

  app.post<{ Params: { tableId: string }; Body: z.infer<typeof MoveBody> }>(
    "/tables/:tableId/move",
    async (request, reply) => {
      const body = MoveBody.safeParse(request.body);
      if (!body.success) {
        return reply.status(400).send({ error: body.error.message });
      }
      try {
        return await tables.moveTableBooking({
          fromTableId: request.params.tableId,
          toTableId: body.data.toTableId,
        });
      } catch (err: any) {
        return reply.status(409).send({ error: err.message });
      }
    }
  );

  const MergeBody = z.object({
    tableIds: z.array(z.string().uuid()).min(2),
    guests: z.number().int().min(1).optional(),
    waiterId: z.string().uuid().optional(),
    name: z.string().optional(),
  });

  app.post<{ Body: z.infer<typeof MergeBody> }>(
    "/table-merges",
    async (request, reply) => {
      const body = MergeBody.safeParse(request.body);
      if (!body.success) {
        return reply.status(400).send({ error: body.error.message });
      }
      try {
        return await tables.mergeTables(body.data);
      } catch (err: any) {
        return reply.status(409).send({ error: err.message });
      }
    }
  );

  app.post<{ Params: { mergeGroupId: string } }>(
    "/table-merges/:mergeGroupId/release",
    async (request, reply) => {
      try {
        return await tables.releaseMerge({ mergeGroupId: request.params.mergeGroupId });
      } catch (err: any) {
        return reply.status(409).send({ error: err.message });
      }
    }
  );

  const SplitBody = z.object({
    tableId: z.string().uuid(),
    subTables: z
      .array(
        z.object({
          capacity: z.number().int().min(1),
          name: z.string().optional(),
        })
      )
      .min(2),
  });

  app.post<{ Body: z.infer<typeof SplitBody> }>(
    "/table-splits",
    async (request, reply) => {
      const body = SplitBody.safeParse(request.body);
      if (!body.success) {
        return reply.status(400).send({ error: body.error.message });
      }
      try {
        return await tables.splitTable(body.data);
      } catch (err: any) {
        return reply.status(409).send({ error: err.message });
      }
    }
  );

  app.post<{ Params: { splitGroupId: string } }>(
    "/table-splits/:splitGroupId/unsplit",
    async (request, reply) => {
      try {
        return await tables.unsplitTable({ splitGroupId: request.params.splitGroupId });
      } catch (err: any) {
        return reply.status(409).send({ error: err.message });
      }
    }
  );

  const TransferBody = z.object({
    sectionId: z.string().uuid().optional(),
    waiterId: z.string().uuid().optional().or(z.literal("")),
  });

  app.post<{ Params: { tableId: string }; Body: z.infer<typeof TransferBody> }>(
    "/tables/:tableId/transfer",
    async (request, reply) => {
      const body = TransferBody.safeParse(request.body);
      if (!body.success) {
        return reply.status(400).send({ error: body.error.message });
      }
      try {
        return await tables.transferTable({
          tableId: request.params.tableId,
          toSectionId: body.data.sectionId,
          toWaiterId: body.data.waiterId === "" ? null : body.data.waiterId,
        });
      } catch (err: any) {
        return reply.status(409).send({ error: err.message });
      }
    }
  );
}
