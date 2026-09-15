import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { toast } from "sonner";

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
  const onError = (err: Error) => toast.error(err.message);

  const accept = useMutation({
    mutationFn: api.kitchen.accept,
    onSuccess: invalidate,
    onError,
  });

  const startCooking = useMutation({
    mutationFn: api.kitchen.startCooking,
    onSuccess: invalidate,
    onError,
  });

  const markReady = useMutation({
    mutationFn: api.kitchen.markReady,
    onSuccess: invalidate,
    onError,
  });

  const markAllReady = useMutation({
    mutationFn: api.kitchen.markAllReady,
    onSuccess: invalidate,
    onError,
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
