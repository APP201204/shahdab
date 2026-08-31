type Listener = (...args: unknown[]) => void;
const listeners: Record<string, Listener[]> = {};

export function on(event: string, listener: Listener) {
  if (!listeners[event]) listeners[event] = [];
  listeners[event].push(listener);
  return () => off(event, listener);
}

export function off(event: string, listener: Listener) {
  listeners[event] = (listeners[event] ?? []).filter((l) => l !== listener);
}

export function emit(event: string, ...args: unknown[]) {
  listeners[event]?.forEach((listener) => listener(...args));
}
