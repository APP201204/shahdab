import { FastifyInstance } from "fastify";
import { z } from "zod";
import * as stock from "../services/stock.ts";

export default async function stockRoutes(app: FastifyInstance) {
  const ToggleBody = z.object({
    staffId: z.string().uuid(),
    variantId: z.string().uuid().optional(),
  });

  app.post<{ Params: { id: string }; Body: z.infer<typeof ToggleBody> }>(
    "/menu-items/:id/stock-out",
    async (request, reply) => {
      const body = ToggleBody.safeParse(request.body);
      if (!body.success) {
        return reply.status(400).send({ error: body.error.message });
      }
      try {
        return await stock.toggleStockOut({
          menuItemId: request.params.id,
          ...body.data,
        });
      } catch (err: any) {
        return reply.status(403).send({ error: err.message });
      }
    }
  );
}
