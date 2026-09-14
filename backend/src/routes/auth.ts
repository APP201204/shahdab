import { FastifyInstance } from "fastify";
import { z } from "zod";
import { createSession, destroySession } from "../middleware/auth.ts";

const LoginBody = z.object({
  phone: z.string().min(1),
  password: z.string().min(1),
});

export default async function authRoutes(app: FastifyInstance) {
  app.post("/auth/login", async (request, reply) => {
    const parsed = LoginBody.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.message });
    }
    try {
      const { sessionId, staff } = await createSession(parsed.data);
      return reply
        .setCookie("sessionId", sessionId, {
          httpOnly: true,
          secure: false,
          sameSite: "lax",
          path: "/",
        })
        .send({ staff });
    } catch (err: any) {
      return reply.status(401).send({ error: err.message });
    }
  });

  app.get("/auth/me", async (request, reply) => {
    if (!request.user) {
      return reply.status(401).send({ error: "unauthorized" });
    }
    return { staff: request.user };
  });

  app.post("/auth/logout", async (request, reply) => {
    const sessionId = request.cookies.sessionId;
    if (sessionId) destroySession(sessionId);
    return reply.clearCookie("sessionId", { path: "/" }).send({ ok: true });
  });
}
