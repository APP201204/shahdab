import { dataService } from "@/mocks/db";

export interface AuditPayload {
  organization_id: string;
  outlet_id: string | null;
  staff_id: string;
  action: string;
  entity_type: string;
  entity_id: string;
  before_json: Record<string, unknown> | null;
  after_json: Record<string, unknown> | null;
}

export function logAudit(payload: AuditPayload) {
  dataService("auditLogs").create({
    ...payload,
    created_at: new Date().toISOString(),
  });
}
