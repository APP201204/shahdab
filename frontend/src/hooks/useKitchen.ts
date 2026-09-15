import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

const OUTLET = "SHADAB";
const TICKETS_KEY = ["kitchen", "tickets", OUTLET];

export function useKitchenTickets() {
  return useQuery({
    queryKey: TICKETS_KEY,
    queryFn: () => api.kitchen.tickets(OUTLET),
    refetchInterval: 3000,
  });
}

export function useKitchenItemActions() {
  const client = useQueryClient();
  const invalidate = () => client.invalidateQueries({ queryKey: TICKETS_KEY });

  const accept = useMutation({
    mutationFn: api.kitchen.accept,
    onSuccess: invalidate,
  });

  const startCooking = useMutation({
    mutationFn: api.kitchen.startCooking,
    onSuccess: invalidate,
  });

  const markReady = useMutation({
    mutationFn: api.kitchen.markReady,
    onSuccess: invalidate,
  });

  const markAllReady = useMutation({
    mutationFn: api.kitchen.markAllReady,
    onSuccess: invalidate,
  });

  const advance = (id: string, status: "placed" | "accepted" | "cooking") => {
    if (status === "placed") accept.mutate(id);
    else if (status === "accepted") startCooking.mutate(id);
    else if (status === "cooking") markReady.mutate(id);
  };

  return {
    accept,
    startCooking,
    markReady,
    markAllReady,
    advance,
  };
}
