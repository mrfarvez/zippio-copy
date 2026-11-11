# Zippio 2.0

Zippio is a workforce and HR operations platform. It combines task management, employee performance, HR requests, attendance, leave, delegation, reporting, privacy requests, and audit history in one workspace.

The project currently contains:

- A React 18 + Vite frontend
- An Express 4 API
- PostgreSQL persistence with ordered migrations
- JWT access/refresh-token authentication
- Role-based access for `manager`, `employee`, and `hr`
- Organization-scoped data access

## Requirements

- Node.js 18+
- npm
- PostgreSQL 14+ (with the `pgcrypto` extension)

## Local setup

### 1. Install dependencies

```bash
npm install
```

### 2. Create the database

As a PostgreSQL administrator, create a local application user and database:

```sql
CREATE USER zippio_app WITH PASSWORD 'use-a-local-password';
CREATE DATABASE zippio OWNER zippio_app;
```

### 3. Configure environment variables

Create a `.env` file in the project root:

```env
NODE_ENV=development
PORT=4000
CORS_ORIGIN=http://localhost:5173
DATABASE_URL=postgresql://zippio_app:use-a-local-password@localhost:5432/zippio
JWT_ACCESS_SECRET=replace-with-at-least-32-random-characters
JWT_REFRESH_SECRET=replace-with-at-least-32-random-characters
JWT_ACCESS_TTL=15m
JWT_REFRESH_TTL_DAYS=30
```

Never commit `.env` or real secrets.

### 4. Apply schema and seed development data

```bash
npm run db:migrate
npm run db:seed
```

Migrations are applied from `server/db/migrations/` in filename order. The seed command is safe to rerun for the development dataset.

### 5. Run the application

Run the API and frontend separately:

```bash
npm run server
npm run dev
```

Or run both together:

```bash
npm run dev:full
```

- Frontend: `http://localhost:5173`
- API: `http://localhost:4000`
- Health check: `http://localhost:4000/api/health`

The frontend reads the API base URL from `VITE_API_URL`. For another API host, set `VITE_API_URL` before starting Vite.

## Development accounts

The seed creates these demo accounts, all with the password `password`:

| Role | Email |
| --- | --- |
| Manager | `manager@zippio.com` |
| Employee | `rahim@zippio.com` |
| Employee | `nusrat@zippio.com` |
| Employee | `imran@zippio.com` |
| HR | `hr@zippio.com` |

These credentials are for local development only. Replace them before any shared or production deployment.

## Available scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the Vite frontend |
| `npm run server` | Start the Express API |
| `npm run dev:full` | Start frontend and API together |
| `npm run db:migrate` | Apply pending PostgreSQL migrations |
| `npm run db:seed` | Insert or update development seed data |
| `npm run build` | Create the production frontend build |
| `npm run preview` | Preview the production frontend build |

## Product areas

- **Authentication:** login, refresh, logout, password hashing, and session storage
- **Tasks:** assignment, status transitions, reviews, delegation, GitHub links, attachments, and dynamic priority/deadline KPI scoring
- **HR requests:** request creation, assignment, progress, comments, and history
- **People operations:** employees, attendance, leave types, balances, approvals, and performance cycles
- **Reporting:** manager/HR summary metrics
- **Privacy and governance:** privacy requests, retention policies, audit events, and organization isolation

## API overview

All application endpoints are under `/api`. Protected endpoints require:

```http
Authorization: Bearer <access-token>
```

Main endpoint groups:

- `/auth`
- `/employees`
- `/tasks`
- `/hr-requests`
- `/delegations`
- `/attendance`
- `/leave-requests`
- `/leave-types`
- `/leave-balances`
- `/performance`
- `/reports`
- `/privacy/requests`

The complete endpoint list is maintained in [server/README.md](server/README.md).

## Project structure

```text
src/
  main.jsx             React application and UI state
  styles.css           Global styles
  services/api.js      API client and token refresh logic
server/
  app.js               Express app, validation, routes, and response mapping
  index.js             HTTP server startup and graceful shutdown
  middleware.js        Request IDs, authentication, and role checks
  security/            Password and JWT helpers
  db/                  Pool, migrations, setup, and seed data
scripts/
  dev-full.js          Runs frontend and API together
```

See [ARCHITECTURE.md](ARCHITECTURE.md) before adding a new workflow or changing the data model.

## Dynamic task KPI

Task KPI is calculated on the server from priority-based base points and the deadline. The task creation timestamp is the immutable server start time; estimated hours only measure workload and do not directly change the KPI.

- Low: 10 base points
- Medium: 15 base points
- High: 20 base points
- Critical: 30 base points

Early completion earns up to a 20% bonus. Late completion loses 10% per full 24-hour period, with a maximum penalty of 150% and a score floor of -50% of base points. Tasks that remain pending expose a live provisional overdue score. The final score is stored when a manager or HR reviewer approves the submission.

## Adding a feature

1. Define or update the database model in a new ordered migration.
2. Add validation and a protected route in `server/app.js`.
3. Enforce organization and role scope in the server; do not rely on the frontend for authorization.
4. Add the corresponding method to `src/services/api.js`.
5. Connect loading, mutation, and error states in `src/main.jsx`.
6. Update API documentation and seed data when the feature needs a reproducible demo.
7. Run `npm run build` and manually verify the affected role workflows.

## Production checklist

- Use strong, unique JWT secrets and database credentials.
- Replace all seed passwords and remove demo accounts where appropriate.
- Use a production `CORS_ORIGIN`.
- Serve the frontend and API over HTTPS.
- Configure PostgreSQL backups and migration execution.
- Move file attachments to durable object storage when scaling beyond a single API instance.
- Add automated API and end-to-end tests before enabling new workflows for real users.
