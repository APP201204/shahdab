import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/DataTable";
import { StatusBadge } from "@/components/StatusBadge";
import { db } from "@/mocks/db";
import { pageWrapper, pageHeader } from "@/lib/styles";
import { format, parseISO } from "date-fns";
import { Eye } from "lucide-react";

function formatCurrency(amount: number) {
  return `₹${amount.toFixed(2)}`;
}

type BillRow = (typeof db.bills)[number];

export function BillHistoryPage() {
  const { outlet } = useAuth();

  if (!outlet) return null;

  const bills = useMemo(
    () =>
      db.bills
        .filter((b) => b.outlet_id === outlet.id && b.status === "paid")
        .sort(
          (a, b) =>
            new Date(b.closed_at ?? b.created_at).getTime() -
            new Date(a.closed_at ?? a.created_at).getTime()
        ),
    [outlet.id]
  );

  function orderLabel(bill: BillRow) {
    const order = db.orders.find((o) => o.id === bill.order_id);
    if (!order) return "Unknown";
    if (order.order_type === "takeaway") {
      return `Takeaway — ${order.customer_name ?? "Guest"}`;
    }
    const table = order.table_id
      ? db.tables.find((t) => t.id === order.table_id)
      : null;
    return `Table ${table?.table_number ?? "-"}`;
  }

  const columns = [
    { key: "bill_number", header: "Bill #", render: (bill: BillRow) => bill.bill_number },
    { key: "order", header: "Table/Customer", render: (bill: BillRow) => orderLabel(bill) },
    {
      key: "created_at",
      header: "Date",
      render: (bill: BillRow) => format(parseISO(bill.created_at), "dd MMM, h:mm a"),
    },
    {
      key: "total",
      header: "Total",
      align: "right" as const,
      render: (bill: BillRow) => formatCurrency(bill.total_amount),
    },
    {
      key: "status",
      header: "Status",
      render: (bill: BillRow) => <StatusBadge status={bill.status} />,
    },
    {
      key: "actions",
      header: "Actions",
      render: (bill: BillRow) => (
        <Button
          asChild
          size="icon"
          variant="ghost"
          aria-label={`View bill ${bill.bill_number}`}
        >
          <Link to={`/bills/${bill.id}`}>
            <Eye className="h-4 w-4" />
          </Link>
        </Button>
      ),
    },
  ];

  return (
    <div className={pageWrapper}>
      <div className={pageHeader}>
        <h1 className="text-2xl font-bold">Bill History</h1>
      </div>
      <DataTable
        columns={columns}
        rows={bills}
        rowKey={(bill) => bill.id}
        emptyText="No paid bills yet"
      />
    </div>
  );
}
