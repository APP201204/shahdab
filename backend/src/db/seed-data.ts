export type SectionType = "dine-in" | "takeaway";

export type Section = {
  id: string;
  name: string;
  type: SectionType;
  tagline: string;
  serviceCharge: number;
  ownBranding: boolean;
  color: string;
  active: boolean;
};

export type TableStatus =
  "available" | "reserved" | "occupied" | "bill-requested" | "paid" | "needs-cleaning";

export type RTable = {
  id: string;
  number: number;
  name: string;
  sectionId: string;
  capacity: number;
  status: TableStatus;
  guests: number;
  waiter?: string;
  startedAt?: string;
  kots: number;
  mergeGroupId?: string;
  splitGroupId?: string;
  parentTableId?: string;
  suffix?: string;
};

export type TableMergeGroup = {
  id: string;
  name: string;
  sectionId: string;
  tableIds: string[];
  status: "active" | "released";
  waiter?: string;
  guests: number;
};

export type TableSplitGroup = {
  id: string;
  parentTableId: string;
  sectionId: string;
  subTableIds: string[];
  status: "active" | "released";
};

export type FoodType = "veg" | "non-veg" | "egg";

export type Variant = { name: string; price: number; available: boolean };

export type MenuItem = {
  id: string;
  name: string;
  categoryId: string;
  foodType: FoodType;
  price: number;
  favorite: boolean;
  spicy?: boolean;
  mrp?: boolean;
  status: "available" | "unavailable" | "not-offered" | "disabled";
  variants: Variant[];
};

export type OrderLine = {
  id: string;
  itemId: string;
  name: string;
  variant?: string;
  qty: number;
  unitPrice: number;
  status: "pending" | "on-table" | "sent-to-kitchen" | "cancelled";
  mrp?: boolean;
  note?: string;
  batch?: number;
  served?: boolean;
};

export type ReservationStatus = "booked" | "seated" | "cancelled" | "no-show";

export type Reservation = {
  id: string;
  guestName: string;
  phone: string;
  partySize: number;
  time: string;
  sectionId: string;
  tableId?: string;
  status: ReservationStatus;
};

export type PaymentMethod = "cash" | "card" | "upi" | "wallet";

export type Payment = { id: string; method: PaymentMethod; amount: number };

export type Bill = {
  id: string;
  number: string;
  unitId: string;
  unitName: string;
  sectionId: string;
  orderType: "dine-in" | "takeaway";
  customer?: string;
  items: OrderLine[];
  subtotal: number;
  discount: number;
  tax: number;
  serviceCharge: number;
  total: number;
  payments: Payment[];
  status: "open" | "paid";
  cashier: string;
  createdAt: string;
  closedAt?: string;
};

export type StaffRole =
  "captain" | "waiter" | "kitchen-manager" | "cashier" | "outlet-manager" | "admin";

export type StaffMember = {
  id: string;
  name: string;
  phone: string;
  roles: StaffRole[];
  assignment?: string;
  active: boolean;
};

export type AppNotification = {
  id: string;
  message: string;
  at: string;
  read: boolean;
};

export const TAXES = [
  { id: "cgst", name: "CGST", rate: 2.5 },
  { id: "sgst", name: "SGST", rate: 2.5 },
] as const;

export const SERVICE_CHARGE_RATE = 0;

export const RESTAURANT = {
  name: "SHADAB",
  tagline: "The Taste of Hyderabad",
  product: "RestaurantOS",
};

