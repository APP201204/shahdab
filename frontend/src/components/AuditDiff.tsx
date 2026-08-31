interface DiffRow {
  key: string;
  before: unknown;
  after: unknown;
  changed: boolean;
}

function buildDiff(
  before: Record<string, unknown> | null,
  after: Record<string, unknown> | null
): DiffRow[] {
  const beforeKeys = before ? Object.keys(before) : [];
  const afterKeys = after ? Object.keys(after) : [];
  const keys = Array.from(new Set([...beforeKeys, ...afterKeys])).sort();
  return keys.map((key) => {
    const beforeValue = before?.[key];
    const afterValue = after?.[key];
    return {
      key,
      before: beforeValue,
      after: afterValue,
      changed: JSON.stringify(beforeValue) !== JSON.stringify(afterValue),
    };
  });
}

function formatJson(value: unknown) {
  return JSON.stringify(value, null, 2);
}

interface AuditDiffProps {
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
}

export function AuditDiff({ before, after }: AuditDiffProps) {
  const rows = buildDiff(before, after);

  return (
    <div className="space-y-4">
      <table className="w-full text-sm">
        <thead className="border-b text-left text-muted-foreground">
          <tr>
            <th className="py-2 font-medium">Field</th>
            <th className="py-2 font-medium">Before</th>
            <th className="py-2 font-medium">After</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((row) => (
            <tr key={row.key}>
              <td className="py-2 align-top text-xs font-medium">{row.key}</td>
              <td className="py-2 align-top">
                <pre className="whitespace-pre-wrap break-all rounded bg-destructive/10 p-2 text-sm">
                  {formatJson(row.before)}
                </pre>
              </td>
              <td className="py-2 align-top">
                <pre className="whitespace-pre-wrap break-all rounded bg-green-100 p-2 text-sm">
                  {formatJson(row.after)}
                </pre>
              </td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td
                colSpan={3}
                className="py-4 text-center text-muted-foreground"
              >
                No diff available.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="rounded-md border bg-destructive/10 p-3">
          <h4 className="mb-1 text-xs font-medium text-muted-foreground">
            Before JSON
          </h4>
          <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-all text-sm">
            {formatJson(before)}
          </pre>
        </div>
        <div className="rounded-md border bg-green-100 p-3">
          <h4 className="mb-1 text-xs font-medium text-muted-foreground">
            After JSON
          </h4>
          <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-all text-sm">
            {formatJson(after)}
          </pre>
        </div>
      </div>
    </div>
  );
}
