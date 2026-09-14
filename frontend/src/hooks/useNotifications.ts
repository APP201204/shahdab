import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

export function useNotifications(outletId?: string) {
  return useQuery({
    queryKey: ["notifications", outletId],
    queryFn: () => (outletId ? api.notifications.list(outletId) : { notifications: [] }),
    enabled: !!outletId,
  });
}

export function useMarkReadNotifications(outletId?: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (ids?: string[]) =>
      outletId ? api.notifications.markRead(outletId, ids) : Promise.resolve(null),
    onSuccess: () => client.invalidateQueries({ queryKey: ["notifications", outletId] }),
  });
}
