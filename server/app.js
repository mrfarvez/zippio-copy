import cors from "cors";
import express from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import multer from "multer";
import { z } from "zod";
import { config } from "./config.js";
import { pool } from "./db/pool.js";
import { requestContext, requireAuth, requireRole } from "./middleware.js";
import { hashToken, issueAccessToken, issueRefreshToken } from "./security/auth.js";
import { hashPassword, verifyPassword } from "./security/password.js";
import { calculateKpiScore, defaultPointsForPriority } from "./kpi.js";

const app = express();
const loginLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: config.NODE_ENV === "production" ? 20 : 1000,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
});
const loginSchema = z.object({
  email: z.string().email().optional(),
  password: z.string().min(8),
  role: z.enum(["manager", "employee", "hr"]).optional(),
  userId: z.string().optional(),
}).refine((value) => value.email || value.role && value.userId, { message: "Email or role/account is required" });
const taskSchema = z.object({
  title: z.string().trim().min(1).max(200),
  employeeId: z.string().min(1),
  priority: z.enum(["Low", "Medium", "High", "Critical"]),
  hours: z.coerce.number().positive().max(10_000),
  points: z.coerce.number().int().nonnegative().max(100_000).optional(),
  deadline: z.string().datetime(),
  description: z.string().max(10_000).optional(),
  note: z.string().max(10_000).optional(),
  githubRepo: z.string().url().max(500).optional().or(z.literal("")),
  additionalReferenceUrl: z.string().url().max(500).optional().or(z.literal("")),
});
const hrSchema = z.object({
  requirement: z.string().trim().min(1).max(200),
  department: z.string().trim().min(1).max(100),
  type: z.string().trim().min(1).max(100),
  priority: z.enum(["Low", "Medium", "High"]),
  deadline: z.string().optional(),
  details: z.string().trim().min(1).max(10_000),
});
const delegationSchema = z.object({
  parentTaskId: z.string().min(1),
  employeeId: z.string().min(1),
  title: z.string().trim().min(1).max(200),
  details: z.string().trim().min(1).max(10_000),
});
const reviewSchema = z.object({
  approved: z.boolean(),
  pointsAwarded: z.coerce.number().int().nonnegative().max(100_000).default(0),
  note: z.string().max(10_000).optional(),
});
const hrUpdateSchema = z.object({
  status: z.enum(["Pending approval", "In progress", "Completed", "Rejected"]).optional(),
  progress: z.coerce.number().int().min(0).max(100).optional(),
  officerId: z.string().optional(),
  note: z.string().max(10_000).optional(),
}).strict();
const commentSchema = z.object({ body: z.string().trim().min(1).max(10_000) });
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 }, fileFilter: (_request, file, callback) => callback(null, /^(application\/pdf|image\/(png|jpeg)|application\/zip|text\/plain|application\/msword|application\/vnd.openxmlformats-officedocument.wordprocessingml.document|application\/vnd.ms-excel|application\/vnd.openxmlformats-officedocument.spreadsheetml.sheet)$/.test(file.mimetype)) });

app.use(helmet());
const configuredOrigins = config.CORS_ORIGIN.split(",").map((item) => item.trim()).filter(Boolean);
const configuredOrigin = configuredOrigins.length ? new URL(configuredOrigins[0]) : null;
const isAllowedOrigin = (origin) => {
  if (!origin) return true;
  if (configuredOrigins.includes(origin)) return true;
  if (config.NODE_ENV !== "production") {
    try {
      const requestOrigin = new URL(origin);
      return ["localhost", "127.0.0.1"].includes(requestOrigin.hostname)
        && configuredOrigin && requestOrigin.protocol === configuredOrigin.protocol
        && requestOrigin.port >= "5173" && requestOrigin.port <= "5199";
    } catch {
      return false;
    }
  }
  return false;
};
app.use(cors({ origin: (origin, callback) => callback(null, isAllowedOrigin(origin)) }));
app.use(express.json({ limit: "1mb" }));
app.use(requestContext);

function validation(schema, request, response) {
  const parsed = schema.safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({ message: "Invalid request data", issues: parsed.error.issues.map((issue) => ({ path: issue.path, message: issue.message })) });
    return null;
  }
  return parsed.data;
}

function employeeView(row) {
  const status = row.status === "on_leave" ? "On leave" : row.status === "inactive" ? "Inactive" : "Active";
  return { ...row, id: row.employee_code || row.id, initials: row.initials || row.name.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase(), points: Number(row.points), scores: row.scores || [0, 0, 0, 0, 0], status, activity: [], attendance: [] };
}

function taskView(row) {
  const kpi = row.kpi_score !== null && row.kpi_score !== undefined
    ? { score: Number(row.kpi_score), bonusRate: Number(row.kpi_bonus_rate), penaltyRate: Number(row.kpi_penalty_rate), lateDays: row.kpi_late_days, overdue: row.kpi_status === "overdue" || row.kpi_status === "late", scoringStatus: row.kpi_status }
    : calculateKpiScore({ basePoints: Number(row.points), deadline: row.deadline, submittedAt: row.submitted_at });
  return { ...row, id: row.task_code, employeeId: row.employee_code || row.employee_id, startedAt: row.started_at, taskCreatedAt: row.created_at, parentTaskId: row.parent_task_code || row.parent_task_id, reviewerId: row.reviewer_code || row.reviewer_id, githubRepo: row.github_repo, additionalReferenceUrl: row.additional_reference_url, attachmentName: row.attachment_name, description: row.description || row.note, hours: Number(row.hours), points: Number(row.points), deadline: row.deadline, submittedAt: row.submitted_at, completedAt: row.completed_at, kpi };
}

async function audit(request, action, entityType, entityId, metadata = {}) {
  await pool.query(
    "INSERT INTO audit_events (organization_id, actor_user_id, action, entity_type, entity_id, request_id, metadata) VALUES ($1, $2, $3, $4, $5, $6, $7)",
    [request.auth?.organizationId || null, request.auth?.sub || null, action, entityType, entityId || null, request.requestId, JSON.stringify(metadata)],
  );
}

app.get("/api/health", async (_request, response, next) => {
  try {
    await pool.query("SELECT 1");
    response.json({ status: "ok", service: "zippio-api", database: "ok", timestamp: new Date().toISOString() });
  } catch (error) { next(error); }
});

app.post("/api/auth/login", loginLimit, async (request, response, next) => {
  try {
    const input = validation(loginSchema, request, response);
    if (!input) return;
    let result;
    if (input.email) {
      result = await pool.query(
        `SELECT u.*, r.name AS role, pc.password_hash, e.title AS job_title, e.employee_code
         FROM users u JOIN roles r ON r.id = u.role_id
         JOIN password_credentials pc ON pc.user_id = u.id
         LEFT JOIN employees e ON e.user_id = u.id
         WHERE lower(u.email) = lower($1) AND u.status = 'active'`,
        [input.email],
      );
      if (!result.rowCount || !(await verifyPassword(input.password, result.rows[0].password_hash))) return response.status(401).json({ message: "Invalid email or password" });
    } else {
      result = await pool.query(
        `SELECT u.*, r.name AS role, pc.password_hash, e.title AS job_title, e.employee_code FROM users u JOIN roles r ON r.id = u.role_id
         JOIN password_credentials pc ON pc.user_id = u.id
         LEFT JOIN employees e ON e.user_id = u.id
         WHERE (u.id::text = $1 OR e.employee_code = $1) AND r.name = $2 AND u.status = 'active'`,
        [input.userId, input.role],
      );
      if (!result.rowCount || !(await verifyPassword(input.password, result.rows[0].password_hash))) return response.status(401).json({ message: "Invalid account or password" });
    }
    const user = result.rows[0];
    const refresh = issueRefreshToken();
    await pool.query("INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, now() + ($3 || ' days')::interval)", [user.id, hashToken(refresh), config.JWT_REFRESH_TTL_DAYS]);
    await audit({ auth: { organizationId: user.organization_id, sub: user.id }, requestId: request.requestId }, "auth.login", "user", user.id);
    response.json({ token: issueAccessToken(user), refreshToken: refresh, user: { id: user.id, role: user.role, userId: user.role === "employee" && user.employee_code ? user.employee_code : user.id, organizationId: user.organization_id, displayName: user.display_name, jobTitle: user.job_title || null } });
  } catch (error) { next(error); }
});

