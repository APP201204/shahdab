import { getSocketServer } from "../socket/index.ts";

export function emitTableUpdate(outletId: string, table: unknown) {
  const io = getSocketServer();
  io?.to(`outlet:${outletId}:tables`).emit("tables.updated", table);
}

export function emitReservationUpdate(outletId: string, reservation: unknown) {
  const io = getSocketServer();
  io?.to(`outlet:${outletId}:reservations`).emit("reservations.updated", reservation);
}

export function emitKitchenTicket(outletId: string, kitchenId: string, ticket: unknown) {
  const io = getSocketServer();
  io?.to(`outlet:${outletId}:kitchen:${kitchenId}`).emit("kitchen.ticket", ticket);
  io?.to(`outlet:${outletId}`).emit("kitchen.ticket", ticket);
}

export function emitOrderUpdate(outletId: string, payload?: unknown) {
  const io = getSocketServer();
  io?.to(`outlet:${outletId}`).emit("orders.updated", payload ?? {});
}

export function emitStockUpdate(outletId: string, payload: { menuItemId: string; variantId?: string | null; outOfStock: boolean }) {
  const io = getSocketServer();
  io?.to(`outlet:${outletId}:menu`).emit("stock.updated", payload);
}
