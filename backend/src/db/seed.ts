import { eq } from "drizzle-orm";
import bcrypt from "bcrypt";
import { randomUUID } from "node:crypto";
import { db } from "./index.ts";
import * as schema from "./schema.ts";
import { SECTIONS, CATEGORIES, MENU_ITEMS, TABLES, STAFF } from "./seed-data.ts";

async function runSeed() {
  const existing = await db.query.outlets.findFirst({
    where: eq(schema.outlets.name, "SHADAB"),
  });

  if (existing) {
    console.log(`SHADAB outlet already exists (${existing.id}); skipping seed.`);
    return;
  }

  await db.transaction(async (tx) => {
    const [org] = await tx
      .insert(schema.organizations)
      .values({
        id: randomUUID(),
        name: "SHADAB RestaurantOS",
        plan: "trial",
        maxOutlets: 1,
        maxStaff: 20,
      })
      .returning();

    const [outlet] = await tx
      .insert(schema.outlets)
      .values({
        id: randomUUID(),
        orgId: org.id,
        name: "SHADAB",
        address: "The Taste of Hyderabad",
        timezone: "Asia/Kolkata",
        currency: "INR",
        active: true,
      })
      .returning();

    const sectionMap = new Map<string, string>();
    for (const s of SECTIONS) {
      const id = randomUUID();
      sectionMap.set(s.id, id);
      await tx.insert(schema.sections).values({
        id,
        outletId: outlet.id,
        name: s.name,
        type: s.type,
        tagline: s.tagline,
        serviceCharge: s.serviceCharge,
        ownBranding: s.ownBranding,
        color: s.color,
        active: s.active,
      });
    }

    const kitchenMap = new Map<string, string>();
    const kitchens = [
      { id: randomUUID(), name: "Veg", color: "oklch(0.6 0.15 150)" },
      { id: randomUUID(), name: "Non-Veg", color: "oklch(0.55 0.2 30)" },
      { id: randomUUID(), name: "Mocktails", color: "oklch(0.6 0.18 200)" },
    ];
    for (const k of kitchens) {
      kitchenMap.set(k.name, k.id);
      await tx.insert(schema.kitchens).values({
        id: k.id,
        outletId: outlet.id,
        name: k.name,
        color: k.color,
      });
    }

    const categoryMap = new Map<string, string>();
    CATEGORIES.forEach((c, i) => {
      const id = randomUUID();
      categoryMap.set(c.id, id);
    });
    for (const [slug, cat] of CATEGORIES.entries()) {
      await tx.insert(schema.menuCategories).values({
        id: categoryMap.get(cat.id)!,
        outletId: outlet.id,
        name: cat.name,
        sortOrder: slug,
      });
    }

    const menuItemMap = new Map<string, string>();
    for (const item of MENU_ITEMS) {
      const id = randomUUID();
      menuItemMap.set(item.id, id);

      let kitchenId: string | undefined;
      if (item.categoryId === "beverages" || item.categoryId === "desserts") {
        kitchenId = kitchenMap.get("Mocktails");
      } else if (item.foodType === "veg") {
        kitchenId = kitchenMap.get("Veg");
      } else {
        kitchenId = kitchenMap.get("Non-Veg");
      }

      const [row] = await tx
        .insert(schema.menuItems)
        .values({
          id,
          outletId: outlet.id,
          categoryId: categoryMap.get(item.categoryId)!,
          kitchenId,
          name: item.name,
          foodType: item.foodType,
          basePrice: item.price,
          favorite: item.favorite,
          spicy: item.spicy ?? false,
          mrp: item.mrp ?? false,
          status: item.status,
        })
        .returning();

      for (const v of item.variants) {
        await tx.insert(schema.menuItemVariants).values({
          id: randomUUID(),
          itemId: row.id,
          name: v.name,
          price: v.price,
          available: v.available,
        });
      }
    }

    const staffNameToId = new Map<string, string>();
    for (const s of STAFF) {
      const userId = randomUUID();
      const staffId = randomUUID();
      staffNameToId.set(s.name, staffId);

      await tx.insert(schema.users).values({
        id: userId,
        orgId: org.id,
        phone: s.phone,
        passwordHash: await bcrypt.hash("password", 10),
        active: s.active,
      });

      await tx.insert(schema.staff).values({
        id: staffId,
        userId,
        outletId: outlet.id,
        name: s.name,
        phone: s.phone,
        active: s.active,
      });

      for (const role of s.roles) {
        await tx.insert(schema.staffRoles).values({
          id: randomUUID(),
          staffId,
          outletId: outlet.id,
          role,
          assignment: s.assignment,
        });
      }
    }

    for (const t of TABLES) {
      const id = randomUUID();
      await tx.insert(schema.tables).values({
        id,
        outletId: outlet.id,
        sectionId: sectionMap.get(t.sectionId)!,
        number: t.number,
        name: t.name,
        capacity: t.capacity,
        status: t.status,
        guests: t.guests,
        waiterId: t.waiter ? staffNameToId.get(t.waiter) : undefined,
        startedAt: t.startedAt ? new Date(t.startedAt) : undefined,
        kots: t.kots,
      });
    }

    console.log(`Seeded SHADAB outlet: ${outlet.id}`);
  });
}

runSeed()
  .then(() => {
    console.log("seed complete");
    process.exit(0);
  })
  .catch((err) => {
    console.error("seed failed:", err);
    process.exit(1);
  });