app.post("/api/auth/refresh", loginLimit, async (request, response, next) => {
  try {
    const refresh = z.string().min(20).safeParse(request.body?.refreshToken);
    if (!refresh.success) return response.status(401).json({ message: "Invalid refresh token" });
    const result = await pool.query(
      `SELECT rt.id, u.*, r.name AS role FROM refresh_tokens rt
       JOIN users u ON u.id = rt.user_id JOIN roles r ON r.id = u.role_id
       WHERE rt.token_hash = $1 AND rt.revoked_at IS NULL AND rt.expires_at > now() AND u.status = 'active'`,
      [hashToken(refresh.data)],
    );
    if (!result.rowCount) return response.status(401).json({ message: "Invalid or expired refresh token" });
    const replacement = issueRefreshToken();
    const replacementHash = hashToken(replacement);
    const inserted = await pool.query("INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, now() + ($3 || ' days')::interval) RETURNING id", [result.rows[0].id, replacementHash, config.JWT_REFRESH_TTL_DAYS]);
    await pool.query("UPDATE refresh_tokens SET revoked_at = now(), replaced_by = $1 WHERE id = $2", [inserted.rows[0].id, result.rows[0].id]);
    response.json({ token: issueAccessToken(result.rows[0]), refreshToken: replacement });
  } catch (error) { next(error); }
});

app.post("/api/auth/logout", requireAuth, async (request, response, next) => {
  try {
    if (request.body?.refreshToken) await pool.query("UPDATE refresh_tokens SET revoked_at = now() WHERE token_hash = $1 AND user_id = $2", [hashToken(request.body.refreshToken), request.auth.sub]);
    response.status(204).end();
  } catch (error) { next(error); }
});

app.get("/api/auth/employees", async (_request, response, next) => {
  try {
    const result = await pool.query(
      `SELECT e.employee_code AS id, e.name FROM employees e
       JOIN users u ON u.id = e.user_id
       JOIN roles r ON r.id = u.role_id
       WHERE e.organization_id = (SELECT id FROM organizations ORDER BY created_at LIMIT 1)
         AND u.status = 'active' AND r.name = 'employee'
       ORDER BY e.name`,
    );
    response.json(result.rows);
  } catch (error) { next(error); }
});

app.get("/api/employees", requireAuth, async (request, response, next) => {
  try {
    const result = await pool.query(
      `SELECT e.id, e.user_id, e.employee_code, e.name, upper(left(e.name, 1) || left(split_part(e.name, ' ', 2), 1)) AS initials,
       e.title, e.email, d.name AS department, e.points, e.scores, e.status
       FROM employees e LEFT JOIN departments d ON d.id = e.department_id
       WHERE e.organization_id = $1 ORDER BY e.name`,
      [request.auth.organizationId],
    );
    response.json(result.rows.map(employeeView));
  } catch (error) { next(error); }
});

app.get("/api/employees/:id", requireAuth, async (request, response, next) => {
  try {
    const result = await pool.query("SELECT e.*, d.name AS department FROM employees e LEFT JOIN departments d ON d.id = e.department_id WHERE (e.id::text = $1 OR e.employee_code = $1) AND e.organization_id = $2", [request.params.id, request.auth.organizationId]);
    if (!result.rowCount) return response.status(404).json({ message: "Employee not found" });
    response.json(employeeView(result.rows[0]));
  } catch (error) { next(error); }
});

app.post("/api/employees", requireAuth, requireRole("hr"), async (request, response, next) => {
  const schema = z.object({
    name: z.string().trim().min(2).max(120),
    email: z.string().email().max(200),
    password: z.string().min(8).max(200),
    employeeCode: z.string().trim().min(1).max(40).optional(),
    title: z.enum(["Employee", "Manager", "Team lead"]).default("Employee"),
    department: z.string().trim().min(1).max(100).optional(),
    status: z.enum(["active", "on_leave", "inactive"]).default("active"),
  });
  const input = validation(schema, request, response);
  if (!input) return;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const roleName = input.title === "Manager" || input.title === "Team lead" ? "manager" : "employee";
    const role = await client.query("SELECT id FROM roles WHERE organization_id = $1 AND name = $2", [request.auth.organizationId, roleName]);
    if (!role.rowCount) { await client.query("ROLLBACK"); return response.status(409).json({ message: `${roleName} role is not configured for this organization` }); }
    let departmentId = null;
    if (input.department) {
      const department = await client.query(
        `INSERT INTO departments (organization_id, name) VALUES ($1, $2)
         ON CONFLICT (organization_id, name) DO UPDATE SET name = EXCLUDED.name
         RETURNING id`,
        [request.auth.organizationId, input.department],
      );
      departmentId = department.rows[0].id;
    }
    let employeeCode = input.employeeCode;
    if (!employeeCode) {
      const nextCode = await client.query(
        `SELECT COALESCE(MAX(substring(employee_code from 2)::int), 0) + 1 AS next
         FROM employees WHERE organization_id = $1 AND employee_code ~ '^e[0-9]+$'`,
        [request.auth.organizationId],
      );
      employeeCode = `e${Number(nextCode.rows[0].next)}`;
    }
    const user = await client.query(
      `INSERT INTO users (organization_id, email, display_name, role_id, status)
       VALUES ($1, lower($2), $3, $4, $5)
       RETURNING id`,
      [request.auth.organizationId, input.email, input.name, role.rows[0].id, input.status === "inactive" ? "suspended" : "active"],
    );
    await client.query("INSERT INTO password_credentials (user_id, password_hash) VALUES ($1, $2)", [user.rows[0].id, await hashPassword(input.password)]);
    const employee = await client.query(
      `INSERT INTO employees (organization_id, user_id, department_id, employee_code, name, title, email, points, scores, status, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, lower($7), 0, '[0,0,0,0,0]'::jsonb, $8, $9)
       RETURNING id`,
      [request.auth.organizationId, user.rows[0].id, departmentId, employeeCode, input.name, input.title, input.email, input.status, request.auth.sub],
    );
    await client.query(
      `INSERT INTO organization_members (organization_id, user_id, employee_id) VALUES ($1, $2, $3)
       ON CONFLICT (organization_id, user_id) DO UPDATE SET employee_id = EXCLUDED.employee_id`,
      [request.auth.organizationId, user.rows[0].id, employee.rows[0].id],
    );
    await client.query(
      `INSERT INTO leave_balances (organization_id, employee_id, leave_type_id, year, entitled_days)
       SELECT $1, $2, lt.id, extract(year from current_date), lt.annual_days
       FROM leave_types lt WHERE lt.organization_id = $1
       ON CONFLICT (employee_id, leave_type_id, year) DO NOTHING`,
      [request.auth.organizationId, employee.rows[0].id],
    );
    await client.query("COMMIT");
    await audit(request, "employee.created", "employee", employee.rows[0].id, { email: input.email, employeeCode, title: input.title, role: roleName });
    const created = await pool.query(
      `SELECT e.id, e.employee_code, e.name, upper(left(e.name, 1) || left(split_part(e.name, ' ', 2), 1)) AS initials,
       e.title, e.email, d.name AS department, e.points, e.scores, e.status
       FROM employees e LEFT JOIN departments d ON d.id = e.department_id
       WHERE e.id = $1`,
      [employee.rows[0].id],
    );
    response.status(201).json(employeeView(created.rows[0]));
  } catch (error) {
    await client.query("ROLLBACK");
    if (error.code === "23505") {
      const detail = String(error.detail || "");
      const message = detail.includes("email") ? "An account or employee with this email already exists." : detail.includes("employee_code") ? "This employee code is already in use." : "This employee profile already exists.";
      return response.status(409).json({ message });
    }
    next(error);
  } finally {
    client.release();
  }
});

