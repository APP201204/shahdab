export type UUID = string;
export type ISO8601 = string;

export type OrganizationStatus = "trial" | "active" | "suspended" | "cancelled";

export interface Organization {
  id: UUID;
  name: string;
  slug: string;
  timezone: string;
  currency: string;
  status: OrganizationStatus;
  created_at: ISO8601;
  updated_at: ISO8601;
}

export interface Outlet {
  id: UUID;
  organization_id: UUID;
  name: string;
  address: string | null;
  timezone: string;
  currency: string;
  is_active: boolean;
  created_at: ISO8601;
}

export interface Floor {
  id: UUID;
  organization_id: UUID;
  outlet_id: UUID;
  name: string;
  display_order: number;
  is_active: boolean;
}

export interface Kitchen {
  id: UUID;
  organization_id: UUID;
  outlet_id: UUID;
  name: string;
  is_active: boolean;
}

export interface BillingStation {
  id: UUID;
  organization_id: UUID;
  outlet_id: UUID;
  floor_id: UUID;
  name: string;
  is_active: boolean;
}

export type TableStatus =
  | "vacant"
  | "reserved"
  | "occupied"
  | "bill_requested"
  | "paid"
  | "needs_cleaning";

export interface Table {
  id: UUID;
  organization_id: UUID;
  outlet_id: UUID;
  floor_id: UUID;
  table_number: string;
  capacity: number;
  status: TableStatus;
  merge_group_id: UUID | null;
  is_active: boolean;
  avg_time_per_person: number; // minutes
  occupied_at: ISO8601 | null;
  occupied_by_count: number | null;
  expected_vacant_at: ISO8601 | null;
}

export type TableMergeGroupStatus = "active" | "released";

export interface TableMergeGroup {
  id: UUID;
  organization_id: UUID;
  outlet_id: UUID;
  floor_id: UUID;
  status: TableMergeGroupStatus;
  created_by: UUID;
  created_at: ISO8601;
  released_at: ISO8601 | null;
}

export interface TableMergeGroupMember {
  merge_group_id: UUID;
  table_id: UUID;
}

export interface TableTransfer {
  id: UUID;
  organization_id: UUID;
  from_table_id: UUID;
  to_table_id: UUID;
  transferred_by: UUID;
  transferred_at: ISO8601;
  reason: string | null;
}

export type ReservationStatus = "booked" | "seated" | "cancelled" | "no_show";

export interface Reservation {
  id: UUID;
  organization_id: UUID;
  outlet_id: UUID;
  floor_id: UUID;
  table_id: UUID | null;
  guest_name: string;
  guest_phone: string;
  party_size: number;
  reservation_time: ISO8601;
  status: ReservationStatus;
  created_by: UUID;
  created_at: ISO8601;
}

export type WaitlistStatus = "waiting" | "notified" | "seated" | "no_show" | "cancelled";

export interface WaitlistEntry {
  id: UUID;
  organization_id: UUID;
  outlet_id: UUID;
  customer_name: string;
  customer_phone: string;
  party_size: number;
  status: WaitlistStatus;
  estimated_wait_minutes: number;
  table_id: UUID | null;
  created_at: ISO8601;
  notified_at: ISO8601 | null;
  seated_at: ISO8601 | null;
}

export interface Role {
  id: UUID;
  organization_id: UUID | null;
  name: string;
  is_system_role: boolean;
}

export interface Permission {
  id: UUID;
  code: string;
  description: string;
}

export interface RolePermission {
  role_id: UUID;
  permission_id: UUID;
}

export type StaffStatus = "active" | "inactive" | "on_leave";

export interface Staff {
  id: UUID;
  organization_id: UUID;
  outlet_id: UUID | null;
  name: string;
  phone: string;
  email: string | null;
  password_hash: string;
  status: StaffStatus;
  created_at: ISO8601;
}

export interface StaffRole {
  staff_id: UUID;
  role_id: UUID;
  outlet_id: UUID;
}

export interface StaffFloorAssignment {
  staff_id: UUID;
  floor_id: UUID;
}

export interface StaffTableAssignment {
  staff_id: UUID;
  table_id: UUID;
  assigned_at: ISO8601;
}

export interface StaffKitchenAssignment {
  staff_id: UUID;
  kitchen_id: UUID;
}

export interface MenuCategory {
  id: UUID;
  organization_id: UUID;
  outlet_id: UUID;
  name: string;
  display_order: number;
  is_active: boolean;
}

export interface MenuItem {
  id: UUID;
  organization_id: UUID;
  outlet_id: UUID;
  category_id: UUID;
  kitchen_id: UUID;
  name: string;
  description: string | null;
  image_url: string | null;
  is_active: boolean;
}

export interface MenuItemVariant {
  id: UUID;
  menu_item_id: UUID;
  variant_name: string;
  base_price: number;
  is_default: boolean;
}

export interface MenuItemFloorPrice {
  id: UUID;
  menu_item_variant_id: UUID;
  floor_id: UUID;
  price: number;
}

export interface MenuItemStockStatus {
  id: UUID;
  menu_item_id: UUID;
  outlet_id: UUID;
  is_out_of_stock: boolean;
  updated_by: UUID;
  updated_at: ISO8601;
}

export interface Modifier {
  id: UUID;
  organization_id: UUID;
  outlet_id: UUID;
  name: string;
}

export interface MenuItemModifier {
  menu_item_id: UUID;
  modifier_id: UUID;
}

