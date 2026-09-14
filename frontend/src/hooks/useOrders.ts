import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

const OUTLET = "SHADAB";
const ACTIVE_KEY = ["orders", "active", OUTLET];

export function useOrders() {
  return useQuery({
    queryKey: ACTIVE_KEY,
    queryFn: () => api.orders.active(OUTLET),
  });
}

export function useServeItem() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.orderItems.serve(id),
    onSuccess: () => client.invalidateQueries({ queryKey: ACTIVE_KEY }),
  });
}

export function useAddOrderItems() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ orderId, items }: { orderId: string; items: Parameters<typeof api.orders.addItems>[1] }) =>
      api.orders.addItems(orderId, items),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ACTIVE_KEY });
    },
  });
}

export function useSendToKitchen() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ orderId, createdBy }: { orderId: string; createdBy: string }) =>
      api.orders.sendToKitchen(orderId, createdBy),
    onSuccess: () => client.invalidateQueries({ queryKey: ACTIVE_KEY }),
  });
}

export function useUpdateOrderItemNote() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, note }: { id: string; note: string }) => api.orderItems.updateNote(id, note),
    onSuccess: () => client.invalidateQueries({ queryKey: ACTIVE_KEY }),
  });
}

export function useCancelOrderItem() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.orderItems.cancel(id),
    onSuccess: () => client.invalidateQueries({ queryKey: ACTIVE_KEY }),
  });
}
