import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

const DEFAULT_OUTLET = "SHADAB";

export function useTables(outlet: string = DEFAULT_OUTLET) {
  return useQuery({
    queryKey: ["tables", outlet],
    queryFn: () => api.tables.list(outlet),
  });
}
