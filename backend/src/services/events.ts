import { getSocketServer } from "../socket/index.ts";

export function emitTableUpdate(outletId: string, table: unknown) {
  const io = getSocketServer();
  io?.to(`outlet:${outletId}:tables`).emit("tables.updated", table);
}

export function emitReservationUpdate(outletId: string, reservation: unknown) {
  const io = getSocketServer();
  io?.to(`outlet:${outletId}:reservations`).emit("reservations.updated", reservation);
}
