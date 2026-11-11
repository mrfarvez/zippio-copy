# Zippio Architecture

This document describes the current implementation and the boundaries to preserve when extending Zippio.

## 1. System overview

```text
Browser
  |
  | React UI (Vite)
  | src/main.jsx -> src/services/api.js
  v
Express API (:4000)
  |
  | helmet, CORS, JSON parser, request ID
  | JWT authentication and role authorization
  | Zod request validation
  v
PostgreSQL
  |
  +-- core workflow tables
  +-- history/event tables
  +-- audit and governance tables
```

The frontend is a single-page React application. It calls the API through the small client in `src/services/api.js`; the browser should not access PostgreSQL directly. The API owns authorization, validation, organization scoping, state transitions, and persistence.

## 2. Runtime components

### Frontend

- `src/main.jsx` contains the current application shell, role-based screens, data loading, and user actions.
- `src/services/api.js` is the integration boundary for HTTP requests.
- `src/styles.css` contains the visual system and responsive layout rules.
- Access and refresh tokens are kept in `sessionStorage` by the current client.
- When an access token expires, the API client attempts one refresh request and retries the original request.

### Backend

- `server/index.js` starts the HTTP server and closes the PostgreSQL pool on shutdown.
- `server/app.js` defines routes, Zod schemas, database queries, response shaping, and audit calls.
- `server/middleware.js` adds request IDs, verifies access tokens, and enforces roles.
- `server/config.js` validates environment variables at startup and exits on invalid configuration.
- `server/security/auth.js` issues/verifies JWTs and hashes refresh tokens.
- `server/security/password.js` owns password hashing and verification.

### Database

- `server/db/pool.js` creates the PostgreSQL connection pool.
- `server/db/migrate.js` applies each SQL file once and records it in `schema_migrations`.
- `001_initial.sql` contains identity, employee, task, HR, attendance, leave, points, attachments, and audit foundations.
- `002_full_workflow.sql` adds memberships, permissions, workflow history, comments, leave management, performance, notifications, support, privacy, and retention tables.

## 3. Request lifecycle

1. The browser calls a method in `src/services/api.js`.
2. The client adds `Content-Type` and, when available, a Bearer access token.
3. Express applies security headers, CORS, JSON parsing, and a request ID.
4. Public routes handle health and authentication. Protected routes run `requireAuth`.
5. Sensitive mutations additionally run `requireRole(...)`.
6. The route validates request data with a local Zod schema.
7. SQL queries use parameterized values and filter by `request.auth.organizationId`.
8. Mutations record an audit event where applicable.
9. The route maps database rows to the frontend response shape.
10. Errors are passed to the shared Express error handler at the end of `server/app.js`.

## 4. Authentication and authorization

The login flow is:

```text
credentials
  -> POST /api/auth/login
  -> password verification
  -> short-lived access JWT + refresh token
  -> sessionStorage in browser
```

The access token contains the user ID (`sub`), organization ID, and role. Refresh tokens are stored hashed in `refresh_tokens`; the raw refresh token is only returned to the client.

Current roles:

- **employee:** personal work, attendance, leave submissions, delegation requests
- **manager:** team tasks, reviews, delegation approvals, HR actions, reports
- **hr:** HR operations, reviews, leave/performance administration, reports

Authorization must remain server-side. UI visibility is only a usability feature, not a security boundary. Every new query must preserve organization isolation, and every new mutation must define its allowed roles.

## 5. Domain model

```text
Organization
  ├── Users -> Roles
  ├── Departments -> Employees -> Users
  ├── Tasks
  │     ├── Task reviews
  │     ├── Dynamic KPI result
  │     ├── Delegation requests
  │     ├── Attachments
  │     └── Status history
  ├── HR requests -> Comments + Status events
  ├── Attendance records
  ├── Leave requests -> Types + Balances + Approvals
  ├── Performance cycles -> Employee scores
  ├── Notifications
  ├── Support tickets
  ├── Privacy requests
  └── Audit events + Retention policies
```

