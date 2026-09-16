import { useEffect } from "react";
import { io, type Socket } from "socket.io-client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuth } from "./useAuth";

const API_BASE =
  ((import.meta.env as Record<string, string | undefined>)["VITE_API_URL"]) ??
  "http://localhost:4000/api/v1";
const SOCKET_URL = new URL(API_BASE).origin;

export function useRealtimeSync() {
  const queryClient = useQueryClient();
  const { data: auth } = useAuth();
  const staffId = auth?.staff.staffId;
  const outletId = auth?.staff.outletId;
  const role = auth?.staff.roles[0];

  useEffect(() => {
    if (!staffId || !outletId) return;

    const socket: Socket = io(SOCKET_URL, {
      query: { outletId, staffId, role },
    });

    const invalidate = (...keys: string[]) =>
      keys.forEach((key) => queryClient.invalidateQueries({ queryKey: [key] }));

    const seenNotifications = new Set<string>();

    socket.on("tables.updated", () =>
      invalidate("tables", "tableGroups", "orders", "billing"),
    );
    socket.on("orders.updated", () =>
      invalidate("orders", "kitchen", "tables", "tableGroups", "billing", "bills"),
    );
    socket.on("kitchen.ticket", () =>
      invalidate("kitchen", "orders", "billing"),
    );
    socket.on("stock.updated", () => invalidate("menu"));
    socket.on("reservations.updated", () => invalidate("reservations"));
    socket.on("notification", (n: { id?: string; message?: string }) => {
      invalidate("notifications");
      if (n?.id) {
        if (seenNotifications.has(n.id)) return;
        seenNotifications.add(n.id);
      }
      if (n?.message) toast.info(n.message);
    });

    return () => {
      socket.disconnect();
    };
  }, [staffId, outletId, role, queryClient]);
}
