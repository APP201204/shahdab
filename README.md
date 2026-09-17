# SHADAB RestaurantOS

A restaurant management system with a Fastify + PostgreSQL backend and a TanStack Start + React frontend, with realtime updates over Socket.IO.

## Project structure

```
shahdab/
├── backend/          # Fastify API, Drizzle ORM, Socket.IO (port 4000)
├── frontend/         # TanStack Start + React + Tailwind (port 8080)
└── docker-compose.yml
```

## Prerequisites

- Node.js 18+ (npm or [bun](https://bun.sh))

No Docker required — PostgreSQL runs embedded via
[`embedded-postgres`](https://www.npmjs.com/package/embedded-postgres).

## Quick start

### 1. Start PostgreSQL

```sh
cd backend
npm install
npm run db:start
```

This starts an embedded PostgreSQL on `localhost:55432` with database
`restaurantos` (user `postgres`, password `postgres`). Data is persisted in
`backend/.pgdata`. Keep this terminal open; press Ctrl+C to stop the DB.

### 2. Set up the backend

In a second terminal, create `backend/.env`:

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:55432/restaurantos
PORT=4000
JWT_SECRET=change-this-in-production
FRONTEND_URL=http://localhost:8080
```

Run migrations and seed the database:

```sh
cd backend
npm run db:push
npm run db:seed
```

The seed creates the SHADAB outlet, sections, menu items, tables, and staff.
All seeded staff log in with password `password` (see `src/db/seed-data.ts`
for staff phone numbers — login is phone + password).

Start the API:

```sh
npm run dev
```

The API runs at `http://localhost:4000` (health check: `/health`, routes under `/api/v1`).

### 3. Set up the frontend

```sh
cd frontend
npm install
```

Create `frontend/.env` (see `.env.example`):

```env
VITE_API_URL=http://localhost:4000/api/v1
```

Start the dev server:

```sh
npm run dev
```

The app runs at `http://localhost:8080`.

## Alternative: run with Docker

If you have Docker installed, `docker compose up --build` starts PostgreSQL and
the backend API together (Postgres on `localhost:5432` — set `DATABASE_URL`
accordingly). Run the frontend locally as described above.

## Useful commands

### Backend (`cd backend`)

| Command              | Description                        |
| -------------------- | ---------------------------------- |
| `npm run db:start`   | Start embedded PostgreSQL          |
| `npm run dev`        | Start dev server (tsx, hot reload) |
| `npm run build`      | Compile TypeScript                 |
| `npm run db:generate`| Generate Drizzle migrations        |
| `npm run db:migrate` | Apply migrations                   |
| `npm run db:push`    | Push schema directly to the DB     |
| `npm run db:seed`    | Seed the database                  |
| `npm test`           | Run tests (vitest)                 |

### Frontend (`cd frontend`)

| Command          | Description       |
| ---------------- | ----------------- |
| `npm run dev`    | Start dev server  |
| `npm run build`  | Production build  |
| `npm run lint`   | ESLint            |
| `npm run format` | Prettier          |

## Environment variables

### Backend (`backend/.env`)

| Variable        | Default                                         | Description                     |
| --------------- | ----------------------------------------------- | ------------------------------- |
| `DATABASE_URL`  | `postgresql://localhost:55432/restaurantos`     | PostgreSQL connection string    |
| `PORT`          | `4000`                                          | API port                        |
| `JWT_SECRET`    | `dev-secret`                                    | Secret for auth tokens          |
| `FRONTEND_URL`  | `http://localhost:5173`                         | CORS origin for the frontend    |

### Frontend (`frontend/.env`)

| Variable       | Default                            | Description        |
| -------------- | ---------------------------------- | ------------------ |
| `VITE_API_URL` | `http://localhost:4000/api/v1`     | Backend API base   |

## Troubleshooting

- **CORS errors**: make sure `FRONTEND_URL` in `backend/.env` matches the URL
  the frontend dev server is actually running on (check the terminal output —
  it is `8080` for this project, not Vite's usual `5173`).
- **Login fails**: verify you ran `npm run db:seed`, and log in with a seeded
  staff phone number and password `password`.
- **DB connection refused**: confirm `npm run db:start` is running in its own
  terminal and `DATABASE_URL` points at `localhost:55432`.
