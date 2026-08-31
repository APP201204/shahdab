import { Toaster, toast } from "sonner";
import type { NotificationType } from "@/types";
import type { ReactNode } from "react";
import { Bell, CheckCircle2, AlertTriangle, Receipt, UtensilsCrossed } from "lucide-react";

const toastConfig: Record<NotificationType, { icon: ReactNode; duration: number }> = {
  item_ready: { icon: <UtensilsCrossed className="h-4 w-4" />, duration: 4000 },
  bill_requested: { icon: <Receipt className="h-4 w-4" />, duration: 4000 },
  out_of_stock: { icon: <AlertTriangle className="h-4 w-4" />, duration: 5000 },
  table_assigned: { icon: <CheckCircle2 className="h-4 w-4" />, duration: 3000 },
  general: { icon: <Bell className="h-4 w-4" />, duration: 3000 },
};

export function NotificationToast() {
  return <Toaster position="top-right" richColors closeButton />;
}

export function showNotificationToast(
  type: NotificationType,
  message: string,
  description?: string
) {
  const { icon, duration } = toastConfig[type];

  switch (type) {
    case "out_of_stock":
      toast.warning(message, { duration, description, icon });
      break;
    case "item_ready":
    case "table_assigned":
      toast.success(message, { duration, description, icon });
      break;
    case "bill_requested":
      toast.info(message, { duration, description, icon });
      break;
    default:
      toast(message, { duration, description, icon });
  }
}