export const SECTIONS: Section[] = [
  {
    id: "dine-in",
    name: "Dine In",
    type: "dine-in",
    tagline: "The main hall — family seating, all-day biryani service.",
    serviceCharge: 0,
    ownBranding: true,
    color: "oklch(0.6 0.15 150)",
    active: true,
  },
  {
    id: "mezzanine",
    name: "Mezzanine",
    type: "dine-in",
    tagline: "Upper-floor seating for smaller groups and quick lunches.",
    serviceCharge: 0,
    ownBranding: false,
    color: "oklch(0.623 0.214 259.8)",
    active: true,
  },
  {
    id: "aiwan",
    name: "Aiwan-e-Khas",
    type: "dine-in",
    tagline: "The heritage banquet room — premium service and plating.",
    serviceCharge: 10,
    ownBranding: true,
    color: "oklch(0.53 0.16 40)",
    active: true,
  },
  {
    id: "ac-takeaway",
    name: "AC Takeaway",
    type: "takeaway",
    tagline: "Air-conditioned parcel counter facing the main road.",
    serviceCharge: 0,
    ownBranding: false,
    color: "oklch(0.72 0.16 68)",
    active: true,
  },
  {
    id: "ak-takeaway",
    name: "AK Takeaway",
    type: "takeaway",
    tagline: "Side-lane counter for quick pickups and bulk parcels.",
    serviceCharge: 0,
    ownBranding: false,
    color: "oklch(0.58 0.2 300)",
    active: true,
  },
  {
    id: "cafe",
    name: "Cafe",
    type: "takeaway",
    tagline: "Irani chai, Osmania biscuits and evening snacks.",
    serviceCharge: 0,
    ownBranding: true,
    color: "oklch(0.55 0.12 200)",
    active: true,
  },
];

export const CATEGORIES = [
  { id: "biryani", name: "Biryani" },
  { id: "veg-soups", name: "Veg Soups" },
  { id: "nonveg-soups", name: "Non Veg Soups" },
  { id: "veg-starters", name: "Veg Starters" },
  { id: "nonveg-starters", name: "Non Veg Starters" },
  { id: "kebabs", name: "Sea Food Kebabs" },
  { id: "breads", name: "Breads" },
  { id: "curries", name: "Curries" },
  { id: "beverages", name: "Beverages" },
  { id: "desserts", name: "Desserts" },
];

const v = (name: string, price: number, available = true): Variant => ({ name, price, available });

