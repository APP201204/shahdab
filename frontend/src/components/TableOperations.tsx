import { useState, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { inputClass } from "@/lib/styles";
import { db } from "@/mocks/db";
import { cn } from "@/lib/utils";
import { logAudit } from "@/services/audit";
import { mockApi } from "@/services/mockApi";
import type { Table, TableMergeGroup } from "@/types";

interface TableOperationsProps {
  table: Table;
  onChange: () => void;
}

export function TableOperations({ table, onChange }: TableOperationsProps) {
  const { staff, outlet, organization, can } = useAuth();
  const [message, setMessage] = useState<{
    type: "error" | "success";
    text: string;
  } | null>(null);
  const [mode, setMode] = useState<"none" | "merge" | "transfer">("none");
  const [mergeIds, setMergeIds] = useState<string[]>([]);
  const [transferToId, setTransferToId] = useState("");

  if (!staff || !outlet || !organization) return null;

  const hasActiveOrder = (tableId: string) => {
    return db.orders.some(
      (o) =>
        (o.table_id === tableId || o.merge_group_id) &&
        o.outlet_id === outlet.id &&
        o.status !== "closed"
    );
  };

  const floorTables = useMemo(
    () =>
      db.tables
        .filter(
          (t) =>
            t.floor_id === table.floor_id &&
            t.outlet_id === outlet.id &&
            t.id !== table.id
        )
        .sort((a, b) => Number(a.table_number) - Number(b.table_number)),
    [table.floor_id, table.id, outlet.id]
  );

  const group = useMemo(
    () =>
      table.merge_group_id
        ? db.tableMergeGroups.find(
            (g) => g.id === table.merge_group_id && g.status === "active"
          ) ?? null
        : null,
    [table.merge_group_id]
  );

  const groupMembers = useMemo(() => {
    if (!group) return [];
    return db.tableMergeGroupMembers
      .filter((m) => m.merge_group_id === group.id)
      .map((m) => db.tables.find((t) => t.id === m.table_id))
      .filter((t): t is Table => Boolean(t));
  }, [group]);

  const mergeCandidates = floorTables.filter(
    (t) =>
      t.status === "vacant" &&
      t.merge_group_id === null &&
      !hasActiveOrder(t.id)
  );

  const transferCandidates = floorTables.filter(
    (t) => t.status === "vacant" && !hasActiveOrder(t.id)
  );

  const merge = async () => {
    setMessage(null);
    const selectedIds = [table.id, ...mergeIds];
    const response = await mockApi.post<TableMergeGroup>("/tables/merge", {
      table_ids: selectedIds,
      organization_id: organization.id,
      outlet_id: outlet.id,
      floor_id: table.floor_id,
      staff_id: staff.id,
    });
    if (response.error) {
      setMessage({ type: "error", text: response.error.message });
      return;
    }
    const group = response.data!;
    setMergeIds([]);
    setMode("none");
    setMessage({
      type: "success",
      text: `Tables ${selectedIds
        .map((id) => db.tables.find((t) => t.id === id)?.table_number)
        .filter(Boolean)
        .join("+")} merged`,
    });
    logAudit({
      organization_id: organization.id,
      outlet_id: outlet.id,
      staff_id: staff.id,
      action: "table.merge",
      entity_type: "table_merge_group",
      entity_id: group.id,
      before_json: { tables: selectedIds, status: "vacant" },
      after_json: { tables: selectedIds, merge_group_id: group.id, status: "merged" },
    });
    onChange();
  };

  const split = async () => {
    setMessage(null);
    if (!group) {
      setMessage({ type: "error", text: "Table is not in an active merge group" });
      return;
    }

    const response = await mockApi.post<unknown>(`/table-merge-groups/${group.id}/split`);
    if (response.error) {
      setMessage({ type: "error", text: response.error.message });
      return;
    }

    setMessage({ type: "success", text: "Merge group split" });
    logAudit({
      organization_id: organization.id,
      outlet_id: outlet.id,
      staff_id: staff.id,
      action: "table.split",
      entity_type: "table_merge_group",
      entity_id: group.id,
      before_json: { tables: groupMembers.map((m) => m.id), status: "active" },
      after_json: { tables: groupMembers.map((m) => m.id), status: "released" },
    });
    onChange();
  };

  const transfer = async () => {
    setMessage(null);
    if (!transferToId) {
      setMessage({ type: "error", text: "Select a destination table" });
      return;
    }

    const dest = db.tables.find((t) => t.id === transferToId);
    if (!dest) return;

    const response = await mockApi.post<unknown>(`/tables/${table.id}/transfer`, {
      to_table_id: transferToId,
    });
    if (response.error) {
      setMessage({ type: "error", text: response.error.message });
      return;
    }

    setTransferToId("");
    setMode("none");
    setMessage({
      type: "success",
      text: `Moved to Table ${dest.table_number}`,
    });
    logAudit({
      organization_id: organization.id,
      outlet_id: outlet.id,
      staff_id: staff.id,
      action: "table.transfer",
      entity_type: "table",
      entity_id: table.id,
      before_json: { from_table_id: table.id, to_table_id: dest.id, status: table.status },
      after_json: { from_table_id: table.id, to_table_id: dest.id, status: "transferred" },
    });
    onChange();
  };

  const canMerge = can("table.merge");
  const canSplit = can("table.split");
  const canTransfer = can("table.transfer");

  if (!canMerge && !canSplit && !canTransfer) return null;

  return (
    <div className="rounded-md border p-3">
      <h3 className="mb-2 font-semibold">Table Operations</h3>

      {message && (
        <div
          className={cn(
            "mb-2 rounded-md p-2 text-sm",
            message.type === "error"
              ? "bg-destructive/10 text-destructive"
              : "bg-green-100 text-green-800"
          )}
        >
          {message.text}
        </div>
      )}

      {mode === "none" && (
        <div className="flex flex-wrap gap-2">
          {canMerge && !group && (
            <Button size="sm" onClick={() => setMode("merge")}>
              Merge
            </Button>
          )}
          {canSplit && group && (
            <Button size="sm" variant="secondary" onClick={split}>
              Split
            </Button>
          )}
          {canTransfer && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setMode("transfer")}
            >
              Transfer
            </Button>
          )}
        </div>
      )}

      {mode === "merge" && (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            Select tables to merge with Table {table.table_number}
          </p>
          <div className="max-h-40 space-y-1 overflow-y-auto rounded-md border p-2">
            {mergeCandidates.map((t) => (
              <label
                key={t.id}
                className="flex items-center gap-2 text-sm"
              >
                <input
                  type="checkbox"
                  checked={mergeIds.includes(t.id)}
                  onChange={(e) => {
                    setMergeIds((prev) =>
                      e.target.checked
                        ? [...prev, t.id]
                        : prev.filter((id) => id !== t.id)
                    );
                  }}
                />
                Table {t.table_number} (cap {t.capacity})
              </label>
            ))}
            {mergeCandidates.length === 0 && (
              <p className="text-xs text-muted-foreground">
                No available tables to merge.
              </p>
            )}
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={merge}
              disabled={mergeIds.length === 0}
            >
              Confirm Merge
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setMode("none");
                setMergeIds([]);
                setMessage(null);
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {mode === "transfer" && (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            Move reservation/waiter to another table on this floor
          </p>
          <select
            className={inputClass}
            value={transferToId}
            onChange={(e) => setTransferToId(e.target.value)}
            aria-label="Select destination table"
          >
            <option value="">Select destination table</option>
            {transferCandidates.map((t) => (
              <option key={t.id} value={t.id}>
                Table {t.table_number} (cap {t.capacity})
              </option>
            ))}
          </select>
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={transfer}
              disabled={!transferToId}
            >
              Confirm Transfer
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setMode("none");
                setTransferToId("");
                setMessage(null);
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
