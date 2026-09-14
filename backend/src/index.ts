import Fastify from "fastify";
import cors from "@fastify/cors";
import cookie from "@fastify/cookie";
import { Server } from "socket.io";
import { config } from "./config.ts";
import { db } from "./db/index.ts";
import { setSocketServer } from "./socket/index.ts";
import menuRoutes from "./routes/menu.ts";
import tableRoutes from "./routes/tables.ts";
import staffRoutes from "./routes/staff.ts";
import reservationRoutes from "./routes/reservations.ts";
import orderRoutes from "./routes/orders.ts";
import kitchenRoutes from "./routes/kitchen.ts";
import billingRoutes from "./routes/billing.ts";
import notificationRoutes from "./routes/notifications.ts";
import reportRoutes from "./routes/reports.ts";
import stockRoutes from "./routes/stock.ts";
import sectionRoutes from "./routes/sections.ts";
import authRoutes from "./routes/auth.ts";
import { setAuthHook } from "./middleware/auth.ts";

const app = Fastify({ logger: true });

await app.register(cors, { origin: config.frontendUrl, credentials: true });
await app.register(cookie);

app.get("/health", async (_request, reply) => {
  return reply.send({ status: "ok", db: Boolean(db) });
});

await app.register(authRoutes, { prefix: "/api/v1" });
await app.register(menuRoutes, { prefix: "/api/v1" });
await app.register(tableRoutes, { prefix: "/api/v1" });
await app.register(staffRoutes, { prefix: "/api/v1" });
await app.register(reservationRoutes, { prefix: "/api/v1" });
await app.register(orderRoutes, { prefix: "/api/v1" });
await app.register(kitchenRoutes, { prefix: "/api/v1" });
await app.register(billingRoutes, { prefix: "/api/v1" });
await app.register(notificationRoutes, { prefix: "/api/v1" });
await app.register(reportRoutes, { prefix: "/api/v1" });
await app.register(stockRoutes, { prefix: "/api/v1" });
await app.register(sectionRoutes, { prefix: "/api/v1" });

setAuthHook(app);

await app.ready();

const io = new Server(app.server, {
  cors: { origin: config.frontendUrl, credentials: true },
});

setSocketServer(io);

io.on("connection", (socket) => {
  app.log.info(`socket connected: ${socket.id}`);

  const outletId = socket.handshake.query.outletId as string | undefined;
  const role = socket.handshake.query.role as string | undefined;
  const staffId = socket.handshake.query.staffId as string | undefined;
  const kitchenId = socket.handshake.query.kitchenId as string | undefined;

  if (outletId) {
    socket.join(`outlet:${outletId}`);
    socket.join(`outlet:${outletId}:tables`);
    socket.join(`outlet:${outletId}:reservations`);
    socket.join(`outlet:${outletId}:menu`);
    if (kitchenId) socket.join(`outlet:${outletId}:kitchen:${kitchenId}`);
    if (role === "cashier") socket.join(`outlet:${outletId}:billing`);
    if (staffId) socket.join(`waiter:${staffId}`);
  }

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
