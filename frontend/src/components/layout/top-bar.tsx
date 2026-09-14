import { Bell, ChevronDown, Wifi, CheckCircle2, UtensilsCrossed, LogOut } from "lucide-react";
import { RESTAURANT } from "@/data/seed";
import { timeOf } from "@/lib/format";
import { useSections } from "@/hooks/useSections";
import { useNotifications, useMarkReadNotifications } from "@/hooks/useNotifications";
import { useAuth, useLogout } from "@/hooks/useAuth";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const OUTLET = "SHADAB";

export function TopBar() {
  const { data: sectionsData } = useSections(OUTLET);
  const outletId = sectionsData?.sections[0]?.outletId;
  const { data } = useNotifications(outletId);
  const markRead = useMarkReadNotifications(outletId);
  const notifications = data?.notifications ?? [];
  const unread = notifications.filter((n) => !n.read).length;
  const { data: auth } = useAuth();
  const staff = auth?.staff;
  const logout = useLogout();
  const initials = staff?.name ? staff.name.slice(0, 2).toUpperCase() : "?";

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-4 border-b border-border bg-card px-4">
      <div className="flex items-center gap-2">
        <span className="flex size-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <UtensilsCrossed className="size-4" />
        </span>
        <span className="text-sm font-semibold tracking-tight">{RESTAURANT.product}</span>
      </div>

      <div className="hidden items-center gap-2 md:flex">
        <span className="flex size-7 items-center justify-center rounded-full bg-brand text-[10px] font-bold text-brand-foreground">
          SH
        </span>
        <div className="leading-tight">
          <p className="text-sm font-semibold tracking-[0.18em] text-brand-alt">
            {RESTAURANT.name}
          </p>
          <p className="text-[10px] text-muted-foreground">{RESTAURANT.tagline}</p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs font-medium text-foreground hover:bg-accent">
            shadab <ChevronDown className="size-3" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem>shadab — Main Branch</DropdownMenuItem>
            <DropdownMenuItem>shadab — Nampally</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <span className="size-2 rounded-full bg-success" aria-label="Online" />
        <span className="hidden items-center gap-1 rounded-full bg-success-soft px-2 py-0.5 text-[11px] font-medium text-success sm:flex">
          <CheckCircle2 className="size-3" /> Live
        </span>
        <Wifi className="size-4 text-muted-foreground" />

        <DropdownMenu>
          <DropdownMenuTrigger
            className="relative rounded-md p-1.5 hover:bg-accent"
            aria-label="Notifications"
          >
            <Bell className="size-4 text-muted-foreground" />
            {unread > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex size-4 items-center justify-center rounded-full bg-destructive text-[9px] font-bold text-white">
                {unread}
              </span>
            )}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80">
            <div className="flex items-center justify-between px-2 py-1.5">
              <p className="text-xs font-semibold">Notifications</p>
              <button
                className="text-[11px] font-medium text-primary"
                onClick={() => markRead.mutate()}
                disabled={!outletId || markRead.isPending}
              >
                Mark all read
              </button>
            </div>
            <DropdownMenuSeparator />
            {notifications.length === 0 && (
              <p className="px-2 py-4 text-center text-xs text-muted-foreground">
                No notifications
              </p>
            )}
            {notifications.slice(0, 10).map((n) => (
              <DropdownMenuItem key={n.id} className="flex items-start gap-2">
                <span
                  className={
                    n.read
                      ? "mt-1.5 size-1.5 shrink-0 rounded-full bg-muted"
                      : "mt-1.5 size-1.5 shrink-0 rounded-full bg-primary"
                  }
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs">{n.message}</span>
                  <span className="text-[10px] text-muted-foreground">{timeOf(n.at)}</span>
                </span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center gap-1 rounded-md px-1 py-1 text-xs font-semibold hover:bg-accent">
            <span className="flex size-7 items-center justify-center rounded-full bg-primary-soft text-primary">
              {initials}
            </span>
            <ChevronDown className="size-3 text-muted-foreground" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem disabled>{staff?.name}</DropdownMenuItem>
            <DropdownMenuItem disabled>{staff?.roles.join(", ")}</DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() => !logout.isPending && logout.mutate()}
              className="text-destructive"
            >
              <LogOut className="mr-2 size-3.5" /> Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
