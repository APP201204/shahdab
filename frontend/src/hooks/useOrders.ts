import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

const OUTLET = "SHADAB";
const ACTIVE_KEY = ["orders", "active", OUTLET];

export function useOrders() {
  return useQuery({
    queryKey: ACTIVE_KEY,
    queryFn: () => api.orders.active(OUTLET),
    refetchInterval: 4000,
  });
}

export function useServeItem() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.orderItems.serve(id),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ACTIVE_KEY });
      client.invalidateQueries({ queryKey: ["kitchen"] });
      client.invalidateQueries({ queryKey: ["billing"] });
    },
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
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ACTIVE_KEY });
      client.invalidateQueries({ queryKey: ["kitchen"] });
    },
  });
}

export function useCreateTakeawayOrder() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: Parameters<typeof api.orders.createTakeaway>[0]) =>
      api.orders.createTakeaway(body),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ACTIVE_KEY });
      client.invalidateQueries({ queryKey: ["kitchen"] });
      client.invalidateQueries({ queryKey: ["billing"] });
    },
  });
}

export function usePickupOrder() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (orderId: string) => api.orders.pickup(orderId),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ACTIVE_KEY });
      client.invalidateQueries({ queryKey: ["kitchen"] });
      client.invalidateQueries({ queryKey: ["billing"] });
    },
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