Attendance is persisted in `attendance_records` with one unique row per employee and work date. A new employee session starts with `check_in` empty; `POST /api/attendance/check-in` creates the row and `POST /api/attendance/check-out` fills `check_out`. The API rejects duplicate same-day check-ins and does not expose a checkout action until a check-in exists.

Use UUID primary keys for database relationships. Use organization-scoped human-readable codes such as `ZP-101` and `HR-101` only for display and external references.

### Task KPI scoring

`tasks.created_at` is the server-generated task start time. `tasks.deadline` is a UTC `timestamptz` and is rendered in the user's locale/UI timezone. `hours` is workload metadata only; it does not directly affect the score.

`server/kpi.js` calculates a live provisional result for pending tasks and a final result after approval:

- Priority maps to base points: Low 10, Medium 15, High 20, Critical 30.
- Early completion receives 5%, 10%, 15%, or 20% for at least 1, 2, 3, or 4 days early.
- Late work loses 10% per full 24-hour period after the deadline.
- The late rate is capped at 150%, while the score is floored at negative 50% of base points.
- A task becomes overdue immediately after its deadline, but its first full-day penalty applies after 24 hours.

Migration `003_dynamic_kpi_tasks.sql` adds the deadline timestamp, description/reference fields, submission/completion timestamps, and persisted final KPI metadata.

## 6. State and history rules

The primary entity stores its current state for fast reads. History tables store immutable transitions and comments:

- `task_status_history`
- `delegation_request_events`
- `hr_request_events`
- `hr_request_comments`
- `leave_approvals`
- `audit_events`

When adding a state-changing workflow:

1. Validate the target state and actor role.
2. Update the primary record.
3. Insert the corresponding history/event row.
4. Write an audit event for security-relevant changes.
5. Keep these writes in one database transaction when partial success would be harmful.

## 7. API conventions

- Prefix routes with `/api`.
- Use plural nouns for collections.
- Use `POST` for creation/actions, `PATCH` for partial state changes, and `PUT` for replacing a score/resource snapshot.
- Return JSON for both success and error responses.
- Use `400` for invalid request data, `401` for missing/invalid authentication, `403` for insufficient role permission, `404` for missing resources, and `500` for unexpected server errors.
- Validate all client-controlled input with Zod before querying.
- Use parameterized PostgreSQL queries; never concatenate user input into SQL.
- Keep frontend-specific row conversion in a response mapper such as `taskView` or `employeeView`.

## 8. File uploads

Task attachments currently use Multer memory storage and are persisted in `task_attachments` as PostgreSQL `bytea`. The API limits uploads to 10 MB and allows a small MIME type allowlist.

Before scaling uploads, move content to object storage and keep only metadata plus a storage key in PostgreSQL. Preserve organization and task authorization checks for both upload and download.

## 9. Database change process

Create a new migration instead of editing an already-applied migration:

```text
server/db/migrations/003_feature_name.sql
```

Guidelines:

- Make migrations safe to apply once and record them through `schema_migrations`.
- Add indexes for common organization/status/foreign-key access patterns.
- Add constraints for valid states, dates, scores, and ownership.
- Backfill existing rows before making a new column non-null.
- Update `server/db/seed.js` if local workflows need sample records.
- Keep schema changes and route changes compatible during deployment.

## 10. Recommended future structure

`server/app.js` is currently the route and service layer in one file. As the API grows, split by domain without changing the external API:

```text
server/
  app.js
  routes/
    auth.js
    tasks.js
    hrRequests.js
    people.js
    performance.js
  services/
  repositories/
  schemas/
  security/
  db/
```

Prefer extracting shared query helpers and transaction boundaries before adding duplicate route logic. Keep response-shape mapping close to the API boundary so the UI is not coupled to raw database column names.

## 11. Testing priorities

The next implementation milestone should add:

1. Authentication and refresh-token tests.
2. Organization-isolation tests for every collection endpoint.
3. Role matrix tests for each mutation.
4. State-transition tests, including invalid transitions.
5. Migration and seed smoke tests.
6. Frontend tests for loading, API failure, token refresh, and mutation feedback.
7. End-to-end tests for manager, employee, and HR happy paths.

The most important invariant is that a valid token from one organization can never read or mutate another organization's records.
