import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

const OUTLET = "SHADAB";

export function useOrders() {
  return useQuery({
    queryKey: ["orders", "active", OUTLET],
    queryFn: () => api.orders.active(OUTLET),
  });
}

export function useServeItem() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.orderItems.serve(id),
    onSuccess: () => client.invalidateQueries({ queryKey: ["orders", "active", OUTLET] }),
  });
}
