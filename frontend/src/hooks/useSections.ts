import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

const DEFAULT_OUTLET = "SHADAB";

export function useSections(outlet: string = DEFAULT_OUTLET) {
  return useQuery({
    queryKey: ["sections", outlet],
    queryFn: () => api.sections.list(outlet),
  });
}
