import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, type SessionStaff } from "@/lib/api";

export function useAuth() {
  return useQuery<{ staff: SessionStaff } | null>({
    queryKey: ["auth", "me"],
    queryFn: async () => {
      try {
        return await api.auth.me();
      } catch (err: any) {
        if (err.message?.includes("401")) return null;
        throw err;
      }
    },
    retry: false,
    refetchOnWindowFocus: false,
    staleTime: 5 * 60 * 1000,
  });
}

export function useLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.auth.login,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["auth", "me"] }),
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.auth.logout,
    onSuccess: () => queryClient.setQueryData(["auth", "me"], null),
  });
}
