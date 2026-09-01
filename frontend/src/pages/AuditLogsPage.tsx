import { useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/DataTable";
import { AuditDiff } from "@/components/AuditDiff";
import { db } from "@/mocks/db";
import { inputClass } from "@/lib/styles";
import { format, parseISO, startOfDay, endOfDay } from "date-fns";
import { X } from "lucide-react";
import type { AuditLog } from "@/types";

function staffName(id: string) {
  return db.staff.find((s) => s.id === id)?.name ?? id;
}

export function AuditLogsPage() {
  const { staff, outlet, organization } = useAuth();
  const [entityType, setEntityType] = useState<string>("all");
  const [staffId, setStaffId] = useState<string>("all");
  const [start, setStart] = useState<string>("");
  const [end, setEnd] = useState<string>("");
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  if (!staff || !outlet || !organization) return null;

  const startTime = start ? startOfDay(parseISO(start)).getTime() : -Infinity;
  const endTime = end ? endOfDay(parseISO(end)).getTime() : Infinity;

  const allLogs = useMemo(
    () =>
      db.auditLogs
        .filter((l) => l.organization_id === organization.id)
        .filter((l) => (l.outlet_id ? l.outlet_id === outlet.id : true))
        .filter((l) =>
          entityType === "all" ? true : l.entity_type === entityType
        )
        .filter((l) => (staffId === "all" ? true : l.staff_id === staffId))
        .filter((l) => {
          const t = new Date(l.created_at).getTime();
          return t >= startTime && t <= endTime;
        })
        .sort(
          (a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        ),
    [organization.id, outlet.id, entityType, staffId, start, end]
  );

  const entityTypes = useMemo(
    () => Array.from(new Set(db.auditLogs.map((l) => l.entity_type))).sort(),
    []
  );

  const staffOptions = useMemo(
    () =>
      db.staff
        .filter((s) => db.auditLogs.some((l) => l.staff_id === s.id))
        .sort((a, b) => a.name.localeCompare(b.name)),
    []
  );

  const columns = [
    {
      key: "time",
      header: "Time",
      render: (log: AuditLog) =>
        format(parseISO(log.created_at), "dd MMM yyyy, h:mm a"),
    },
    {
      key: "staff",
      header: "Staff",
      render: (log: AuditLog) => staffName(log.staff_id),
    },
    {
      key: "action",
      header: "Action",
      render: (log: AuditLog) => log.action,
    },
    {
      key: "entity",
      header: "Entity",
      render: (log: AuditLog) => log.entity_type,
    },
    {
      key: "entityId",
      header: "Entity ID",
      align: "left" as const,
      render: (log: AuditLog) => (
        <span className="font-mono text-xs">{log.entity_id}</span>
      ),
    },
  ];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Audit Logs</h1>
      </div>

      <div className="grid gap-2 rounded-md border p-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground">
            Entity type
          </label>
          <select
            value={entityType}
            onChange={(e) => setEntityType(e.target.value)}
            className={inputClass}
          >
            <option value="all">All</option>
            {entityTypes.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground">
            Staff
          </label>
          <select
            value={staffId}
            onChange={(e) => setStaffId(e.target.value)}
            className={inputClass}
          >
            <option value="all">All</option>
            {staffOptions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground">
            From
          </label>
          <input
            type="date"
            value={start}
            onChange={(e) => setStart(e.target.value)}
            className={inputClass}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground">
            To
          </label>
          <input
            type="date"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
            className={inputClass}
          />
        </div>
      </div>

      <DataTable
        columns={columns}
        rows={allLogs}
        rowKey={(log) => log.id}
        emptyText="No audit logs"
        emptyDescription="No audit logs match the selected filters."
        sortable
        onRowClick={setSelectedLog}
      />

      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-start justify-end bg-black/50 p-3 sm:p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg border bg-card p-4 shadow-lg">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold">Audit Entry</h2>
                <p className="text-xs text-muted-foreground">
                  {format(parseISO(selectedLog.created_at), "dd MMM yyyy, h:mm a")} •{" "}
                  {staffName(selectedLog.staff_id)}
                </p>
              </div>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => setSelectedLog(null)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="mb-3 rounded-md border bg-background p-2 text-sm">
              <p>
                <span className="text-muted-foreground">Action:</span>{" "}
                {selectedLog.action}
              </p>
              <p>
                <span className="text-muted-foreground">Entity:</span>{" "}
                {selectedLog.entity_type} / {selectedLog.entity_id}
              </p>
              {selectedLog.outlet_id && (
                <p>
                  <span className="text-muted-foreground">Outlet:</span>{" "}
                  {db.outlets.find((o) => o.id === selectedLog.outlet_id)?.name ??
                    selectedLog.outlet_id}
                </p>
              )}
            </div>

            <div className="rounded-md border p-3">
              <AuditDiff
                before={selectedLog.before_json}
                after={selectedLog.after_json}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
