import { useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { db, dataService } from "@/mocks/db";
import { cn } from "@/lib/utils";
import type { MenuItem } from "@/types";

type Message = { type: "error" | "success"; text: string } | null;

export function StockOutPage() {
  const { staff, outlet, organization } = useAuth();
  const [version, setVersion] = useState(0);
  const [message, setMessage] = useState<Message>(null);

  if (!staff || !outlet || !organization) return null;

  const items = useMemo(
    () =>
      db.menuItems
        .filter((m) => m.outlet_id === outlet.id && m.is_active)
        .sort((a, b) => a.name.localeCompare(b.name)),
    [outlet.id, version]
  );

  const categories = useMemo(
    () =>
      db.menuCategories
        .filter((c) => c.outlet_id === outlet.id && c.is_active)
        .sort((a, b) => a.display_order - b.display_order),
    [outlet.id]
  );

  const toggleStock = (menuItem: MenuItem) => {
    const now = new Date().toISOString();
    const existing = db.menuItemStockStatus.find(
      (s) => s.menu_item_id === menuItem.id && s.outlet_id === outlet.id
    );

    const before = { is_out_of_stock: existing?.is_out_of_stock ?? false };
    const after = { is_out_of_stock: !before.is_out_of_stock };

    if (existing) {
      dataService("menuItemStockStatus").update(existing.id, {
        is_out_of_stock: after.is_out_of_stock,
        updated_by: staff.id,
        updated_at: now,
      });
    } else {
      dataService("menuItemStockStatus").create({
        menu_item_id: menuItem.id,
        outlet_id: outlet.id,
        is_out_of_stock: true,
        updated_by: staff.id,
        updated_at: now,
      });
    }

    dataService("auditLogs").create({
      organization_id: organization.id,
      outlet_id: outlet.id,
      staff_id: staff.id,
      action: "stock.update",
      entity_type: "menu_item",
      entity_id: menuItem.id,
      before_json: before,
      after_json: after,
      created_at: now,
    });

    const captainRole = db.roles.find((r) => r.name === "captain");
    if (captainRole) {
      const captainIds = db.staffRoles
        .filter((sr) => sr.role_id === captainRole.id && sr.outlet_id === outlet.id)
        .map((sr) => sr.staff_id);
      for (const captainId of new Set(captainIds)) {
        dataService("notifications").create({
          organization_id: organization.id,
          staff_id: captainId,
          type: "out_of_stock",
          message: `${menuItem.name} is now ${after.is_out_of_stock ? "out of stock" : "back in stock"}`,
          related_order_id: null,
          related_order_item_id: null,
          is_read: false,
          created_at: now,
        });
      }
    }

    setVersion((v) => v + 1);
    setMessage({
      type: "success",
      text: `${menuItem.name} marked ${after.is_out_of_stock ? "out of stock" : "in stock"}`,
    });
  };

  const isOutOfStock = (menuItem: MenuItem) => {
    return (
      db.menuItemStockStatus.find(
        (s) => s.menu_item_id === menuItem.id && s.outlet_id === outlet.id
      )?.is_out_of_stock ?? false
    );
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Stock Out</h1>

      {message && (
        <div
          className={cn(
            "rounded-md p-3 text-sm",
            message.type === "error"
              ? "bg-destructive/10 text-destructive"
              : "bg-green-100 text-green-800"
          )}
        >
          {message.text}
        </div>
      )}

      <div className="space-y-6">
        {categories.map((category) => {
          const categoryItems = items.filter(
            (item) => item.category_id === category.id
          );
          if (categoryItems.length === 0) return null;
          return (
            <div key={category.id}>
              <h2 className="mb-3 text-lg font-semibold">{category.name}</h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {categoryItems.map((item) => {
                  const out = isOutOfStock(item);
                  const kitchen = db.kitchens.find((k) => k.id === item.kitchen_id);
                  return (
                    <div
                      key={item.id}
                      className={cn(
                        "rounded-md border p-3",
                        out && "bg-red-50/50"
                      )}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-medium">{item.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {kitchen?.name ?? "Unknown kitchen"}
                          </p>
                        </div>
                        <span
                          className={cn(
                            "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
                            out
                              ? "bg-red-100 text-red-800"
                              : "bg-green-100 text-green-800"
                          )}
                        >
                          {out ? "Out of stock" : "In stock"}
                        </span>
                      </div>
                      <Button
                        className="mt-3 w-full"
                        size="sm"
                        variant={out ? "default" : "secondary"}
                        onClick={() => toggleStock(item)}
                      >
                        {out ? "Restock" : "Mark Out of Stock"}
                      </Button>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