app.get("/api/tasks", requireAuth, async (request, response, next) => {
  try {
    const values = [request.auth.organizationId];
    let ownerFilter = "";
    if (request.auth.role === "employee") { values.push(request.auth.sub); ownerFilter = " AND (e.user_id = $2 OR reviewer.user_id = $2)"; }
    const result = await pool.query(
      `SELECT t.*, e.employee_code, parent.task_code AS parent_task_code, reviewer.employee_code AS reviewer_code FROM tasks t JOIN employees e ON e.id = t.employee_id LEFT JOIN tasks parent ON parent.id = t.parent_task_id LEFT JOIN employees reviewer ON reviewer.id = t.reviewer_id WHERE t.organization_id = $1${ownerFilter} ORDER BY t.deadline, t.created_at`,
      values,
    );
    response.json(result.rows.map(taskView));
  } catch (error) { next(error); }
});

app.post("/api/tasks", requireAuth, requireRole("manager", "hr"), async (request, response, next) => {
  try {
    const input = validation(taskSchema, request, response);
    if (!input) return;
    const result = await pool.query(
      `INSERT INTO tasks (organization_id, task_code, title, employee_id, priority, hours, points, deadline, description, note, github_repo, additional_reference_url)
       SELECT $1, 'ZP-' || ((SELECT coalesce(max(substring(task_code from 4)::int), 100) + 1 FROM tasks WHERE organization_id = $1)), $2, e.id, $3, $4, coalesce($5::integer, $11::integer), $6, $7, $7, nullif($8, ''), nullif($9, '')
       FROM employees e WHERE (e.id::text = $10 OR e.employee_code = $10) AND e.organization_id = $1
       RETURNING *`,
      [request.auth.organizationId, input.title, input.priority, input.hours, input.points ?? defaultPointsForPriority(input.priority), input.deadline, input.description || input.note || null, input.githubRepo || "", input.additionalReferenceUrl || "", input.employeeId, defaultPointsForPriority(input.priority)],
    );
    if (!result.rowCount) return response.status(400).json({ message: "Assigned employee was not found" });
    await audit(request, "task.created", "task", result.rows[0].id, { taskCode: result.rows[0].task_code });
    const task = await pool.query(
      `SELECT t.*, e.employee_code, parent.task_code AS parent_task_code, reviewer.employee_code AS reviewer_code
       FROM tasks t JOIN employees e ON e.id = t.employee_id
       LEFT JOIN tasks parent ON parent.id = t.parent_task_id
       LEFT JOIN employees reviewer ON reviewer.id = t.reviewer_id
       WHERE t.id = $1`,
      [result.rows[0].id],
    );
    response.status(201).json(taskView(task.rows[0]));
  } catch (error) { next(error); }
});

