import type { RouteObject } from "react-router-dom";
import { AppShell } from "@/components/AppShell";
import { PrivateRoute } from "@/components/PrivateRoute";
import { PermissionRoute } from "@/components/PermissionRoute";
import { Forbidden } from "@/components/Forbidden";
import { NotFound } from "@/components/NotFound";
import { Login } from "@/pages/Login";
import { CustomerQueuePage } from "@/pages/CustomerQueuePage";
import { NotificationsPage } from "@/pages/NotificationsPage";
import { KitchenPage } from "@/pages/KitchenPage";
import { KitchenTakeawayPage } from "@/pages/KitchenTakeawayPage";
import { BillingPage } from "@/pages/BillingPage";
import { BillDetailPage } from "@/pages/BillDetailPage";
import { BillHistoryPage } from "@/pages/BillHistoryPage";
import { AnalyticsPage } from "@/pages/AnalyticsPage";
import { AuditLogsPage } from "@/pages/AuditLogsPage";
import { PlaceholderPage } from "@/pages/PlaceholderPage";
import { MenuPage } from "@/pages/MenuPage";
import { ReservationsPage } from "@/pages/ReservationsPage";
import { SetupPage } from "@/pages/SetupPage";
import { StaffPage } from "@/pages/StaffPage";
import { TakeawayPage } from "@/pages/TakeawayPage";
import { StockOutPage } from "@/pages/StockOutPage";
import { TablesPage } from "@/pages/TablesPage";
import { WaitlistPage } from "@/pages/WaitlistPage";

export const routes: RouteObject[] = [
  { path: "/login", element: <Login /> },
  { path: "/queue/:outletId", element: <CustomerQueuePage /> },
  {
    path: "/",
    element: <PrivateRoute />,
    children: [
      {
        element: <AppShell />,
        children: [
          { index: true, element: <PlaceholderPage title="Dashboard" /> },
          { path: "forbidden", element: <Forbidden /> },
          { path: "tables", element: <PermissionRoute permission={["table.merge", "order.read", "setup.manage"]}><TablesPage /></PermissionRoute> },
          { path: "waitlist", element: <PermissionRoute permission="reservation.create"><WaitlistPage /></PermissionRoute> },
          { path: "reservations", element: <PermissionRoute permission="reservation.create"><ReservationsPage /></PermissionRoute> },
          { path: "menu", element: <PermissionRoute permission="menu.read"><MenuPage /></PermissionRoute> },
          { path: "takeaway", element: <PermissionRoute permission={["order.create", "bill.create"]}><TakeawayPage /></PermissionRoute> },
          { path: "kitchen/:kitchenId", element: <PermissionRoute permission="kitchen.tickets.read"><KitchenPage /></PermissionRoute> },
          { path: "kitchen/:kitchenId/takeaway", element: <PermissionRoute permission="kitchen.takeaway.read"><KitchenTakeawayPage /></PermissionRoute> },
          { path: "billing", element: <PermissionRoute permission="bill.create"><BillingPage /></PermissionRoute> },
          { path: "bills/history", element: <PermissionRoute permission="bill.read"><BillHistoryPage /></PermissionRoute> },
          { path: "bills/:id", element: <PermissionRoute permission="bill.read"><BillDetailPage /></PermissionRoute> },
          { path: "stock-out", element: <PermissionRoute permission="stock.update"><StockOutPage /></PermissionRoute> },
          { path: "staff", element: <PermissionRoute permission="staff.create"><StaffPage /></PermissionRoute> },
          { path: "setup", element: <PermissionRoute permission="setup.manage"><SetupPage /></PermissionRoute> },
          { path: "settings", element: <PermissionRoute permission="outlet.update"><PlaceholderPage title="Settings" /></PermissionRoute> },
          { path: "notifications", element: <PermissionRoute permission="notification.read"><NotificationsPage /></PermissionRoute> },
          { path: "analytics", element: <PermissionRoute permission="analytics.read"><AnalyticsPage /></PermissionRoute> },
          { path: "audit-logs", element: <PermissionRoute permission="audit.read"><AuditLogsPage /></PermissionRoute> },
          { path: "*", element: <NotFound /> },
        ],
      },
    ],
  },
];
