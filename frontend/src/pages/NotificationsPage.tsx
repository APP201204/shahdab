import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/EmptyState";
import { formatDistanceToNow } from "date-fns";
import { Bell, ChefHat, Receipt, AlertTriangle, User } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { NotificationType } from "@/types";
import {
  pageWrapper,
  tabList,
  tabButton,
  tabButtonActive,
  tabButtonInactive,
} from "@/lib/styles";

const iconMap: Record<NotificationType, LucideIcon> = {
  item_ready: ChefHat,
  bill_requested: Receipt,
  out_of_stock: AlertTriangle,
  table_assigned: User,
  general: Bell,
};

export function NotificationsPage() {
  const { notifications, unreadCount, markNotificationRead } = useAuth();
  const [filter, setFilter] = useState<"all" | "unread">("all");

  const visible =
    filter === "all"
      ? notifications
      : notifications.filter((n) => !n.is_read);

  return (
    <div className={`p-6 ${pageWrapper}`}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <h1 className="text-2xl font-bold">
          Notifications {unreadCount > 0 && `(${unreadCount} unread)`}
        </h1>

        <div className={tabList} role="tablist" aria-label="Filter notifications">
          <button
            role="tab"
            aria-selected={filter === "all"}
            onClick={() => setFilter("all")}
            className={`${tabButton} ${
              filter === "all" ? tabButtonActive : tabButtonInactive
            }`}
          >
            All
          </button>
          <button
            role="tab"
            aria-selected={filter === "unread"}
            onClick={() => setFilter("unread")}
            className={`${tabButton} ${
              filter === "unread" ? tabButtonActive : tabButtonInactive
            }`}
          >
            Unread {unreadCount > 0 && `(${unreadCount})`}
          </button>
        </div>
      </div>

      {visible.length === 0 ? (
        <EmptyState title="No notifications" description="You're all caught up." />
      ) : (
        <ul className="divide-y rounded-md border" role="list" aria-label="Notifications">
          {visible.map((n) => {
            const Icon = iconMap[n.type] ?? Bell;
            return (
              <li
                key={n.id}
                className={`flex items-start justify-between gap-4 p-4 ${
                  !n.is_read
                    ? "bg-muted/50 border-l-4 border-primary"
                    : "bg-card"
                }`}
                role="listitem"
              >
                <div className="flex items-start gap-4">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted">
                    <Icon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-card-foreground">{n.message}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(n.created_at))} ago
                    </p>
                  </div>
                </div>

                {!n.is_read && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => markNotificationRead(n.id)}
                    aria-label="Mark as read"
                  >
                    Mark read
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
