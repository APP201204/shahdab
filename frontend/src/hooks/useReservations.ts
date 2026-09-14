import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

const DEFAULT_OUTLET = "SHADAB";

export function useReservations(outlet: string = DEFAULT_OUTLET) {
  return useQuery({
    queryKey: ["reservations", outlet],
    queryFn: () => api.reservations.list(outlet),
  });
}
