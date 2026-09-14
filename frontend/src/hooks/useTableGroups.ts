import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

const DEFAULT_OUTLET = "SHADAB";

export function useTableGroups(outlet: string = DEFAULT_OUTLET) {
  return useQuery({
    queryKey: ["tableGroups", outlet],
    queryFn: () => api.tables.groups(outlet),
  });
}
