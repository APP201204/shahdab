# Shahdab — Project Guide for Agents

## Overview

Restaurant Management SaaS frontend. Single-tenant in the browser: all data lives in an in-memory mock store. No backend or real database integration.

## Source-of-truth documents

- `docs/workflow.md` — end-to-end business workflows and state machines.
- `docs/api_design_doc.md` — REST/WebSocket-style endpoint design and role permissions.
- `docs/db_schema.md` — full PostgreSQL schema that defines the entity model.
- `IMPLEMENTATION_TODO.md` — prioritized implementation backlog.
- `IMPLEMENTED.md` — live tracker of what is already built; update it after every meaningful edit.

## Technology stack

| Layer | Choice | Notes |
|---|---|---|
| Build tool | Vite 5 + React plugin | Project lives in `frontend/`. |
| Framework | React 18 + TypeScript 5.6 | Strict TS, `verbatimModuleSyntax` enabled. |
| Styling | Tailwind CSS 3.4 | shadcn/ui-style HSL color tokens in `src/index.css`. |
| UI components | shadcn/ui | Manually configured; the shadcn CLI did not auto-detect the Vite project. Use `src/components/ui/*`. |
| Icons | lucide-react | Standard icon set. |
| Routing | react-router-dom 6 | Route guards + default role-based redirects. |
| State | Zustand | `src/store/useAppStore.ts` for runtime state. |
| Forms/validation | react-hook-form + zod | To be wired on forms. |
| Dates | date-fns | Formatting and timezone helpers. |
| Charts | recharts | For analytics views. |
| Notifications | sonner | In-app toasts only; no browser push. |
| Mock API | `src/services/mockApi.ts` | Mirrors the API design endpoints against `src/mocks/db.ts`. |
| Real-time | `src/services/events.ts` | In-memory pub/sub event bus, not WebSocket. |

## Project conventions

- All code lives under `frontend/src/`.
- Absolute path alias is `@/*` → `./src/*`.
- In-memory database only; no localStorage/persistence required.
- Notifications are strictly in-app (toasts + feed). Real-time updates use the local event bus.
- Subscription plans are intentionally out of scope; organization setup is a simple form.
- Roles: `admin`, `outlet_manager`, `captain`, `waiter`, `kitchen_manager`, `cashier`.
- Build must pass before an edit is considered done: `npm run build`.
- After every meaningful edit, update `IMPLEMENTED.md` with what changed.

## Build and run

```bash
cd frontend
npm install
npm run dev      # development
npm run build    # type-check + production build
npm run preview  # preview production build
```