export const MENU_ITEMS: MenuItem[] = [
  {
    id: "m1",
    name: "Mutton Biryani",
    categoryId: "biryani",
    foodType: "non-veg",
    price: 480,
    favorite: true,
    spicy: true,
    status: "available",
    variants: [v("Regular", 480), v("Dum", 560), v("Family Pack", 1150)],
  },
  {
    id: "m2",
    name: "Chicken Biryani",
    categoryId: "biryani",
    foodType: "non-veg",
    price: 400,
    favorite: true,
    spicy: true,
    status: "available",
    variants: [v("Regular", 400), v("Dum", 460), v("Special Boneless", 520), v("Family Pack", 980)],
  },
  {
    id: "m3",
    name: "Veg Dum Biryani",
    categoryId: "biryani",
    foodType: "veg",
    price: 320,
    favorite: true,
    status: "available",
    variants: [v("Regular", 320), v("Family Pack", 760)],
  },
  {
    id: "m4",
    name: "Mutton Marag",
    categoryId: "nonveg-soups",
    foodType: "non-veg",
    price: 180,
    favorite: true,
    spicy: true,
    status: "available",
    variants: [v("Regular", 180), v("Mini", 120)],
  },
  {
    id: "m5",
    name: "Chicken Hot & Sour Soup",
    categoryId: "nonveg-soups",
    foodType: "non-veg",
    price: 150,
    favorite: false,
    status: "available",
    variants: [],
  },
  {
    id: "m6",
    name: "Sweet Corn Soup",
    categoryId: "veg-soups",
    foodType: "veg",
    price: 130,
    favorite: false,
    status: "available",
    variants: [],
  },
  {
    id: "m7",
    name: "Paneer 65",
    categoryId: "veg-starters",
    foodType: "veg",
    price: 260,
    favorite: false,
    spicy: true,
    status: "available",
    variants: [v("Half", 160), v("Full", 260)],
  },
  {
    id: "m8",
    name: "Hara Bhara Kebab",
    categoryId: "veg-starters",
    foodType: "veg",
    price: 240,
    favorite: false,
    status: "unavailable",
    variants: [],
  },
  {
    id: "m9",
    name: "Chicken 65",
    categoryId: "nonveg-starters",
    foodType: "non-veg",
    price: 290,
    favorite: true,
    spicy: true,
    status: "available",
    variants: [v("Half", 180), v("Full", 290)],
  },
  {
    id: "m10",
    name: "Shadab Special Boti Kebab",
    categoryId: "nonveg-starters",
    foodType: "non-veg",
    price: 360,
    favorite: true,
    spicy: true,
    status: "available",
    variants: [],
  },
  {
    id: "m11",
    name: "Prawn Tawa Kebab",
    categoryId: "kebabs",
    foodType: "non-veg",
    price: 420,
    favorite: false,
    spicy: true,
    status: "available",
    variants: [],
  },
  {
    id: "m12",
    name: "Fish Tikka",
    categoryId: "kebabs",
    foodType: "non-veg",
    price: 390,
    favorite: false,
    status: "not-offered",
    variants: [],
  },
  {
    id: "m13",
    name: "Rumali Roti",
    categoryId: "breads",
    foodType: "veg",
    price: 30,
    favorite: true,
    status: "available",
    variants: [],
  },
  {
    id: "m14",
    name: "Tandoori Roti",
    categoryId: "breads",
    foodType: "veg",
    price: 25,
    favorite: false,
    status: "available",
    variants: [v("Plain", 25), v("Butter", 35)],
  },
  {
    id: "m15",
    name: "Butter Chicken",
    categoryId: "curries",
    foodType: "non-veg",
    price: 380,
    favorite: false,
    status: "available",
    variants: [],
  },
  {
    id: "m16",
    name: "Dal Tadka",
    categoryId: "curries",
    foodType: "veg",
    price: 210,
    favorite: false,
    status: "available",
    variants: [],
  },
  {
    id: "m17",
    name: "Mineral Water 1L",
    categoryId: "beverages",
    foodType: "veg",
    price: 20,
    favorite: false,
    mrp: true,
    status: "available",
    variants: [],
  },
  {
    id: "m18",
    name: "Irani Chai",
    categoryId: "beverages",
    foodType: "veg",
    price: 40,
    favorite: true,
    status: "available",
    variants: [],
  },
  {
    id: "m19",
    name: "Double Ka Meetha",
    categoryId: "desserts",
    foodType: "egg",
    price: 140,
    favorite: false,
    status: "available",
    variants: [],
  },
  {
    id: "m20",
    name: "Qubani Ka Meetha",
    categoryId: "desserts",
    foodType: "veg",
    price: 150,
    favorite: false,
    status: "disabled",
    variants: [],
  },
];

const today = new Date();
const at = (h: number, m: number) =>
  new Date(today.getFullYear(), today.getMonth(), today.getDate(), h, m).toISOString();

