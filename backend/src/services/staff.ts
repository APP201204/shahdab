import { eq, and, inArray, asc } from "drizzle-orm";
import bcrypt from "bcrypt";
import { randomUUID } from "node:crypto";
import { db } from "../db/index.ts";
import * as schema from "../db/schema.ts";

export async function listStaff({ outletId }: { outletId: string }) {
  const rows = await db
    .select()
    .from(schema.staff)
    .where(eq(schema.staff.outletId, outletId))
    .orderBy(asc(schema.staff.name));

  const roles = rows.length
    ? await db
        .select()
        .from(schema.staffRoles)
        .where(inArray(schema.staffRoles.staffId, rows.map((s) => s.id)))
    : [];

  const rolesByStaff = new Map<string, typeof roles>();
  for (const r of roles) {
    const list = rolesByStaff.get(r.staffId) ?? [];
    list.push(r);
    rolesByStaff.set(r.staffId, list);
  }

  return {
    staff: rows.map((s) => {
      const staffRoles = rolesByStaff.get(s.id) ?? [];
      return {
        ...s,
        roles: staffRoles.map((r) => r.role),
        assignment: staffRoles[0]?.assignment,
      };
    }),
  };
}

export async function createStaff({
  orgId,
  outletId,
  name,
  phone,
  roles,
  assignment,
  active = true,
}: {
  orgId: string;
  outletId: string;
  name: string;
  phone: string;
  roles: string[];
  assignment?: string;
  active?: boolean;
}) {
  if (roles.length === 0) throw new Error("at least one role is required");

  return db.transaction(async (tx) => {
    const [user] = await tx
      .insert(schema.users)
      .values({
        id: randomUUID(),
        orgId,
        phone,
        passwordHash: await bcrypt.hash("password", 10),
        active,
      })
      .returning();

    const [staff] = await tx
      .insert(schema.staff)
      .values({
        id: randomUUID(),
        userId: user.id,
        outletId,
        name,
        phone,
        active,
      })
      .returning();

    for (const role of roles) {
      await tx.insert(schema.staffRoles).values({
        id: randomUUID(),
        staffId: staff.id,
        outletId,
        role: role as any,
        assignment,
      });
    }

    return { ...staff, roles, assignment };
  });
}

export async function updateStaff({
  staffId,
  name,
  phone,
  roles,
  assignment,
  active,
}: {
  staffId: string;
  name?: string;
  phone?: string;
  roles?: string[];
  assignment?: string;
  active?: boolean;
}) {
  return db.transaction(async (tx) => {
    const [staff] = await tx
      .select()
      .from(schema.staff)
      .where(eq(schema.staff.id, staffId))
      .for("update");
    if (!staff) throw new Error("staff not found");

    const update: any = {};
    if (name !== undefined) update.name = name;
    if (phone !== undefined) update.phone = phone;
    if (active !== undefined) update.active = active;

    const [updated] = await tx
      .update(schema.staff)
      .set(update)
      .where(eq(schema.staff.id, staffId))
      .returning();

    if (roles && roles.length > 0) {
      await tx.delete(schema.staffRoles).where(eq(schema.staffRoles.staffId, staffId));
      for (const role of roles) {
        await tx.insert(schema.staffRoles).values({
          id: randomUUID(),
          staffId,
          outletId: staff.outletId,
          role: role as any,
          assignment,
        });
      }
    } else if (assignment !== undefined) {
      await tx
        .update(schema.staffRoles)
        .set({ assignment })
        .where(eq(schema.staffRoles.staffId, staffId));
    }

    const newRoles = await tx
      .select()
      .from(schema.staffRoles)
      .where(eq(schema.staffRoles.staffId, staffId));

    return { ...updated, roles: newRoles.map((r) => r.role), assignment: newRoles[0]?.assignment };
  });
}