export type OrderType = "dine_in" | "takeaway";
export type OrderStatus =
  | "open"
  | "partially_served"
  | "fully_served"
  | "billed"
  | "closed";

export interface Order {
  id: UUID;
  organization_id: UUID;
  outlet_id: UUID;
  floor_id: UUID;
  order_type: OrderType;
  table_id: UUID | null;
  merge_group_id: UUID | null;
  customer_name: string | null;
  customer_phone: string | null;
  captain_id: UUID;
  status: OrderStatus;
  created_at: ISO8601;
  closed_at: ISO8601 | null;
}

export interface KotBatch {
  id: UUID;
  order_id: UUID;
  batch_number: number;
  created_by: UUID;
  created_at: ISO8601;
}

export type OrderItemStatus =
  | "placed"
  | "accepted"
  | "cooking"
  | "ready"
  | "served"
  | "cancelled";

export interface OrderItem {
  id: UUID;
  organization_id: UUID;
  order_id: UUID;
  kot_batch_id: UUID;
  menu_item_id: UUID;
  menu_item_variant_id: UUID;
  kitchen_id: UUID;
  quantity: number;
  unit_price: number;
  status: OrderItemStatus;
  accepted_at: ISO8601 | null;
  cooking_at: ISO8601 | null;
  ready_at: ISO8601 | null;
  served_at: ISO8601 | null;
  served_by: UUID | null;
  created_at: ISO8601;
}

export interface OrderItemModifier {
  order_item_id: UUID;
  modifier_id: UUID;
}

export type TaxApplicableOn = "bill" | "item";

export interface Tax {
  id: UUID;
  organization_id: UUID;
  outlet_id: UUID;
  name: string;
  percentage: number;
  applicable_on: TaxApplicableOn;
  is_active: boolean;
}

export type BillStatus = "open" | "paid" | "refunded";

export interface Bill {
  id: UUID;
  organization_id: UUID;
  outlet_id: UUID;
  billing_station_id: UUID;
  order_id: UUID;
  bill_number: string;
  subtotal: number;
  discount_amount: number;
  tax_amount: number;
  total_amount: number;
  status: BillStatus;
  created_by: UUID;
  created_at: ISO8601;
  closed_at: ISO8601 | null;
}

export interface BillTax {
  bill_id: UUID;
  tax_id: UUID;
  amount: number;
}

export type BillSplitType = "by_item" | "by_number" | "none";

export interface BillSplit {
  id: UUID;
  bill_id: UUID;
  split_type: BillSplitType;
  split_label: string | null;
  amount: number;
}

export interface BillSplitItem {
  bill_split_id: UUID;
  order_item_id: UUID;
  quantity: number;
  amount: number;
}

export type DiscountType = "flat" | "percentage";

export interface Discount {
  id: UUID;
  bill_id: UUID;
  order_item_id: UUID | null;
  discount_type: DiscountType;
  value: number;
  amount_deducted: number;
  applied_by: UUID;
  reason: string | null;
  created_at: ISO8601;
}

export type PaymentMethod = "cash" | "card" | "upi" | "wallet";

export interface Payment {
  id: UUID;
  bill_id: UUID;
  bill_split_id: UUID | null;
  payment_method: PaymentMethod;
  amount: number;
  transaction_ref: string | null;
  paid_at: ISO8601;
}

export type NotificationType =
  | "item_ready"
  | "bill_requested"
  | "out_of_stock"
  | "table_assigned"
  | "general";

export interface Notification {
  id: UUID;
  organization_id: UUID;
  staff_id: UUID;
  type: NotificationType;
  message: string;
  related_order_id: UUID | null;
  related_order_item_id: UUID | null;
  is_read: boolean;
  created_at: ISO8601;
}

export interface AuditLog {
  id: UUID;
  organization_id: UUID;
  outlet_id: UUID | null;
  staff_id: UUID;
  action: string;
  entity_type: string;
  entity_id: UUID;
  before_json: Record<string, unknown> | null;
  after_json: Record<string, unknown> | null;
  created_at: ISO8601;
}

export interface Database {
  organizations: Organization[];
  outlets: Outlet[];
  floors: Floor[];
  kitchens: Kitchen[];
  billingStations: BillingStation[];
  tables: Table[];
  tableMergeGroups: TableMergeGroup[];
  tableMergeGroupMembers: TableMergeGroupMember[];
  tableTransfers: TableTransfer[];
  reservations: Reservation[];
  roles: Role[];
  permissions: Permission[];
  rolePermissions: RolePermission[];
  staff: Staff[];
  staffRoles: StaffRole[];
  staffFloorAssignments: StaffFloorAssignment[];
  staffTableAssignments: StaffTableAssignment[];
  staffKitchenAssignments: StaffKitchenAssignment[];
  menuCategories: MenuCategory[];
  menuItems: MenuItem[];
  menuItemVariants: MenuItemVariant[];
  menuItemFloorPrices: MenuItemFloorPrice[];
  menuItemStockStatus: MenuItemStockStatus[];
  modifiers: Modifier[];
  menuItemModifiers: MenuItemModifier[];
  orders: Order[];
  kotBatches: KotBatch[];
  orderItems: OrderItem[];
  orderItemModifiers: OrderItemModifier[];
  taxes: Tax[];
  bills: Bill[];
  billTaxes: BillTax[];
  billSplits: BillSplit[];
  billSplitItems: BillSplitItem[];
  discounts: Discount[];
  payments: Payment[];
  notifications: Notification[];
  auditLogs: AuditLog[];
  waitlist: WaitlistEntry[];
}