export const TABLES: RTable[] = [
  {
    id: "t1",
    number: 1,
    name: "Table 1",
    sectionId: "dine-in",
    capacity: 4,
    status: "occupied",
    guests: 3,
    waiter: "Imran",
    startedAt: at(12, 40),
    kots: 5,
  },
  {
    id: "t2",
    number: 2,
    name: "Table 2",
    sectionId: "dine-in",
    capacity: 4,
    status: "reserved",
    guests: 0,
    kots: 0,
  },
  {
    id: "t3",
    number: 3,
    name: "Table 3",
    sectionId: "dine-in",
    capacity: 6,
    status: "occupied",
    guests: 5,
    waiter: "Salman",
    startedAt: at(13, 10),
    kots: 3,
  },
  {
    id: "t4",
    number: 4,
    name: "Table 4",
    sectionId: "dine-in",
    capacity: 2,
    status: "available",
    guests: 0,
    kots: 0,
  },
  {
    id: "t5",
    number: 5,
    name: "Table 5",
    sectionId: "mezzanine",
    capacity: 4,
    status: "available",
    guests: 0,
    kots: 0,
  },
  {
    id: "t6",
    number: 6,
    name: "Table 6",
    sectionId: "mezzanine",
    capacity: 8,
    status: "occupied",
    guests: 7,
    waiter: "Faheem",
    startedAt: at(12, 5),
    kots: 8,
  },
  {
    id: "t7",
    number: 7,
    name: "Table 7",
    sectionId: "mezzanine",
    capacity: 4,
    status: "available",
    guests: 0,
    kots: 0,
  },
  {
    id: "t8",
    number: 8,
    name: "Table 8",
    sectionId: "aiwan",
    capacity: 10,
    status: "occupied",
    guests: 9,
    waiter: "Naveed",
    startedAt: at(13, 30),
    kots: 4,
  },
  {
    id: "t9",
    number: 9,
    name: "Table 9",
    sectionId: "aiwan",
    capacity: 6,
    status: "available",
    guests: 0,
    kots: 0,
  },
  {
    id: "t10",
    number: 10,
    name: "Table 10",
    sectionId: "aiwan",
    capacity: 6,
    status: "available",
    guests: 0,
    kots: 0,
  },
  {
    id: "t11",
    number: 11,
    name: "Table 11",
    sectionId: "dine-in",
    capacity: 4,
    status: "occupied",
    guests: 2,
    waiter: "Imran",
    startedAt: at(14, 2),
    kots: 2,
  },
  {
    id: "t12",
    number: 12,
    name: "Table 12",
    sectionId: "dine-in",
    capacity: 4,
    status: "available",
    guests: 0,
    kots: 0,
  },
];

export const INITIAL_ORDERS: Record<string, OrderLine[]> = {
  t1: [
    {
      id: "l1",
      itemId: "m1",
      name: "Mutton Biryani",
      variant: "Dum",
      qty: 2,
      unitPrice: 560,
      status: "on-table",
    },
    { id: "l2", itemId: "m13", name: "Rumali Roti", qty: 4, unitPrice: 30, status: "on-table" },
    {
      id: "l3",
      itemId: "m17",
      name: "Mineral Water 1L",
      qty: 2,
      unitPrice: 20,
      status: "on-table",
      mrp: true,
    },
  ],
  t3: [
    {
      id: "l4",
      itemId: "m2",
      name: "Chicken Biryani",
      variant: "Family Pack",
      qty: 1,
      unitPrice: 980,
      status: "on-table",
    },
    {
      id: "l5",
      itemId: "m9",
      name: "Chicken 65",
      variant: "Full",
      qty: 1,
      unitPrice: 290,
      status: "on-table",
    },
  ],
  t6: [
    {
      id: "l6",
      itemId: "m1",
      name: "Mutton Biryani",
      variant: "Family Pack",
      qty: 2,
      unitPrice: 1150,
      status: "on-table",
    },
    {
      id: "l7",
      itemId: "m4",
      name: "Mutton Marag",
      variant: "Regular",
      qty: 4,
      unitPrice: 180,
      status: "on-table",
    },
    { id: "l8", itemId: "m18", name: "Irani Chai", qty: 6, unitPrice: 40, status: "on-table" },
  ],
  t8: [
    {
      id: "l9",
      itemId: "m10",
      name: "Shadab Special Boti Kebab",
      qty: 3,
      unitPrice: 360,
      status: "on-table",
    },
    {
      id: "l10",
      itemId: "m15",
      name: "Butter Chicken",
      qty: 2,
      unitPrice: 380,
      status: "on-table",
    },
  ],
  t11: [
    {
      id: "l11",
      itemId: "m2",
      name: "Chicken Biryani",
      variant: "Regular",
      qty: 2,
      unitPrice: 400,
      status: "on-table",
    },
  ],
};

export const HOURLY_REVENUE = [
  { hour: "11a", revenue: 12400 },
  { hour: "12p", revenue: 38900 },
  { hour: "1p", revenue: 64200 },
  { hour: "2p", revenue: 71800 },
  { hour: "3p", revenue: 29500 },
  { hour: "4p", revenue: 16300 },
  { hour: "5p", revenue: 21100 },
  { hour: "6p", revenue: 34700 },
  { hour: "7p", revenue: 58900 },
  { hour: "8p", revenue: 82400 },
  { hour: "9p", revenue: 76500 },
  { hour: "10p", revenue: 45100 },
];

