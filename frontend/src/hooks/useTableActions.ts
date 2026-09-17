import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

const OUTLET = "SHADAB";
const TABLES = ["tables", OUTLET];
const GROUPS = ["tableGroups", OUTLET];
const ORDERS = ["orders", "active", OUTLET];

function useInvalidate() {
  const client = useQueryClient();
  return () => {
    client.invalidateQueries({ queryKey: TABLES });
    client.invalidateQueries({ queryKey: GROUPS });
    client.invalidateQueries({ queryKey: ORDERS });
  };
}

export function useSeatTable() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, guests, waiterId }: { id: string; guests: number; waiterId?: string }) =>
      api.tables.seat(id, guests, waiterId),
    onSuccess: invalidate,
  });
}

export function useMarkCleaned() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (id: string) => api.tables.markCleaned(id),
    onSuccess: invalidate,
  });
}

export function useNeedsCleaning() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (id: string) => api.tables.needsCleaning(id),
    onSuccess: invalidate,
  });
}

export function useRequestBill() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (id: string) => api.tables.requestBill(id),
    onSuccess: invalidate,
  });
}

export function useMergeTables() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (body: { tableIds: string[]; guests?: number; waiterId?: string; name?: string }) =>
      api.tables.merge(body),
    onSuccess: invalidate,
  });
}

export function useReleaseMerge() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (id: string) => api.tables.releaseMerge(id),
    onSuccess: invalidate,
  });
}

export function useSplitTable() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (body: { tableId: string; subTables: { capacity: number; name?: string }[] }) =>
      api.tables.split(body.tableId, body.subTables),
    onSuccess: invalidate,
  });
}

export function useUnsplitTable() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (id: string) => api.tables.unsplit(id),
    onSuccess: invalidate,
  });
}

export function useMoveTable() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (body: { from: string; to: string }) => api.tables.move(body.from, body.to),
    onSuccess: invalidate,
  });
}

export function useUpdateTable() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (body: { id: string; number?: number; capacity?: number; name?: string; waiterId?: string | null }) =>
      api.tables.update(body.id, body),
    onSuccess: invalidate,
  });
}

export function useCreateTable() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (body: {
      outletId: string;
      sectionId: string;
      number: number;
      capacity: number;
      name?: string;
      waiterId?: string;
    }) => api.tables.create(body),
    onSuccess: invalidate,
  });
}
