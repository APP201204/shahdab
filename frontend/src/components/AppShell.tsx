import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { selectClass } from "@/lib/styles";
import { Button } from "@/components/ui/button";
import { LoadingState } from "@/components/LoadingState";
import { ChefHat, LogOut, Package } from "lucide-react";
import { navItems } from "@/app/nav";

export function AppShell() {
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
      <aside className="fixed left-0 top-0 z-40 flex h-screen w-64 flex-col border-r bg-background lg:shadow-sm">
        <div className="border-b p-4">
          <h1 className="text-lg font-bold">Shahdab</h1>
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
        </div>

        <nav className="flex-1 overflow-y-auto p-3">
          <ul className="space-y-1">
            {visibleNav.map(({ label, to, icon: Icon }) => (
              <li key={to}>
                <NavLink
                  to={to}
                  end={to === "/"}
                  className={({ isActive }) =>
                    cn(
                      "flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                      isActive ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                    )
                  }
                >
                  <Icon className="h-4 w-4" />
                  <span className="flex-1">{label}</span>
                  {to === "/notifications" && unreadCount > 0 && (
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
                      "flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                      isActive ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                    )
                  }
                >
                  <ChefHat className="h-4 w-4" />
                  <span>Kitchen</span>
                </NavLink>
              </li>
            )}
            {takeawayQueueLink && (
              <li>
                <NavLink
                  to={takeawayQueueLink}
                  className={({ isActive }) =>
                    cn(
                      "flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                      isActive ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                    )
                  }
                >
                  <Package className="h-4 w-4" />
                  <span>Takeaway Queue</span>
                </NavLink>
              </li>
            )}
          </ul>
        </nav>

        <div className="border-t p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">{staff.name}</span>
            <Button variant="outline" size="icon" onClick={logout} aria-label="Sign out">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </aside>
      <main className="ml-64 min-h-screen p-4 sm:p-6">
        <Outlet />
      </main>
    </div>
  );
}
