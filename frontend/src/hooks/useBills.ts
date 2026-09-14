import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

const DEFAULT_OUTLET = "SHADAB";

export function useBills(outlet: string = DEFAULT_OUTLET) {
  return useQuery({
    queryKey: ["bills", outlet],
    queryFn: () => api.bills.list(outlet),
  });
}

export function useBill(id: string | null) {
  return useQuery({
    queryKey: ["bill", id],
    queryFn: () => (id ? api.bills.get(id) : null),
    enabled: Boolean(id),
  });
}
