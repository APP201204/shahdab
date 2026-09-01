import { useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { selectClass } from "@/lib/styles";
import { Button } from "@/components/ui/button";
import { LoadingState } from "@/components/LoadingState";
import { ChefHat, ChevronLeft, ChevronRight, LogOut, Package } from "lucide-react";
import { navItems } from "@/app/nav";

export function AppShell() {
  const [collapsed, setCollapsed] = useState(false);
  const { staff, outlet, outlets, roles, unreadCount, logout, setActiveOutlet, can, assignments } =
    useAuth();

  if (!staff) return (
    <main className="flex min-h-screen items-center justify-center bg-background text-foreground">
      <LoadingState message="Loading session..." />
    </main>
  );

  const visibleNav = navItems.filter((item) => !item.permission || can(item.permission));
  const firstKitchen = assignments.kitchens[0];
  const kitchenLink = firstKitchen && can("kitchen.tickets.read") ? `/kitchen/${firstKitchen}` : null;
  const takeawayQueueLink =
    firstKitchen && can("kitchen.takeaway.read") ? `/kitchen/${firstKitchen}/takeaway` : null;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <aside
        className={cn(
          "fixed left-0 top-0 z-40 flex h-screen flex-col border-r bg-background transition-all duration-200 lg:shadow-sm",
          collapsed ? "w-16" : "w-64"
        )}
      >
        <div className={cn("border-b", collapsed ? "p-2" : "p-4")}>
          {collapsed ? (
            <Button
              variant="ghost"
              size="icon"
              className="w-full"
              onClick={() => setCollapsed(false)}
              aria-label="Expand sidebar"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <h1 className="text-lg font-bold">Shahdab</h1>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setCollapsed(true)}
                  aria-label="Collapse sidebar"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
              </div>
              <select
                aria-label="Change active outlet"
                className={cn("mt-2", selectClass)}
                value={outlet?.id ?? ""}
                onChange={(e) => setActiveOutlet(e.target.value)}
              >
                {outlets.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-muted-foreground">{roles.join(", ")}</p>
            </>
          )}
        </div>

        <nav className={cn("flex-1 overflow-y-auto", collapsed ? "p-2" : "p-3")}>
          <ul className="space-y-1">
            {visibleNav.map(({ label, to, icon: Icon }) => (
              <li key={to}>
                <NavLink
                  to={to}
                  end={to === "/"}
                  className={({ isActive }) =>
                    cn(
                      "flex w-full items-center rounded-md py-2 text-sm font-medium transition-colors",
                      collapsed ? "justify-center px-2" : "gap-3 px-3",
                      isActive ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                    )
                  }
                >
                  <Icon className="h-4 w-4" />
                  <span className={cn("flex-1", collapsed && "sr-only")}>{label}</span>
                  {to === "/notifications" && unreadCount > 0 && !collapsed && (
                    <span className="flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-destructive px-1 text-[10px] text-destructive-foreground">
                      {unreadCount}
                    </span>
                  )}
                </NavLink>
              </li>
            ))}
            {kitchenLink && (
              <li>
                <NavLink
                  to={kitchenLink}
                  className={({ isActive }) =>
                    cn(
                      "flex w-full items-center rounded-md py-2 text-sm font-medium transition-colors",
                      collapsed ? "justify-center px-2" : "gap-3 px-3",
                      isActive ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                    )
                  }
                >
                  <ChefHat className="h-4 w-4" />
                  <span className={cn(collapsed && "sr-only")}>Kitchen</span>
                </NavLink>
              </li>
            )}
            {takeawayQueueLink && (
              <li>
                <NavLink
                  to={takeawayQueueLink}
                  className={({ isActive }) =>
                    cn(
                      "flex w-full items-center rounded-md py-2 text-sm font-medium transition-colors",
                      collapsed ? "justify-center px-2" : "gap-3 px-3",
                      isActive ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                    )
                  }
                >
                  <Package className="h-4 w-4" />
                  <span className={cn(collapsed && "sr-only")}>Takeaway Queue</span>
                </NavLink>
              </li>
            )}
          </ul>
        </nav>

        <div className={cn("border-t", collapsed ? "p-2" : "p-4")}>
          <div className={cn("flex", collapsed ? "justify-center" : "items-center justify-between")}>
            <span className={cn("text-sm text-muted-foreground", collapsed && "sr-only")}>{staff.name}</span>
            <Button variant="outline" size="icon" onClick={logout} aria-label="Sign out">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </aside>
      <main
        className={cn(
          "min-h-screen p-4 sm:p-6 transition-all duration-200",
          collapsed ? "ml-16" : "ml-64"
        )}
      >
        <Outlet />
      </main>
    </div>
  );
}