export const DISH_PERFORMANCE = [
  { name: "Mutton Biryani", value: 182400 },
  { name: "Chicken Biryani", value: 143900 },
  { name: "Chicken 65", value: 61200 },
  { name: "Boti Kebab", value: 48700 },
  { name: "Rumali Roti", value: 26300 },
];

export const WORST_DISHES = [
  { name: "Qubani Ka Meetha", value: 4200 },
  { name: "Fish Tikka", value: 5100 },
  { name: "Sweet Corn Soup", value: 6400 },
  { name: "Hara Bhara Kebab", value: 7300 },
  { name: "Dal Tadka", value: 9100 },
];

export const SECTION_REVENUE = [
  { sectionId: "dine-in", amount: 248900, bills: 142 },
  { sectionId: "aiwan", amount: 121400, bills: 38 },
  { sectionId: "mezzanine", amount: 92600, bills: 61 },
  { sectionId: "ac-takeaway", amount: 51200, bills: 88 },
  { sectionId: "ak-takeaway", amount: 27400, bills: 54 },
  { sectionId: "cafe", amount: 11323, bills: 96 },
];

export const DASHBOARD_TOTALS = {
  revenue: 552823,
  revenueChange: 8.4,
  taxes: 26325,
  service: 12140,
  rounded: 118,
  creditNotes: 3400,
  cash: 214300,
  cashChange: 4.2,
  card: 186200,
  cardChange: 11.7,
  upi: 152323,
  upiChange: -2.3,
  discounts: 18420,
  creditNotesOwed: 1200,
  expenses: 9600,
  sessions: 479,
  completed: 462,
  cancelled: 17,
  items: 3184,
};

export const RESERVATIONS: Reservation[] = [
  {
    id: "r1",
    guestName: "Arsalan Khan",
    phone: "98490 12345",
    partySize: 4,
    time: at(19, 30),
    sectionId: "dine-in",
    tableId: "t2",
    status: "booked",
  },
  {
    id: "r2",
    guestName: "Mehreen Fatima",
    phone: "90000 54321",
    partySize: 2,
    time: at(20, 0),
    sectionId: "mezzanine",
    status: "booked",
  },
  {
    id: "r3",
    guestName: "Ramesh Gupta",
    phone: "98850 77889",
    partySize: 10,
    time: at(13, 30),
    sectionId: "aiwan",
    tableId: "t8",
    status: "seated",
  },
  {
    id: "r4",
    guestName: "Sana Sheikh",
    phone: "97001 22110",
    partySize: 6,
    time: at(12, 0),
    sectionId: "dine-in",
    status: "no-show",
  },
];

export const STAFF: StaffMember[] = [
  {
    id: "st1",
    name: "Shabbir",
    phone: "98480 10001",
    roles: ["cashier", "outlet-manager"],
    assignment: "Main Counter",
    active: true,
  },
  {
    id: "st2",
    name: "Imran",
    phone: "98480 10002",
    roles: ["captain"],
    assignment: "Dine In",
    active: true,
  },
  {
    id: "st3",
    name: "Salman",
    phone: "98480 10003",
    roles: ["waiter"],
    assignment: "Dine In · T3, T4",
    active: true,
  },
  {
    id: "st4",
    name: "Faheem",
    phone: "98480 10004",
    roles: ["waiter"],
    assignment: "Mezzanine · T5–T7",
    active: true,
  },
  {
    id: "st5",
    name: "Naveed",
    phone: "98480 10005",
    roles: ["captain", "waiter"],
    assignment: "Aiwan-e-Khas",
    active: true,
  },
  {
    id: "st6",
    name: "Rizwan",
    phone: "98480 10006",
    roles: ["cashier"],
    assignment: "Parcel Counter",
    active: true,
  },
  {
    id: "st7",
    name: "Yousuf",
    phone: "98480 10007",
    roles: ["kitchen-manager"],
    assignment: "Main Kitchen",
    active: true,
  },
];

