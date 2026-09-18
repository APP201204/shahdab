import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { eq } from "drizzle-orm";
import { createHmac, timingSafeEqual } from "node:crypto";
import bcrypt from "bcrypt";
import { db } from "../db/index.ts";
import * as schema from "../db/schema.ts";
import { config } from "../config.ts";

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

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const revoked = new Set<string>();

type TokenPayload = Session & { exp: number };

function sign(body: string) {
  return createHmac("sha256", config.jwtSecret).update(body).digest("base64url");
}

function encodeToken(payload: TokenPayload) {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${sign(body)}`;
}

function decodeToken(token: string): Session | undefined {
  const [body, sig] = token.split(".");
  if (!body || !sig) return undefined;
  const expected = sign(body);
  if (
    sig.length !== expected.length ||
    !timingSafeEqual(Buffer.from(sig), Buffer.from(expected))
  ) {
    return undefined;
  }
  try {
    const { exp, ...session } = JSON.parse(
      Buffer.from(body, "base64url").toString(),
    ) as TokenPayload;
    if (!exp || exp < Date.now()) return undefined;
    return session;
  } catch {
    return undefined;
  }
}

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

  const session: Session = {
    userId: user.id,
    staffId: staff.id,
    outletId: staff.outletId,
    orgId: outlet.orgId,
    roles,
    name: staff.name,
    phone: user.phone,
  };
  const sessionId = encodeToken({ ...session, exp: Date.now() + SESSION_TTL_MS });
  return { sessionId, staff: { ...session } };
}

export function getSession(sessionId: string | undefined) {
  if (!sessionId || revoked.has(sessionId)) return undefined;
  return decodeToken(sessionId);
}

export function destroySession(sessionId: string) {
  revoked.add(sessionId);
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
