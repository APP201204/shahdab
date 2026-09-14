import Fastify from "fastify";
import cors from "@fastify/cors";
import cookie from "@fastify/cookie";
import { Server } from "socket.io";
import { config } from "./config.ts";
import { db } from "./db/index.ts";
import menuRoutes from "./routes/menu.ts";
import tableRoutes from "./routes/tables.ts";
import staffRoutes from "./routes/staff.ts";

const app = Fastify({ logger: true });

await app.register(cors, { origin: config.frontendUrl, credentials: true });
await app.register(cookie);

app.get("/health", async (_request, reply) => {
  return reply.send({ status: "ok", db: Boolean(db) });
});

await app.register(menuRoutes, { prefix: "/api/v1" });
await app.register(tableRoutes, { prefix: "/api/v1" });
await app.register(staffRoutes, { prefix: "/api/v1" });

await app.ready();

const io = new Server(app.server, {
  cors: { origin: config.frontendUrl, credentials: true },
});

io.on("connection", (socket) => {
  app.log.info(`socket connected: ${socket.id}`);
  socket.on("disconnect", () => {
    app.log.info(`socket disconnected: ${socket.id}`);
  });
});

try {
  await app.listen({ port: config.port, host: "0.0.0.0" });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
