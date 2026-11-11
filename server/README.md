# Zippio API

## Run locally

1. Create a local PostgreSQL database and least-privilege user:

   ```sql
   CREATE USER zippio_app WITH PASSWORD 'use-a-local-password';
   CREATE DATABASE zippio OWNER zippio_app;
   ```

2. Copy `.env.example` to `.env` and set `DATABASE_URL` plus two random secrets of at least 32 characters.
3. Run `npm run db:migrate` and then `npm run db:seed`.
4. Run `npm run server` in one terminal.
5. Run `npm run dev` in another terminal.

For local development, `npm run dev:full` starts both the API and Vite frontend together. The login screen requires the API on `http://localhost:4000`; if the API is not running, login cannot be completed.

Development seed accounts use the password `password`; replace them before any shared or production deployment.

The API listens on `http://localhost:4000` by default. The frontend reads the API base URL from `VITE_API_URL`.

## Endpoints

- `GET /api/health`
- `POST /api/auth/login`
- `GET /api/employees`
- `GET /api/employees/:id`
- `GET /api/tasks`
- `POST /api/tasks`
- `PATCH /api/tasks/:id`
- `GET /api/hr-requests`
- `GET /api/hr-requests/:id`
- `POST /api/hr-requests`
- `PATCH /api/hr-requests/:id`
- `GET /api/hr-requests/:id/comments`
- `POST /api/hr-requests/:id/comments`
- `GET /api/tasks/:id/reviews`
- `POST /api/tasks/:id/reviews`
- `GET /api/delegations`
- `POST /api/delegations`
- `PATCH /api/delegations/:id`
- `POST /api/auth/refresh`
- `POST /api/auth/logout`
- `GET /api/attendance`
- `POST /api/attendance/check-in`
- `POST /api/attendance/check-out`
- `GET /api/leave-requests`
- `POST /api/leave-requests`
- `GET /api/leave-types`
- `GET /api/leave-balances/:employeeId`
- `PATCH /api/leave-requests/:id`
- `GET /api/performance/:employeeId`
- `GET /api/performance/cycles`
- `POST /api/performance/cycles`
- `PUT /api/performance/cycles/:cycleId/employees/:employeeId`
- `GET /api/reports/summary`
- `GET /api/privacy/requests`
- `POST /api/privacy/requests`
- `PATCH /api/privacy/requests/:id`
- `POST /api/tasks/:id/attachment`
- `GET /api/tasks/:id/attachment`

The API uses PostgreSQL. All tenant-owned queries scope records by the authenticated user's organization. The base schema is in `server/db/migrations/001_initial.sql`; the complete workflow schema is added by `server/db/migrations/002_full_workflow.sql`.

The complete schema covers organization membership and permissions, task status/review/delegation history, dynamic priority/deadline KPI metadata, HR comments and status history, leave types/balances/approvals, performance cycles and score history, notifications, support tickets, privacy requests, retention policies, audit events, and reporting indexes. `npm run db:migrate` applies all migrations transactionally.
