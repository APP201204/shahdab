import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

const DEFAULT_OUTLET = "SHADAB";

export function useStaff(outlet: string = DEFAULT_OUTLET) {
  return useQuery({
    queryKey: ["staff", outlet],
    queryFn: () => api.staff.list(outlet),
  });
}

export function useCreateStaff() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.staff.create,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["staff"] }),
  });
}

export function useUpdateStaff() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: { id: string } & Parameters<typeof api.staff.update>[1]) =>
      api.staff.update(id, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["staff"] }),
  });
}
