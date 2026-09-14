import { createContext, useContext, useState, type ReactNode } from "react";
import {
  BILL_HISTORY,
  INITIAL_ORDERS,
  NOTIFICATIONS,
  RESERVATIONS,
  TABLES,
  type AppNotification,
  type Bill,
  type OrderLine,
  type Reservation,
  type RTable,
  type TableMergeGroup,
  type TableSplitGroup,
} from "@/data/seed";

type AppState = {
  tables: RTable[];
  setTables: React.Dispatch<React.SetStateAction<RTable[]>>;
  mergeGroups: TableMergeGroup[];
  setMergeGroups: React.Dispatch<React.SetStateAction<TableMergeGroup[]>>;
  splitGroups: TableSplitGroup[];
  setSplitGroups: React.Dispatch<React.SetStateAction<TableSplitGroup[]>>;
  orders: Record<string, OrderLine[]>;
  setOrders: React.Dispatch<React.SetStateAction<Record<string, OrderLine[]>>>;
  guestCounts: Record<string, number>;
  setGuestCounts: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  reservations: Reservation[];
  setReservations: React.Dispatch<React.SetStateAction<Reservation[]>>;
  bills: Bill[];
  setBills: React.Dispatch<React.SetStateAction<Bill[]>>;
  notifications: AppNotification[];
  setNotifications: React.Dispatch<React.SetStateAction<AppNotification[]>>;
  stockOut: Record<string, boolean>;
  setStockOut: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  notify: (message: string) => void;
};

const AppStateContext = createContext<AppState | null>(null);

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [tables, setTables] = useState<RTable[]>(TABLES);
  const [mergeGroups, setMergeGroups] = useState<TableMergeGroup[]>([]);
  const [splitGroups, setSplitGroups] = useState<TableSplitGroup[]>([]);
  const [orders, setOrders] = useState<Record<string, OrderLine[]>>(INITIAL_ORDERS);
  const [guestCounts, setGuestCounts] = useState<Record<string, number>>(
    Object.fromEntries(TABLES.map((t) => [t.id, t.guests])),
  );
  const [reservations, setReservations] = useState<Reservation[]>(RESERVATIONS);
  const [bills, setBills] = useState<Bill[]>(BILL_HISTORY);
  const [notifications, setNotifications] = useState<AppNotification[]>(NOTIFICATIONS);
  const [stockOut, setStockOut] = useState<Record<string, boolean>>({});

  const notify = (message: string) =>
    setNotifications((prev) => [
      { id: `n${Date.now()}`, message, at: new Date().toISOString(), read: false },
      ...prev,
    ]);

  return (
    <AppStateContext.Provider
      value={{
        tables,
        setTables,
        mergeGroups,
        setMergeGroups,
        splitGroups,
        setSplitGroups,
        orders,
        setOrders,
        guestCounts,
        setGuestCounts,
        reservations,
        setReservations,
        bills,
        setBills,
        notifications,
        setNotifications,
        stockOut,
        setStockOut,
        notify,
      }}
    >
      {children}
    </AppStateContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAppState() {
  const ctx = useContext(AppStateContext);
  if (!ctx) {
    throw new Error("useAppState must be used within an AppStateProvider");
  }
  return ctx;
}