app.patch("/api/tasks/:id", requireAuth, async (request, response, next) => {
  try {
    const allowed = z.object({ status: z.enum(["todo", "progress", "review", "handoff", "approved"]).optional(), note: z.string().max(10_000).optional(), description: z.string().max(10_000).optional(), startedAt: z.string().datetime().optional(), githubRepo: z.string().url().max(500).optional().or(z.literal("")), additionalReferenceUrl: z.string().url().max(500).optional().or(z.literal("")), attachmentName: z.string().max(255).optional() }).strict();
    const input = validation(allowed, request, response);
    if (!input) return;
    const previous = input.status
      ? await pool.query("SELECT id, status FROM tasks WHERE task_code = $1 AND organization_id = $2", [request.params.id, request.auth.organizationId])
      : null;
    const result = await pool.query(
      `UPDATE tasks SET status = coalesce($3, status), note = coalesce($4, note), description = coalesce($5, description), started_at = coalesce($6::timestamptz, started_at), submitted_at = CASE WHEN $3 = 'review' THEN now() WHEN $3 = 'progress' THEN NULL ELSE submitted_at END, github_repo = coalesce(nullif($7, ''), github_repo), additional_reference_url = coalesce(nullif($8, ''), additional_reference_url), attachment_name = coalesce($9, attachment_name), updated_at = now()
       WHERE task_code = $1 AND organization_id = $2
       ${request.auth.role === "employee" ? "AND employee_id IN (SELECT id FROM employees WHERE user_id = $10)" : ""}
       RETURNING *`,
      [request.params.id, request.auth.organizationId, input.status || null, input.note || null, input.description || null, input.startedAt || null, input.githubRepo || "", input.additionalReferenceUrl || "", input.attachmentName || null, request.auth.sub],
    );
    if (!result.rowCount) return response.status(404).json({ message: "Task not found" });
    if (input.status) {
      await pool.query(
        `INSERT INTO task_status_history (organization_id, task_id, actor_user_id, from_status, to_status, note)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [request.auth.organizationId, result.rows[0].id, request.auth.sub, previous?.rows[0]?.status || null, input.status, input.note || null],
      );
    }
    await audit(request, "task.updated", "task", result.rows[0].id, { fields: Object.keys(input) });
    response.json(taskView(result.rows[0]));
  } catch (error) { next(error); }
});

app.post("/api/tasks/:id/attachment", requireAuth, upload.single("file"), async (request, response, next) => {
  const client = await pool.connect();
  try {
    if (!request.file) return response.status(400).json({ message: "A supported attachment is required" });
    await client.query("BEGIN");
    const task = await client.query(
      `SELECT id FROM tasks
       WHERE task_code = $1 AND organization_id = $2
       ${request.auth.role === "employee" ? "AND employee_id IN (SELECT id FROM employees WHERE user_id = $3)" : ""}`,
      request.auth.role === "employee"
        ? [request.params.id, request.auth.organizationId, request.auth.sub]
        : [request.params.id, request.auth.organizationId],
    );
    if (!task.rowCount) {
      await client.query("ROLLBACK");
      return response.status(404).json({ message: "Task not found" });
    }
    const result = await client.query(
      `INSERT INTO task_attachments (organization_id, task_id, file_name, content_type, size_bytes, content)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, file_name, content_type, size_bytes, created_at`,
      [request.auth.organizationId, task.rows[0].id, request.file.originalname, request.file.mimetype, request.file.size, request.file.buffer],
    );
    await client.query(
      "UPDATE tasks SET attachment_name = $2, updated_at = now() WHERE id = $1 AND organization_id = $3",
      [task.rows[0].id, request.file.originalname, request.auth.organizationId],
    );
    await client.query("COMMIT");
    await audit(request, "task.attachment_uploaded", "task", result.rows[0].id, { fileName: request.file.originalname, sizeBytes: request.file.size });
    response.status(201).json(result.rows[0]);
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    next(error);
  }
  finally { client.release(); }
});

app.get("/api/tasks/:id/attachment", requireAuth, async (request, response, next) => {
  try {
    const result = await pool.query(
      `SELECT a.file_name, a.content_type, a.content, a.size_bytes FROM task_attachments a
       JOIN tasks t ON t.id = a.task_id
       WHERE t.task_code = $1 AND t.organization_id = $2 ORDER BY a.created_at DESC LIMIT 1`,
      [request.params.id, request.auth.organizationId],
    );
    if (!result.rowCount) return response.status(404).json({ message: "Attachment not found" });
    response.type(result.rows[0].content_type).setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(result.rows[0].file_name)}"`);
    response.send(result.rows[0].content);
  } catch (error) { next(error); }
});

app.get("/api/hr-requests", requireAuth, async (request, response, next) => {
  try {
    const result = await pool.query(
      `SELECT r.*, d.name AS department, d.manager_name AS manager,
        requester.display_name AS requester,
        coalesce(officer.display_name, 'Unassigned') AS officer,
        (SELECT count(*)::int FROM hr_request_comments c WHERE c.hr_request_id = r.id) AS comments
       FROM hr_requests r LEFT JOIN departments d ON d.id = r.department_id
       LEFT JOIN users requester ON requester.id = r.requester_id
       LEFT JOIN users officer ON officer.id = r.officer_id
       WHERE r.organization_id = $1 ORDER BY r.created_at DESC`,
      [request.auth.organizationId],
    );
    response.json(result.rows.map((row) => ({ ...row, id: row.request_code })));
  } catch (error) { next(error); }
});

app.get("/api/hr-requests/:id", requireAuth, async (request, response, next) => {
  try {
    const result = await pool.query(
      `SELECT r.*, d.name AS department, d.manager_name AS manager,
        requester.display_name AS requester,
        coalesce(officer.display_name, 'Unassigned') AS officer,
        (SELECT count(*)::int FROM hr_request_comments c WHERE c.hr_request_id = r.id) AS comments
       FROM hr_requests r LEFT JOIN departments d ON d.id = r.department_id
       LEFT JOIN users requester ON requester.id = r.requester_id
       LEFT JOIN users officer ON officer.id = r.officer_id
       WHERE r.request_code = $1 AND r.organization_id = $2`,
      [request.params.id, request.auth.organizationId],
    );
    if (!result.rowCount) return response.status(404).json({ message: "HR request not found" });
    response.json({ ...result.rows[0], id: result.rows[0].request_code });
  } catch (error) { next(error); }
});

app.post("/api/hr-requests", requireAuth, requireRole("hr", "manager"), async (request, response, next) => {
  try {
    const input = validation(hrSchema, request, response);
    if (!input) return;
    const result = await pool.query(
      `INSERT INTO hr_requests (organization_id, request_code, department_id, requirement, type, priority, deadline, details, requester_id, officer_id)
       SELECT $1, 'HR-' || ((SELECT coalesce(max(substring(request_code from 4)::int), 100) + 1 FROM hr_requests WHERE organization_id = $1)), d.id, $2, $3, $4, nullif($5, '')::date, $6, $7,
       (SELECT u.id FROM users u WHERE u.organization_id = $1 AND lower(u.display_name) = lower(d.manager_name) ORDER BY u.created_at LIMIT 1)
       FROM departments d WHERE d.name = $8 AND d.organization_id = $1 RETURNING *`,
      [request.auth.organizationId, input.requirement, input.type, input.priority, input.deadline || "", input.details, request.auth.sub, input.department],
    );
    if (!result.rowCount) return response.status(400).json({ message: "Department was not found" });
    await audit(request, "hr_request.created", "hr_request", result.rows[0].id, { requestCode: result.rows[0].request_code });
    response.status(201).json({ ...result.rows[0], id: result.rows[0].request_code, department: input.department });
  } catch (error) { next(error); }
});

app.patch("/api/hr-requests/:id", requireAuth, requireRole("hr", "manager"), async (request, response, next) => {
  try {
    const input = validation(hrUpdateSchema, request, response);
    if (!input) return;
    const previous = await pool.query("SELECT * FROM hr_requests WHERE request_code = $1 AND organization_id = $2", [request.params.id, request.auth.organizationId]);
    if (!previous.rowCount) return response.status(404).json({ message: "HR request not found" });
    const result = await pool.query(
      `UPDATE hr_requests SET status = coalesce($3, status), progress = coalesce($4, progress),
       officer_id = coalesce($5::uuid, officer_id), updated_at = now()
       WHERE request_code = $1 AND organization_id = $2 RETURNING *`,
      [request.params.id, request.auth.organizationId, input.status || null, input.progress ?? null, input.officerId || null],
    );
    await pool.query(
      `INSERT INTO hr_request_events (organization_id, hr_request_id, actor_user_id, from_status, to_status, progress, note)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [request.auth.organizationId, result.rows[0].id, request.auth.sub, previous.rows[0].status, result.rows[0].status, result.rows[0].progress, input.note || null],
    );
    await audit(request, "hr_request.updated", "hr_request", result.rows[0].id, { fields: Object.keys(input) });
      response.json({ ...result.rows[0], id: result.rows[0].request_code });
  } catch (error) { next(error); }
});

app.get("/api/hr-requests/:id/comments", requireAuth, async (request, response, next) => {
  try {
    const result = await pool.query(
      `SELECT c.id, c.body, c.created_at, u.display_name AS author
       FROM hr_request_comments c JOIN hr_requests r ON r.id = c.hr_request_id
       JOIN users u ON u.id = c.author_user_id
       WHERE r.request_code = $1 AND r.organization_id = $2 ORDER BY c.created_at`,
      [request.params.id, request.auth.organizationId],
    );
    response.json(result.rows);
  } catch (error) { next(error); }
});

app.post("/api/hr-requests/:id/comments", requireAuth, async (request, response, next) => {
  try {
    const input = validation(commentSchema, request, response);
    if (!input) return;
    const result = await pool.query(
      `INSERT INTO hr_request_comments (organization_id, hr_request_id, author_user_id, body)
       SELECT $1, id, $2, $3 FROM hr_requests WHERE request_code = $4 AND organization_id = $1
       RETURNING id, body, created_at`,
      [request.auth.organizationId, request.auth.sub, input.body, request.params.id],
    );
    if (!result.rowCount) return response.status(404).json({ message: "HR request not found" });
    response.status(201).json({ ...result.rows[0], author: request.auth.displayName });
  } catch (error) { next(error); }
});

app.get("/api/support/tickets", requireAuth, async (request, response, next) => {
  try {
    const result = await pool.query(
      `SELECT t.*, requester.display_name AS requester, assignee.display_name AS assignee
       FROM support_tickets t
       JOIN users requester ON requester.id = t.requester_id
       LEFT JOIN users assignee ON assignee.id = t.assignee_id
       WHERE t.organization_id = $1 AND ($2 <> 'employee' OR t.requester_id = $3)
       ORDER BY CASE t.status WHEN 'open' THEN 0 WHEN 'in_progress' THEN 1 ELSE 2 END, t.updated_at DESC`,
      [request.auth.organizationId, request.auth.role, request.auth.sub],
    );
    response.json(result.rows.map((row) => ({ ...row, id: row.ticket_code })));
  } catch (error) { next(error); }
});

app.post("/api/support/tickets", requireAuth, async (request, response, next) => {
  try {
    const input = validation(z.object({
      subject: z.string().trim().min(1).max(200),
      description: z.string().trim().min(1).max(10_000),
      priority: z.enum(["Low", "Medium", "High", "Critical"]).default("Medium"),
    }), request, response);
    if (!input) return;
    const result = await pool.query(
      `INSERT INTO support_tickets (organization_id, ticket_code, requester_id, subject, description, priority)
       VALUES ($1, 'SUP-' || (coalesce((SELECT max(substring(ticket_code from 5)::int) FROM support_tickets WHERE organization_id = $1), 0) + 1), $2, $3, $4, $5)
       RETURNING *`,
      [request.auth.organizationId, request.auth.sub, input.subject, input.description, input.priority],
    );
    await audit(request, "support_ticket.created", "support_ticket", result.rows[0].id);
    response.status(201).json({ ...result.rows[0], id: result.rows[0].ticket_code });
  } catch (error) { next(error); }
});

app.patch("/api/support/tickets/:id", requireAuth, requireRole("hr", "manager"), async (request, response, next) => {
  try {
    const input = validation(z.object({ status: z.enum(["open", "in_progress", "resolved", "closed"]) }), request, response);
    if (!input) return;
    const result = await pool.query(
      `UPDATE support_tickets SET status = $3, updated_at = now()
       WHERE ticket_code = $1 AND organization_id = $2 RETURNING *`,
      [request.params.id, request.auth.organizationId, input.status],
    );
    if (!result.rowCount) return response.status(404).json({ message: "Support ticket not found" });
    await audit(request, "support_ticket.updated", "support_ticket", result.rows[0].id, { status: input.status });
    response.json({ ...result.rows[0], id: result.rows[0].ticket_code });
  } catch (error) { next(error); }
});

app.post("/api/tasks/:id/reviews", requireAuth, requireRole("manager", "hr"), async (request, response, next) => {
  const client = await pool.connect();
  try {
    const input = validation(reviewSchema, request, response);
    if (!input) return client.release();
    await client.query("BEGIN");
    const task = await client.query("SELECT * FROM tasks WHERE task_code = $1 AND organization_id = $2 FOR UPDATE", [request.params.id, request.auth.organizationId]);
    if (!task.rowCount) {
      await client.query("ROLLBACK");
      return response.status(404).json({ message: "Task not found" });
    }
    const approved = input.approved;
    if (approved && task.rows[0].status === "approved") {
      await client.query("ROLLBACK");
      return response.status(409).json({ message: "Task has already been approved" });
    }
    const points = approved ? calculateKpiScore({ basePoints: Number(task.rows[0].points), deadline: task.rows[0].deadline, submittedAt: task.rows[0].submitted_at || new Date() }).score : 0;
    const review = await client.query(
      `INSERT INTO task_reviews (organization_id, task_id, reviewer_id, approved, points_awarded, note)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [request.auth.organizationId, task.rows[0].id, request.auth.sub, approved, points, input.note || null],
    );
    const kpi = approved ? calculateKpiScore({ basePoints: Number(task.rows[0].points), deadline: task.rows[0].deadline, submittedAt: task.rows[0].submitted_at || new Date() }) : null;
    await client.query(
      `UPDATE tasks SET status = $3, completed_at = CASE WHEN $3 = 'approved' THEN now() ELSE completed_at END,
       kpi_score = $4, kpi_bonus_rate = $5, kpi_penalty_rate = $6, kpi_late_days = $7,
       kpi_status = $8, updated_at = now() WHERE id = $1 AND organization_id = $2`,
      [task.rows[0].id, request.auth.organizationId, approved ? "approved" : "progress", kpi?.score || null, kpi?.bonusRate || 0, kpi?.penaltyRate || 0, kpi?.lateDays || 0, kpi?.scoringStatus || "pending"],
    );
    await client.query(
      `INSERT INTO task_status_history (organization_id, task_id, actor_user_id, from_status, to_status, note)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [request.auth.organizationId, task.rows[0].id, request.auth.sub, task.rows[0].status, approved ? "approved" : "progress", input.note || null],
    );
    if (approved && points > 0) {
      await client.query("INSERT INTO point_ledger (organization_id, employee_id, task_id, value, reason) VALUES ($1, $2, $3, $4, $5)", [request.auth.organizationId, task.rows[0].employee_id, task.rows[0].id, points, `Approved task ${task.rows[0].task_code}`]);
      await client.query("UPDATE employees SET points = points + $2, updated_at = now() WHERE id = $1", [task.rows[0].employee_id, points]);
    }
    if (approved) {
      const scores = await client.query(
        `WITH stats AS (
           SELECT
             count(*) FILTER (WHERE status = 'approved') AS approved_count,
             count(*) AS assigned_count,
             coalesce(sum(points) FILTER (WHERE status = 'approved'), 0) AS approved_points,
             coalesce(sum(points), 0) AS assigned_points,
             count(*) FILTER (WHERE status = 'approved' AND kpi_status IN ('early', 'on_time')) AS on_time_count,
             coalesce(avg(least(100, greatest(0, 100.0 * kpi_score / nullif(points, 0)))) FILTER (WHERE status = 'approved' AND kpi_score IS NOT NULL AND points > 0), 0) AS quality_rate
           FROM tasks WHERE employee_id = $1 AND organization_id = $2
         )
         SELECT
           round(50 + 50 * least(1, greatest(0, approved_points::numeric / nullif(assigned_points, 0)))) AS productivity,
           round(50 + 50 * least(1, greatest(0, quality_rate / 100))) AS quality,
           round(50 + 50 * least(1, greatest(0, on_time_count::numeric / nullif(approved_count, 0)))) AS efficiency,
           round(50 + 50 * least(1, greatest(0, approved_count::numeric / nullif(assigned_count, 0)))) AS reliability,
           round(50 + 50 * least(1, greatest(0, approved_count::numeric / 10))) AS consistency
         FROM stats`,
        [task.rows[0].employee_id, request.auth.organizationId],
      );
      const row = scores.rows[0];
      await client.query(
        "UPDATE employees SET scores = jsonb_build_array($2::numeric, $3::numeric, $4::numeric, $5::numeric, $6::numeric), updated_at = now() WHERE id = $1",
        [task.rows[0].employee_id, row.productivity, row.quality, row.efficiency, row.reliability, row.consistency],
      );
    }
    await client.query("COMMIT");
    await audit(request, approved ? "task.approved" : "task.revision_requested", "task", task.rows[0].id, { points });
    response.status(201).json({ ...review.rows[0], kpi });
  } catch (error) {
    await client.query("ROLLBACK");
    next(error);
  } finally { client.release(); }
});

app.get("/api/tasks/:id/reviews", requireAuth, async (request, response, next) => {
  try {
    const result = await pool.query(
      `SELECT r.*, u.display_name AS reviewer FROM task_reviews r JOIN tasks t ON t.id = r.task_id
       JOIN users u ON u.id = r.reviewer_id WHERE t.task_code = $1 AND t.organization_id = $2 ORDER BY r.created_at DESC`,
      [request.params.id, request.auth.organizationId],
    );
    response.json(result.rows);
  } catch (error) { next(error); }
});

app.post("/api/delegations", requireAuth, requireRole("employee"), async (request, response, next) => {
  try {
    const input = validation(delegationSchema, request, response);
    if (!input) return;
    const result = await pool.query(
      `WITH source AS (
        SELECT t.id, t.points, e.id AS from_employee_id FROM tasks t JOIN employees e ON e.id = t.employee_id
        WHERE t.task_code = $1 AND t.organization_id = $2 AND e.user_id = $3
          AND t.status IN ('todo', 'progress') AND t.parent_task_id IS NULL
      ), target AS (SELECT id FROM employees WHERE (id::text = $4 OR employee_code = $4) AND organization_id = $2)
      INSERT INTO delegation_requests (organization_id, request_code, parent_task_id, from_employee_id, to_employee_id, title, details)
      SELECT $2, 'DG-' || (coalesce((SELECT max(substring(request_code from 4)::int) FROM delegation_requests WHERE organization_id = $2), 100) + 1), source.id, source.from_employee_id, target.id, $5, $6
      FROM source CROSS JOIN target
      WHERE target.id <> source.from_employee_id
      RETURNING *`,
      [input.parentTaskId, request.auth.organizationId, request.auth.sub, input.employeeId, input.title, input.details],
    );
    if (!result.rowCount) return response.status(400).json({ message: "Task or target employee was not found" });
    await pool.query("INSERT INTO delegation_request_events (organization_id, delegation_request_id, actor_user_id, action) VALUES ($1, $2, $3, 'created')", [request.auth.organizationId, result.rows[0].id, request.auth.sub]);
    await pool.query("UPDATE tasks SET status = 'progress', updated_at = now() WHERE id = $1 AND organization_id = $2 AND status = 'todo'", [result.rows[0].parent_task_id, request.auth.organizationId]);
    response.status(201).json({ ...result.rows[0], id: result.rows[0].request_code, parentTaskId: input.parentTaskId, fromEmployeeId: request.auth.sub, toEmployeeId: input.employeeId });
  } catch (error) { next(error); }
});

app.get("/api/delegations", requireAuth, async (request, response, next) => {
  try {
    const result = await pool.query(
      `SELECT d.*, parent.task_code AS parent_task_code, parent.points AS parent_points, from_e.employee_code AS from_employee_code, to_e.employee_code AS to_employee_code
       FROM delegation_requests d JOIN employees from_e ON from_e.id = d.from_employee_id
       JOIN employees to_e ON to_e.id = d.to_employee_id
       JOIN tasks parent ON parent.id = d.parent_task_id
       WHERE d.organization_id = $1 AND ($2 <> 'employee' OR from_e.user_id = $3 OR to_e.user_id = $3)
       ORDER BY d.created_at DESC`,
      [request.auth.organizationId, request.auth.role, request.auth.sub],
    );
    response.json(result.rows.map((row) => ({ ...row, id: row.request_code, parentTaskId: row.parent_task_code || row.parent_task_id, fromEmployeeId: row.from_employee_code, toEmployeeId: row.to_employee_code, parentPoints: Number(row.points || row.parent_points || 1) })));
  } catch (error) { next(error); }
});

app.patch("/api/delegations/:id", requireAuth, requireRole("manager", "hr"), async (request, response, next) => {
  try {
    const input = z.object({ status: z.enum(["approved", "rejected"]), points: z.coerce.number().int().positive().optional() }).safeParse(request.body);
    if (!input.success) return response.status(400).json({ message: "Status and valid points are required" });
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const current = await client.query(
        `SELECT d.*, parent.points AS parent_points
         FROM delegation_requests d JOIN tasks parent ON parent.id = d.parent_task_id
         WHERE d.request_code = $1 AND d.organization_id = $2 FOR UPDATE`,
        [request.params.id, request.auth.organizationId],
      );
      if (!current.rowCount) { await client.query("ROLLBACK"); return response.status(404).json({ message: "Delegation request not found" }); }
      const requestRow = current.rows[0];
      if (requestRow.status !== "pending") {
        await client.query("ROLLBACK");
        return response.status(409).json({ message: "Delegation request has already been reviewed" });
      }
      const points = input.data.points || requestRow.points || requestRow.parent_points || 1;
      const updated = await client.query("UPDATE delegation_requests SET status = $3, points = $4 WHERE id = $1 AND organization_id = $2 RETURNING *", [requestRow.id, request.auth.organizationId, input.data.status, points]);
      if (input.data.status === "approved") {
        await client.query(
          `INSERT INTO tasks (organization_id, task_code, title, employee_id, priority, hours, points, deadline, status, note, parent_task_id, reviewer_id)
           SELECT d.organization_id, 'ST-' || (coalesce((SELECT max(substring(task_code from 4)::int) FROM tasks WHERE organization_id = $1), 100) + 1),
           d.title, d.to_employee_id, 'Medium', 2, $2, parent.deadline, 'todo', d.details, d.parent_task_id, d.from_employee_id
           FROM delegation_requests d JOIN tasks parent ON parent.id = d.parent_task_id WHERE d.id = $3`,
          [request.auth.organizationId, points, requestRow.id],
        );
      }
      await client.query("INSERT INTO delegation_request_events (organization_id, delegation_request_id, actor_user_id, action) VALUES ($1, $2, $3, $4)", [request.auth.organizationId, requestRow.id, request.auth.sub, input.data.status]);
      await client.query("COMMIT");
      response.json({ ...updated.rows[0], id: updated.rows[0].request_code });
    } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
  } catch (error) { next(error); }
});

app.get("/api/attendance", requireAuth, async (request, response, next) => {
  try {
    const result = await pool.query(
      `SELECT a.id, a.organization_id, a.employee_id, a.work_date::text AS work_date, a.check_in, a.check_out, a.status, e.employee_code FROM attendance_records a
       JOIN employees e ON e.id = a.employee_id
       WHERE a.organization_id = $1 AND ($2 <> 'employee' OR e.user_id = $3)
       ORDER BY a.work_date DESC`,
      [request.auth.organizationId, request.auth.role, request.auth.sub],
    );
    response.json(result.rows);
  } catch (error) { next(error); }
});

app.post("/api/attendance/check-in", requireAuth, requireRole("employee"), async (request, response, next) => {
  try {
    const result = await pool.query(
      `INSERT INTO attendance_records (organization_id, employee_id, work_date, check_in, status)
       SELECT $1, e.id, current_date, now(), 'Present' FROM employees e
       WHERE e.user_id = $2 AND e.organization_id = $1
       ON CONFLICT (employee_id, work_date) DO NOTHING
       RETURNING id, organization_id, employee_id, work_date::text AS work_date, check_in, check_out, status`,
      [request.auth.organizationId, request.auth.sub],
    );
    if (!result.rowCount) {
      const employee = await pool.query("SELECT 1 FROM employees WHERE user_id = $1 AND organization_id = $2", [request.auth.sub, request.auth.organizationId]);
      return response.status(employee.rowCount ? 409 : 404).json({ message: employee.rowCount ? "Attendance is already recorded for today" : "Employee profile not found" });
    }
    await audit(request, "attendance.checked_in", "attendance_record", result.rows[0].id);
    response.status(201).json(result.rows[0]);
  } catch (error) { next(error); }
});

app.post("/api/attendance/check-out", requireAuth, requireRole("employee"), async (request, response, next) => {
  try {
    const result = await pool.query(
      `UPDATE attendance_records SET check_out = now()
       WHERE organization_id = $1 AND employee_id = (SELECT id FROM employees WHERE user_id = $2 AND organization_id = $1)
       AND work_date = current_date AND check_in IS NOT NULL AND check_out IS NULL
       RETURNING id, organization_id, employee_id, work_date::text AS work_date, check_in, check_out, status`,
      [request.auth.organizationId, request.auth.sub],
    );
    if (!result.rowCount) return response.status(409).json({ message: "No active attendance session found" });
    await audit(request, "attendance.checked_out", "attendance_record", result.rows[0].id);
    response.json(result.rows[0]);
  } catch (error) { next(error); }
});

app.get("/api/leave-requests", requireAuth, async (request, response, next) => {
  try {
    const result = await pool.query(
      `SELECT l.*, e.employee_code, e.name AS employee_name, lt.name AS leave_type
       FROM leave_requests l JOIN employees e ON e.id = l.employee_id
       LEFT JOIN leave_types lt ON lt.id = l.leave_type_id
       WHERE l.organization_id = $1 AND ($2 <> 'employee' OR e.user_id = $3) ORDER BY l.created_at DESC`,
      [request.auth.organizationId, request.auth.role, request.auth.sub],
    );
    response.json(result.rows);
  } catch (error) { next(error); }
});

app.post("/api/leave-requests", requireAuth, requireRole("employee"), async (request, response, next) => {
  try {
    const schema = z.object({ startDate: z.string().date(), endDate: z.string().date(), reason: z.string().trim().min(1).max(5_000), leaveTypeId: z.string().uuid().optional() }).refine((value) => value.endDate >= value.startDate, { message: "End date must be on or after start date", path: ["endDate"] });
    const input = validation(schema, request, response);
    if (!input) return;
    const result = await pool.query(
      `INSERT INTO leave_requests (organization_id, employee_id, leave_type_id, start_date, end_date, reason)
       SELECT $1, e.id, $6::uuid, $3, $4, $5 FROM employees e
       WHERE e.user_id = $2 AND e.organization_id = $1
       AND NOT EXISTS (SELECT 1 FROM leave_requests existing WHERE existing.employee_id = e.id AND existing.status <> 'Rejected' AND existing.start_date <= $4 AND existing.end_date >= $3)
       RETURNING *`,
      [request.auth.organizationId, request.auth.sub, input.startDate, input.endDate, input.reason, input.leaveTypeId || null],
    );
    if (!result.rowCount) return response.status(404).json({ message: "Employee profile not found" });
    await audit(request, "leave.created", "leave_request", result.rows[0].id);
    response.status(201).json(result.rows[0]);
  } catch (error) { next(error); }
});

app.get("/api/leave-types", requireAuth, async (request, response, next) => {
  try {
    const result = await pool.query("SELECT id, name, annual_days AS \"annualDays\", requires_approval AS \"requiresApproval\" FROM leave_types WHERE organization_id = $1 ORDER BY name", [request.auth.organizationId]);
    response.json(result.rows);
  } catch (error) { next(error); }
});

app.get("/api/leave-balances/:employeeId", requireAuth, async (request, response, next) => {
  try {
    const result = await pool.query(
      `SELECT b.*, lt.name, lt.annual_days AS "annualDays" FROM leave_balances b JOIN leave_types lt ON lt.id = b.leave_type_id
       JOIN employees e ON e.id = b.employee_id WHERE b.organization_id = $1 AND (e.employee_code = $2 OR e.id::text = $2) AND ($3 <> 'employee' OR e.user_id = $4) AND b.year = extract(year from current_date)`,
      [request.auth.organizationId, request.params.employeeId, request.auth.role, request.auth.sub],
    );
    response.json(result.rows);
  } catch (error) { next(error); }
});

app.patch("/api/leave-requests/:id", requireAuth, requireRole("manager", "hr"), async (request, response, next) => {
  try {
    const input = z.object({ status: z.enum(["Approved", "Rejected"]), note: z.string().max(5_000).optional() }).safeParse(request.body);
    if (!input.success) return response.status(400).json({ message: "A valid approval decision is required" });
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const current = await client.query("SELECT * FROM leave_requests WHERE id::text = $1 AND organization_id = $2 FOR UPDATE", [request.params.id, request.auth.organizationId]);
      if (!current.rowCount) { await client.query("ROLLBACK"); return response.status(404).json({ message: "Leave request not found" }); }
      const leave = current.rows[0];
      if (leave.status !== "Pending approval") { await client.query("ROLLBACK"); return response.status(409).json({ message: "Leave request was already reviewed" }); }
      const updated = await client.query("UPDATE leave_requests SET status = $3, approved_by = $4, reviewed_at = now(), review_note = $5 WHERE id = $1 AND organization_id = $2 RETURNING *", [leave.id, request.auth.organizationId, input.data.status, request.auth.sub, input.data.note || null]);
      await client.query("INSERT INTO leave_approvals (organization_id, leave_request_id, reviewer_user_id, decision, note) VALUES ($1, $2, $3, $4, $5)", [request.auth.organizationId, leave.id, request.auth.sub, input.data.status.toLowerCase(), input.data.note || null]);
      if (input.data.status === "Approved" && leave.leave_type_id) {
        const days = Math.floor((new Date(leave.end_date) - new Date(leave.start_date)) / 86400000) + 1;
        await client.query("UPDATE leave_balances SET used_days = used_days + $4 WHERE organization_id = $1 AND employee_id = $2 AND leave_type_id = $3 AND year = extract(year from $5::date)", [request.auth.organizationId, leave.employee_id, leave.leave_type_id, days, leave.start_date]);
      }
      await client.query("COMMIT");
      await audit(request, `leave.${input.data.status.toLowerCase()}`, "leave_request", leave.id);
      response.json(updated.rows[0]);
    } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
  } catch (error) { next(error); }
});

app.get("/api/performance/cycles", requireAuth, async (request, response, next) => {
  try {
    const result = await pool.query("SELECT * FROM performance_cycles WHERE organization_id = $1 ORDER BY starts_on DESC", [request.auth.organizationId]);
    response.json(result.rows);
  } catch (error) { next(error); }
});

app.post("/api/performance/cycles", requireAuth, requireRole("manager", "hr"), async (request, response, next) => {
  try {
    const input = z.object({ name: z.string().trim().min(1).max(120), startsOn: z.string().date(), endsOn: z.string().date(), status: z.enum(["draft", "open", "closed"]).default("draft") }).safeParse(request.body);
    if (!input.success) return response.status(400).json({ message: "Invalid performance cycle" });
    const result = await pool.query("INSERT INTO performance_cycles (organization_id, name, starts_on, ends_on, status, created_by) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *", [request.auth.organizationId, input.data.name, input.data.startsOn, input.data.endsOn, input.data.status, request.auth.sub]);
    response.status(201).json(result.rows[0]);
  } catch (error) { next(error); }
});

app.put("/api/performance/cycles/:cycleId/employees/:employeeId", requireAuth, requireRole("manager", "hr"), async (request, response, next) => {
  try {
    const input = z.object({ scores: z.array(z.object({ dimension: z.string().min(1).max(100), score: z.coerce.number().min(0).max(100), weight: z.coerce.number().min(0).max(100), note: z.string().max(5_000).optional() })).min(1) }).safeParse(request.body);
    if (!input.success) return response.status(400).json({ message: "Invalid performance scores" });
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const employee = await client.query("SELECT id FROM employees WHERE (id::text = $1 OR employee_code = $1) AND organization_id = $2", [request.params.employeeId, request.auth.organizationId]);
      if (!employee.rowCount) { await client.query("ROLLBACK"); return response.status(404).json({ message: "Employee not found" }); }
      for (const score of input.data.scores) {
        await client.query(
          `INSERT INTO performance_scores (organization_id, cycle_id, employee_id, dimension, score, weight, reviewer_user_id, note)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           ON CONFLICT (cycle_id, employee_id, dimension) DO UPDATE SET score = EXCLUDED.score, weight = EXCLUDED.weight, reviewer_user_id = EXCLUDED.reviewer_user_id, note = EXCLUDED.note, updated_at = now()`,
          [request.auth.organizationId, request.params.cycleId, employee.rows[0].id, score.dimension, score.score, score.weight, request.auth.sub, score.note || null],
        );
      }
      const aggregate = await client.query("SELECT round(sum(score * weight) / nullif(sum(weight), 0), 2) AS score FROM performance_scores WHERE cycle_id = $1 AND employee_id = $2", [request.params.cycleId, employee.rows[0].id]);
      await client.query("UPDATE employees SET scores = (SELECT jsonb_agg(score ORDER BY dimension) FROM performance_scores WHERE cycle_id = $1 AND employee_id = $2), updated_at = now() WHERE id = $2", [request.params.cycleId, employee.rows[0].id]);
      await client.query("COMMIT");
      response.json({ employeeId: employee.rows[0].id, weightedScore: aggregate.rows[0].score, scores: input.data.scores });
    } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
  } catch (error) { next(error); }
});

app.get("/api/reports/summary", requireAuth, requireRole("manager", "hr"), async (request, response, next) => {
  try {
    const [tasks, employees, attendance, leave, departments, attendanceToday, leaveToday, requests] = await Promise.all([
      pool.query("SELECT status, count(*)::int AS count FROM tasks WHERE organization_id = $1 GROUP BY status", [request.auth.organizationId]),
      pool.query("SELECT count(*)::int AS count, coalesce(sum(points), 0)::int AS points FROM employees WHERE organization_id = $1", [request.auth.organizationId]),
      pool.query("SELECT count(*)::int AS count FROM attendance_records WHERE organization_id = $1 AND work_date >= current_date - 30", [request.auth.organizationId]),
      pool.query("SELECT status, count(*)::int AS count FROM leave_requests WHERE organization_id = $1 GROUP BY status", [request.auth.organizationId]),
      pool.query(
        `SELECT d.name, count(e.id)::int AS employees,
         coalesce(round(avg((SELECT avg(value::numeric) FROM jsonb_array_elements_text(e.scores) AS score(value))), 1), 0) AS average_kpi
         FROM departments d LEFT JOIN employees e ON e.department_id = d.id AND e.organization_id = d.organization_id
         WHERE d.organization_id = $1 GROUP BY d.id, d.name ORDER BY d.name`,
        [request.auth.organizationId],
      ),
      pool.query("SELECT count(*) FILTER (WHERE check_in IS NOT NULL)::int AS present, count(*) FILTER (WHERE check_in IS NULL)::int AS incomplete FROM attendance_records WHERE organization_id = $1 AND work_date = current_date", [request.auth.organizationId]),
      pool.query("SELECT count(DISTINCT employee_id)::int AS on_leave FROM leave_requests WHERE organization_id = $1 AND status = 'Approved' AND start_date <= current_date AND end_date >= current_date", [request.auth.organizationId]),
      pool.query("SELECT status, count(*)::int AS count FROM hr_requests WHERE organization_id = $1 GROUP BY status", [request.auth.organizationId]),
    ]);
    response.json({
      tasks: tasks.rows,
      employees: employees.rows[0],
      attendanceLast30Days: attendance.rows[0].count,
      attendanceToday: attendanceToday.rows[0],
      leave: leave.rows,
      leaveToday: leaveToday.rows[0],
      departments: departments.rows,
      hrRequests: requests.rows,
    });
  } catch (error) { next(error); }
});

app.get("/api/privacy/requests", requireAuth, async (request, response, next) => {
  try {
    const result = await pool.query("SELECT * FROM privacy_requests WHERE organization_id = $1 AND ($2 <> 'employee' OR requester_id = $3) ORDER BY created_at DESC", [request.auth.organizationId, request.auth.role, request.auth.sub]);
    response.json(result.rows);
  } catch (error) { next(error); }
});

app.post("/api/privacy/requests", requireAuth, async (request, response, next) => {
  try {
    const input = z.object({ type: z.enum(["export", "deletion", "correction"]), reason: z.string().max(5_000).optional() }).safeParse(request.body);
    if (!input.success) return response.status(400).json({ message: "Invalid privacy request" });
    const result = await pool.query("INSERT INTO privacy_requests (organization_id, requester_id, type, reason) VALUES ($1, $2, $3, $4) RETURNING *", [request.auth.organizationId, request.auth.sub, input.data.type, input.data.reason || null]);
    await audit(request, `privacy.${input.data.type}_requested`, "privacy_request", result.rows[0].id);
    response.status(201).json(result.rows[0]);
  } catch (error) { next(error); }
});

app.patch("/api/privacy/requests/:id", requireAuth, requireRole("manager", "hr"), async (request, response, next) => {
  try {
    const input = z.object({ status: z.enum(["processing", "completed", "rejected"]) }).safeParse(request.body);
    if (!input.success) return response.status(400).json({ message: "Invalid privacy status" });
    const result = await pool.query("UPDATE privacy_requests SET status = $3, reviewed_by = $4, completed_at = CASE WHEN $3 = 'completed' THEN now() ELSE completed_at END WHERE id::text = $1 AND organization_id = $2 RETURNING *", [request.params.id, request.auth.organizationId, input.data.status, request.auth.sub]);
    if (!result.rowCount) return response.status(404).json({ message: "Privacy request not found" });
    response.json(result.rows[0]);
  } catch (error) { next(error); }
});

app.get("/api/performance/:employeeId", requireAuth, async (request, response, next) => {
  try {
    const result = await pool.query(
      `SELECT e.id, e.points, e.scores, coalesce(json_agg(json_build_object('value', p.value, 'reason', p.reason, 'createdAt', p.created_at) ORDER BY p.created_at DESC) FILTER (WHERE p.id IS NOT NULL), '[]') AS ledger
       FROM employees e LEFT JOIN point_ledger p ON p.employee_id = e.id
       WHERE (e.id::text = $1 OR e.employee_code = $1) AND e.organization_id = $2 GROUP BY e.id`,
      [request.params.employeeId, request.auth.organizationId],
    );
    if (!result.rowCount) return response.status(404).json({ message: "Performance profile not found" });
    if (request.auth.role === "employee") {
      const owner = await pool.query("SELECT 1 FROM employees WHERE (id::text = $1 OR employee_code = $1) AND user_id = $2", [request.params.employeeId, request.auth.sub]);
      if (!owner.rowCount) return response.status(403).json({ message: "You do not have permission for this performance profile" });
    }
    response.json(result.rows[0]);
  } catch (error) { next(error); }
});

app.use((error, request, response, _next) => {
  console.error(JSON.stringify({ requestId: request.requestId, error: error.message }));
  response.status(error.status || 500).json({ message: error.status ? error.message : "Internal server error" });
});

export { app };
