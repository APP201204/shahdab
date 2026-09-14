import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { eq } from "drizzle-orm";
import { randomBytes } from "node:crypto";
import bcrypt from "bcrypt";
import { db } from "../db/index.ts";
import * as schema from "../db/schema.ts";

export type Session = {
  userId: string;
  staffId: string;
  outletId: string;
  orgId: string;
  roles: string[];
  name: string;
  phone: string;
};

declare module "fastify" {
  interface FastifyRequest {
    user?: Session;
  }
}

const sessions = new Map<string, Session>();

export async function createSession({
  phone,
  password,
}: {
  phone: string;
  password: string;
}) {
  const [user] = await db.select().from(schema.users).where(eq(schema.users.phone, phone));
  if (!user || !user.passwordHash) {
    throw new Error("invalid credentials");
  }
  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) throw new Error("invalid credentials");
  if (!user.active) throw new Error("account disabled");

  const [staff] = await db.select().from(schema.staff).where(eq(schema.staff.userId, user.id));
  if (!staff) throw new Error("no staff record");
  if (!staff.active) throw new Error("staff disabled");

  const [outlet] = await db
    .select()
    .from(schema.outlets)
    .where(eq(schema.outlets.id, staff.outletId));
  if (!outlet) throw new Error("outlet not found");

  const rolesRows = await db
    .select({ role: schema.staffRoles.role })
    .from(schema.staffRoles)
    .where(eq(schema.staffRoles.staffId, staff.id));
  const roles = rolesRows.map((r) => r.role);

  const sessionId = randomBytes(32).toString("hex");
  const session: Session = {
    userId: user.id,
    staffId: staff.id,
    outletId: staff.outletId,
    orgId: outlet.orgId,
    roles,
    name: staff.name,
    phone: user.phone,
  };
  sessions.set(sessionId, session);
  return { sessionId, staff: { ...session } };
}

export function getSession(sessionId: string | undefined) {
  return sessionId ? sessions.get(sessionId) : undefined;
}

export function destroySession(sessionId: string) {
  sessions.delete(sessionId);
}

export function setAuthHook(app: FastifyInstance) {
  app.addHook("preHandler", async (request: FastifyRequest, reply: FastifyReply) => {
    const url = request.url.split("?")[0];
    if (url === "/health" || url === "/api/v1/auth/login") {
      return;
    }
    const sessionId = request.cookies.sessionId;
    const session = getSession(sessionId);
    if (!session) {
      return reply.status(401).send({ error: "unauthorized" });
    }
    request.user = session;
  });
}

export function requireRole(allowed: string[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user;
    if (!user || !allowed.some((role) => user.roles.includes(role))) {
      return reply.status(403).send({ error: "forbidden" });
    }
  };
}
