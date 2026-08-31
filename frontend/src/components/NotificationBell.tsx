import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Bell, Check } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export function NotificationBell() {
  const { notifications, unreadCount, markNotificationRead } = useAuth();
  const [open, setOpen] = useState(false);

  const recent = notifications.slice(0, 5);

  return (
    <div className="relative">
      <Button
        variant={open ? "default" : "ghost"}
        size="icon"
        className="relative"
        onClick={() => setOpen((v) => !v)}
        aria-label="Notifications"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-destructive px-1 text-[10px] text-destructive-foreground">
            {unreadCount}
          </span>
        )}
      </Button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-80 rounded-md border bg-popover p-2 text-popover-foreground shadow-lg">
          <div className="mb-2 flex items-center justify-between px-2 py-1">
            <span className="text-sm font-semibold">Notifications</span>
            {unreadCount > 0 && (
              <span className="text-xs text-muted-foreground">
                {unreadCount} unread
              </span>
            )}
          </div>
          <ul className="max-h-72 space-y-1 overflow-y-auto">
            {recent.map((n) => (
              <li
                key={n.id}
                className={cn(
                  "rounded-md p-2 text-sm",
                  n.is_read ? "bg-muted/50" : "bg-card"
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">{n.message}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(n.created_at))} ago
                    </p>
                  </div>
                  {!n.is_read && (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6 shrink-0"
                      onClick={() => markNotificationRead(n.id)}
                    >
                      <Check className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              </li>
            ))}
            {recent.length === 0 && (
              <li className="p-2 text-sm text-muted-foreground">
                No notifications.
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
