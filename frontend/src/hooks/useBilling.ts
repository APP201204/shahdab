import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

const OUTLET = "SHADAB";
const QUEUE = ["billing", "queue", OUTLET];

export function useBillingQueue() {
  return useQuery({
    queryKey: QUEUE,
    queryFn: () => api.billing.queue(OUTLET),
  });
}

export function usePreviewBill() {
  return useMutation({
    mutationFn: ({
      orderId,
      discount,
    }: {
      orderId: string;
      discount?: { kind: "flat" | "percent"; value: number };
    }) => api.billing.preview(orderId, discount),
  });
}

export function useCloseBill() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      orderId: string;
      payments: { method: "cash" | "card" | "upi" | "wallet"; amount: number }[];
      cashierId: string;
      customer?: string;
      discount?: { kind: "flat" | "percent"; value: number };
    }) => api.billing.close(body),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: QUEUE });
      client.invalidateQueries({ queryKey: ["tables", OUTLET] });
      client.invalidateQueries({ queryKey: ["tableGroups", OUTLET] });
      client.invalidateQueries({ queryKey: ["bills", OUTLET] });
    },
  });
}
