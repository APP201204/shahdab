export const API_ERROR_CODES = {
  NOT_FOUND: "The requested resource was not found.",
  INVALID_BODY: "The request body is missing or invalid.",
  INVALID_PATH: "The request path is not supported.",
  TABLE_HAS_ACTIVE_ORDER:
    "Cannot complete this action because one or more tables have an active or unpaid order.",
  TABLE_NOT_VACANT: "The destination table is not vacant.",
  ITEM_ALREADY_COOKING:
    "Cannot cancel this item because it is already cooking or ready.",
  PAYMENT_MISMATCH:
    "Total payment does not match the total amount due.",
  ORDER_NOT_TAKEAWAY:
    "This action is only valid for takeaway orders.",
  NO_BILLING_STATION: "No billing station is configured for this floor.",
  CART_EMPTY: "Add at least one item to the cart.",
  BILLING_LIMIT_REACHED:
    "A billing station already exists for this floor.",
} as const;

export type ApiErrorCode = keyof typeof API_ERROR_CODES;

export function getErrorMessage(code: ApiErrorCode, detail?: string): string {
  const base = API_ERROR_CODES[code] ?? "An unexpected error occurred.";
  return detail ? `${base} ${detail}` : base;
}
