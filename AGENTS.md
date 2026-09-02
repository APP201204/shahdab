# RestaurantOS — Agent Notes

## Phase 0 — Running the skeleton

### Backend (ASP.NET Core 8)
```bash
cd backend
docker compose up --build -d
```
- API: http://localhost:5001
- Swagger UI: http://localhost:5001/swagger
- PostgreSQL: localhost:5432 (postgres / postgres)
- Seeded user: `shadab` / `Shadab123`

Port 5000 is avoided because macOS AirPlay uses it.

### Frontend (React 18 + Vite + Tailwind)
```bash
cd frontend
npm install
npm run dev
```
- Dev server: http://localhost:5173
- The Axios base URL falls back to `http://localhost:5001/api`. Copy `.env.example` to `.env` to override.

### Useful verification commands
```bash
# Login
curl -s -X POST http://localhost:5001/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"shadab","password":"Shadab123"}'

# Type-check / build frontend
npx tsc --noEmit
npm run build
```

### Project structure
- `backend/RestaurantOS.Api` — thin controllers, middleware
- `backend/RestaurantOS.Application` — services, DTOs, interfaces
- `backend/RestaurantOS.Domain` — entities
- `backend/RestaurantOS.Infrastructure` — EF Core, DbContext, migrations, seeder
- `frontend/src` — React app with shared layout, login, placeholder pages
