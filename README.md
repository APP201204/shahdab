# Shahdab — Restaurant Management SaaS (Frontend Demo)

A single-tenant restaurant management frontend built with React 18, TypeScript, Vite, Tailwind CSS, and shadcn/ui. All data lives in an in-memory mock store; there is no backend or persistent database.

## Quick start

```bash
cd frontend
npm install
npm run dev
```

Open the URL shown by Vite (usually `http://localhost:5173`) and log in using any of the seeded staff accounts below.

## Build and test

```bash
cd frontend
npm run build    # TypeScript + Vite production build
npm run test     # Vitest unit tests
npm run preview  # Preview the production build
```

## Mock login credentials

The login screen lets you pick a staff member and an outlet. All seeded data is pre-linked to the `Shahdab Demo` organization.

| Staff | Phone | Role | Primary landing page |
|---|---|---|---|
| Rahul Sharma | +91-90000-00001 | Admin | `/setup` |
| Priya Patel | +91-90000-00002 | Outlet Manager | `/setup` |
| Amit Kumar | +91-90000-00003 | Captain | `/tables` |
| Sita Devi | +91-90000-00004 | Waiter | `/tables` (My Tables) |
| Vikram Rao | +91-90000-00005 | Kitchen Manager | Kitchen ticket board |
| Neha Gupta | +91-90000-00006 | Cashier | `/billing` |

### Outlets

- Mumbai Central
- Delhi NCR

## Feature highlights

- Role-based login and permission guards
- Table management, reservations, and floor grid
- Dine-in and takeaway order flow with KOT batches
- Kitchen ticket board with item state machine
- Billing queue, bill builder, splits, payments, and reprint
- Stock-out toggles and in-app notifications
- Staff and outlet setup, menu builder, tax settings
- Analytics dashboard and audit log

## Architecture notes

- All code lives under `frontend/src/`.
- Absolute imports use the `@/*` path alias.
- Runtime state is managed with Zustand; auth state is in `AuthContext`.
- Real-time updates are simulated through the `events.ts` in-memory pub/sub bus.
- API endpoints are mirrored in `src/services/mockApi.ts` and backed by `src/mocks/db.ts`.

## Scope and known limitations

- Subscription plans and SaaS billing are intentionally out of scope.
- Notifications are in-app only; there is no browser push or WebSocket.
- Real-time table status and kitchen tickets are simulated locally.
- Live transfer of in-progress orders is not supported.
- Order item comping after serving is not supported; cancellation is allowed only while an item is `placed` or `accepted`.
- Tax/discount ordering assumes discount is applied before tax on the discounted amount, because the exact precedence was unspecified.
- Tables do not auto-release to `vacant`; a user must confirm cleaning.
- Print receipt layout is a simple printable modal.
