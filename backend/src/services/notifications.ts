import { eq, and, inArray } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { db } from "../db/index.ts";
import * as schema from "../db/schema.ts";
import { getSocketServer } from "../socket/index.ts";

export async function createAndNotify({
  outletId,
  room,
  message,
  userId,
}: {
  outletId: string;
  room: string;
  message: string;
  userId?: string;
}) {
  const [notification] = await db
    .insert(schema.notifications)
    .values({
      id: randomUUID(),
      outletId,
      userId,
      message,
    })
    .returning();

  const io = getSocketServer();
  io?.to(room).emit("notification", notification);
  io?.to(`outlet:${outletId}`).emit("notification", notification);

  return notification;
}

export async function listNotifications({
  userId,
  outletId,
}: {
  userId?: string;
  outletId?: string;
}) {
  const conditions = [];
  if (userId) conditions.push(eq(schema.notifications.userId, userId));
  if (outletId) conditions.push(eq(schema.notifications.outletId, outletId));
  if (conditions.length === 0) throw new Error("userId or outletId required");

  return db
    .select()
    .from(schema.notifications)
    .where(and(...conditions))
    .orderBy(schema.notifications.at);
}

export async function markRead({
  userId,
  outletId,
  ids,
}: {
  userId?: string;
  outletId?: string;
  ids?: string[];
}) {
  if (!userId && !outletId) throw new Error("userId or outletId required");

  const conditions = [eq(schema.notifications.read, false)];
  if (userId) conditions.push(eq(schema.notifications.userId, userId));
  if (outletId) conditions.push(eq(schema.notifications.outletId, outletId));
  if (ids && ids.length > 0) {
    conditions.push(inArray(schema.notifications.id, ids));
  }

  const [updated] = await db
    .update(schema.notifications)
    .set({ read: true })
    .where(and(...conditions))
    .returning();

  return updated;
}
