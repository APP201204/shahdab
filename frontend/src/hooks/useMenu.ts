import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

const DEFAULT_OUTLET = "SHADAB";

export function useMenu(outlet: string = DEFAULT_OUTLET, includeOutOfStock = false) {
  return useQuery({
    queryKey: ["menu", outlet, includeOutOfStock],
    queryFn: () => api.menu.list(outlet, includeOutOfStock),
  });
}
