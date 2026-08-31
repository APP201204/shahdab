import { z } from "zod";

export function getFirstError(result: z.SafeParseReturnType<unknown, unknown>): string {
  if (result.success) return "";
  return result.error.issues[0]?.message ?? "Invalid input";
}

export const organizationSchema = z.object({
  name: z.string().min(1, "Organization name is required"),
  slug: z
    .string()
    .min(1, "Slug is required")
    .regex(/^[a-z0-9-]+$/, "Slug may only contain lowercase letters, numbers and hyphens"),
  timezone: z.string().min(1, "Timezone is required"),
  currency: z.string().min(1, "Currency is required"),
});

export const outletSchema = z.object({
  name: z.string().min(1, "Outlet name is required"),
  address: z.union([z.string().optional(), z.null()]).optional(),
  timezone: z.string().min(1, "Timezone is required"),
  currency: z.string().min(1, "Currency is required"),
});

export const staffSchema = z.object({
  name: z.string().min(1, "Name is required"),
  phone: z.string().min(1, "Phone is required"),
  email: z.union([z.string().email("Invalid email"), z.literal(""), z.null()]).optional(),
  password: z.string().min(1, "Password is required"),
  outlet_id: z.union([z.string().min(1, "Outlet is required"), z.literal("")]).optional(),
});

export const reservationSchema = z.object({
  guest_name: z.string().min(1, "Guest name is required"),
  guest_phone: z.string().min(1, "Guest phone is required"),
  party_size: z.coerce.number().min(1, "Party size must be at least 1"),
  reservation_time: z.string().refine(
    (v) => !isNaN(new Date(v).getTime()),
    "Select a valid reservation time"
  ),
  floor_id: z.string().min(1, "Floor is required"),
  table_id: z.union([z.string(), z.literal(""), z.null()]).optional(),
});

export const orderSchema = z.object({
  order_type: z.enum(["dine_in", "takeaway"]),
  floor_id: z.string().min(1, "Floor is required"),
  table_id: z.union([z.string(), z.literal(""), z.null()]).optional(),
  customer_name: z.union([z.string().min(1, "Customer name is required"), z.literal(""), z.null()]).optional(),
  customer_phone: z.union([z.string().min(1, "Customer phone is required"), z.literal(""), z.null()]).optional(),
});

export const paymentSchema = z.object({
  payment_method: z.enum(["cash", "card", "upi", "wallet"]),
  amount: z.coerce.number().min(0.01, "Amount must be greater than 0"),
  transaction_ref: z.union([z.string(), z.literal(""), z.null()]).optional(),
});

export const billSplitSchema = z.object({
  split_type: z.enum(["by_item", "by_number"]),
  split_count: z.coerce.number().min(2, "Split count must be at least 2"),
});

export const floorSchema = z.object({
  name: z.string().min(1, "Floor name is required"),
  display_order: z.coerce.number().min(1, "Display order must be 1 or more"),
});

export const kitchenSchema = z.object({
  name: z.string().min(1, "Kitchen name is required"),
});

export const tableSchema = z.object({
  table_number: z.string().min(1, "Table number is required"),
  capacity: z.coerce.number().min(1, "Capacity must be at least 1"),
  floor_id: z.string().min(1, "Floor is required"),
});

export const billingStationSchema = z.object({
  name: z.string().min(1, "Billing station name is required"),
  floor_id: z.string().min(1, "Floor is required"),
});

export const taxSchema = z.object({
  name: z.string().min(1, "Tax name is required"),
  percentage: z.coerce.number().min(0, "Percentage must be 0 or more"),
  applicable_on: z.enum(["bill", "item"], { message: "Select a valid applicability" }),
});

export type OrganizationInput = z.infer<typeof organizationSchema>;
export type OutletInput = z.infer<typeof outletSchema>;
export type StaffInput = z.infer<typeof staffSchema>;
export type ReservationInput = z.infer<typeof reservationSchema>;
export type OrderInput = z.infer<typeof orderSchema>;
export type PaymentInput = z.infer<typeof paymentSchema>;