export const BILL_HISTORY: Bill[] = [
  {
    id: "b1",
    number: "SH-10241",
    unitId: "t1",
    unitName: "Table 1",
    sectionId: "dine-in",
    orderType: "dine-in",
    items: [
      {
        id: "bl1",
        itemId: "m1",
        name: "Mutton Biryani",
        variant: "Dum",
        qty: 2,
        unitPrice: 560,
        status: "on-table",
        served: true,
      },
      {
        id: "bl2",
        itemId: "m13",
        name: "Rumali Roti",
        qty: 4,
        unitPrice: 30,
        status: "on-table",
        served: true,
      },
      {
        id: "bl3",
        itemId: "m18",
        name: "Irani Chai",
        qty: 4,
        unitPrice: 40,
        status: "on-table",
        served: true,
      },
    ],
    subtotal: 1400,
    discount: 0,
    tax: 70,
    serviceCharge: 0,
    total: 1470,
    payments: [{ id: "p1", method: "upi", amount: 1470 }],
    status: "paid",
    cashier: "Shabbir",
    createdAt: at(12, 40),
    closedAt: at(13, 55),
  },
  {
    id: "b2",
    number: "SH-10242",
    unitId: "t8",
    unitName: "Table 8",
    sectionId: "aiwan",
    orderType: "dine-in",
    items: [
      {
        id: "bl4",
        itemId: "m1",
        name: "Mutton Biryani",
        variant: "Family Pack",
        qty: 2,
        unitPrice: 1150,
        status: "on-table",
        served: true,
      },
      {
        id: "bl5",
        itemId: "m10",
        name: "Shadab Special Boti Kebab",
        qty: 3,
        unitPrice: 360,
        status: "on-table",
        served: true,
      },
      {
        id: "bl6",
        itemId: "m15",
        name: "Butter Chicken",
        qty: 2,
        unitPrice: 380,
        status: "on-table",
        served: true,
      },
    ],
    subtotal: 4140,
    discount: 200,
    tax: 197,
    serviceCharge: 394,
    total: 4531,
    payments: [
      { id: "p2", method: "card", amount: 3000 },
      { id: "p3", method: "cash", amount: 1531 },
    ],
    status: "paid",
    cashier: "Shabbir",
    createdAt: at(13, 30),
    closedAt: at(15, 10),
  },
  {
    id: "b3",
    number: "SH-10244",
    unitId: "counter",
    unitName: "Parcel Counter",
    sectionId: "ac-takeaway",
    orderType: "takeaway",
    customer: "Ramesh · 98xxx",
    items: [
      {
        id: "bl7",
        itemId: "m2",
        name: "Chicken Biryani",
        variant: "Family Pack",
        qty: 1,
        unitPrice: 980,
        status: "on-table",
        served: true,
      },
      {
        id: "bl8",
        itemId: "m14",
        name: "Tandoori Roti",
        variant: "Butter",
        qty: 4,
        unitPrice: 35,
        status: "on-table",
        served: true,
      },
    ],
    subtotal: 1120,
    discount: 0,
    tax: 56,
    serviceCharge: 0,
    total: 1176,
    payments: [{ id: "p4", method: "cash", amount: 1176 }],
    status: "paid",
    cashier: "Rizwan",
    createdAt: at(14, 2),
    closedAt: at(14, 11),
  },
];

export const NOTIFICATIONS: AppNotification[] = [
  { id: "n1", message: "Table 5: Paneer Tikka (Half) is ready", at: at(15, 42), read: false },
  { id: "n2", message: "Bill requested for Table 3 — Dine In", at: at(15, 38), read: false },
  {
    id: "n3",
    message: "Takeaway order for Ramesh is ready for pickup",
    at: at(15, 20),
    read: true,
  },
];
