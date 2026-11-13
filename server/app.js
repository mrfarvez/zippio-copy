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
import * as github from "./github.js";

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
  projectId: z.string().min(1).max(64).optional(),
  links: z.array(z.object({ kind: z.enum(["repo", "link"]), url: z.string().trim().url().max(500) })).max(20).optional(),
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
const projectSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(2000).optional(),
  repoUrl: z.string().url().max(500).optional().or(z.literal("")),
  memberIds: z.array(z.string().min(1)).max(100).default([]),
});
const projectUpdateSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  description: z.string().trim().max(2000).optional(),
  repoUrl: z.string().url().max(500).optional().or(z.literal("")),
  status: z.enum(["active", "completed", "archived"]).optional(),
}).strict();
const memberSchema = z.object({ employeeId: z.string().min(1) });
const commitLinkSchema = z.object({ commitUrl: z.string().url().max(500) });
const hrUpdateSchema = z.object({  status: z.enum(["Pending approval", "In progress", "Completed", "Rejected"]).optional(),
  progress: z.coerce.number().int().min(0).max(100).optional(),
  officerId: z.string().optional(),
  note: z.string().max(10_000).optional(),
}).strict();
const commentSchema = z.object({ body: z.string().trim().min(1).max(10_000) });
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 }, fileFilter: (_request, file, callback) => callback(null, /^(application\/pdf|image\/(png|jpeg)|application\/zip|text\/plain|application\/msword|application\/vnd.openxmlformats-officedocument.wordprocessingml.document|application\/vnd.ms-excel|application\/vnd.openxmlformats-officedocument.spreadsheetml.sheet)$/.test(file.mimetype)) });

app.use(helmet());
app.set("trust proxy", 1);
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
  return { ...row, id: row.employee_code || row.id, initials: row.initials || row.name.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase(), points: Number(row.points), scores: row.scores || [0, 0, 0, 0, 0], status, githubConnected: row.github_connected === true || Boolean(row.github_login), activity: [], attendance: [] };
}

function taskView(row) {
  const kpi = row.kpi_score !== null && row.kpi_score !== undefined
    ? { score: Number(row.kpi_score), bonusRate: Number(row.kpi_bonus_rate), penaltyRate: Number(row.kpi_penalty_rate), lateDays: row.kpi_late_days, overdue: row.kpi_status === "overdue" || row.kpi_status === "late", scoringStatus: row.kpi_status }
    : calculateKpiScore({ basePoints: Number(row.points), deadline: row.deadline, submittedAt: row.submitted_at });
  return { ...row, id: row.task_code, employeeId: row.employee_code || row.employee_id, startedAt: row.started_at, taskCreatedAt: row.created_at, parentTaskId: row.parent_task_code || row.parent_task_id, reviewerId: row.reviewer_code || row.reviewer_id, projectId: row.project_id ? row.project_code || String(row.project_id) : null, projectName: row.project_name || null, projectRepo: row.project_repo || null, githubRepo: row.github_repo, additionalReferenceUrl: row.additional_reference_url, attachmentName: row.attachment_name, referenceLinks: row.reference_links || [], description: row.description || row.note, hours: Number(row.hours), points: Number(row.points), deadline: row.deadline, submittedAt: row.submitted_at, completedAt: row.completed_at, kpi };
}

async function audit(request, action, entityType, entityId, metadata = {}) {
  await pool.query(
    "INSERT INTO audit_events (organization_id, actor_user_id, action, entity_type, entity_id, request_id, metadata) VALUES ($1, $2, $3, $4, $5, $6, $7)",
    [request.auth?.organizationId || null, request.auth?.sub || null, action, entityType, entityId || null, request.requestId, JSON.stringify(metadata)],
  );
}

const TASK_SELECT = `SELECT t.*, e.employee_code, parent.task_code AS parent_task_code, reviewer.employee_code AS reviewer_code, p.project_code, p.name AS project_name, p.repo_url AS project_repo, tl.reference_links FROM tasks t JOIN employees e ON e.id = t.employee_id LEFT JOIN tasks parent ON parent.id = t.parent_task_id LEFT JOIN employees reviewer ON reviewer.id = t.reviewer_id LEFT JOIN projects p ON p.id = t.project_id LEFT JOIN LATERAL (SELECT coalesce(json_agg(json_build_object('id', l.id, 'kind', l.kind, 'url', l.url) ORDER BY l.created_at), '[]') AS reference_links FROM task_links l WHERE l.task_id = t.id) tl ON TRUE`;

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
       e.title, e.email, d.name AS department, e.points, e.scores, e.status,
       (EXISTS (SELECT 1 FROM github_accounts ega WHERE ega.user_id = e.user_id)) AS github_connected,
       ga.github_login
       FROM employees e LEFT JOIN departments d ON d.id = e.department_id
       LEFT JOIN github_accounts ga ON ga.user_id = e.user_id
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
      `${TASK_SELECT} WHERE t.organization_id = $1${ownerFilter} ORDER BY t.deadline, t.created_at`,
      values,
    );
    response.json(result.rows.map(taskView));
  } catch (error) { next(error); }
});

app.post("/api/tasks", requireAuth, requireRole("manager", "hr"), async (request, response, next) => {
  try {
    const input = validation(taskSchema, request, response);
    if (!input) return;
    let projectId = null;
    if (input.projectId) {
      const project = await pool.query("SELECT id FROM projects WHERE (project_code = $2 OR id::text = $2) AND organization_id = $1", [request.auth.organizationId, input.projectId]);
      if (!project.rowCount) return response.status(400).json({ message: "Project was not found" });
      projectId = project.rows[0].id;
    }
    const memberCheck = await pool.query(
      `SELECT 1 FROM employees e WHERE (e.id::text = $3 OR e.employee_code = $3) AND e.organization_id = $1
       AND ($2::uuid IS NULL OR EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id = $2 AND pm.employee_id = e.id))`,
      [request.auth.organizationId, projectId, input.employeeId],
    );
    if (!memberCheck.rowCount) return response.status(400).json({ message: projectId ? "Assigned employee is not a member of the selected project" : "Assigned employee was not found" });
    const repoLinks = (input.links || []).filter((item) => item.kind === "repo");
    for (const item of repoLinks) {
      if (!github.parseRepoUrl(item.url)) return response.status(400).json({ message: "GitHub reference must be a repository URL (https://github.com/owner/repository)" });
    }
    const githubRepo = input.githubRepo || repoLinks[0]?.url || "";
    const additionalReferenceUrl = input.additionalReferenceUrl || (input.links || []).find((item) => item.kind === "link")?.url || "";
    const result = await pool.query(
      `INSERT INTO tasks (organization_id, task_code, title, employee_id, priority, hours, points, deadline, description, note, github_repo, additional_reference_url, project_id)
       SELECT $1, 'ZP-' || ((SELECT coalesce(max(substring(task_code from 4)::int), 100) + 1 FROM tasks WHERE organization_id = $1)), $2, e.id, $3, $4, coalesce($5::integer, $11::integer), $6, $7, $7, nullif($8, ''), nullif($9, ''), $12::uuid
       FROM employees e WHERE (e.id::text = $10 OR e.employee_code = $10) AND e.organization_id = $1
       RETURNING *`,
      [request.auth.organizationId, input.title, input.priority, input.hours, input.points ?? defaultPointsForPriority(input.priority), input.deadline, input.description || input.note || null, githubRepo, additionalReferenceUrl, input.employeeId, defaultPointsForPriority(input.priority), projectId],
    );
    if (!result.rowCount) return response.status(400).json({ message: "Assigned employee was not found" });
    if (input.links?.length) {
      await pool.query(
        "INSERT INTO task_links (organization_id, task_id, kind, url) SELECT $1, $2, kind, url FROM unnest($3::text[], $4::text[]) AS x(kind, url)",
        [request.auth.organizationId, result.rows[0].id, input.links.map((item) => item.kind), input.links.map((item) => item.url)],
      );
    }
    await audit(request, "task.created", "task", result.rows[0].id, { taskCode: result.rows[0].task_code, projectId, referenceLinks: input.links?.length || 0 });
    const task = await pool.query(`${TASK_SELECT} WHERE t.id = $1`, [result.rows[0].id]);
    response.status(201).json(taskView(task.rows[0]));
  } catch (error) { next(error); }
});

app.patch("/api/tasks/:id", requireAuth, async (request, response, next) => {
  try {
    const allowed = z.object({ status: z.enum(["todo", "progress", "review", "handoff", "approved"]).optional(), note: z.string().max(10_000).optional(), description: z.string().max(10_000).optional(), startedAt: z.string().datetime().optional(), githubRepo: z.string().url().max(500).optional().or(z.literal("")), additionalReferenceUrl: z.string().url().max(500).optional().or(z.literal("")), attachmentName: z.string().max(255).optional() }).strict();
    const input = validation(allowed, request, response);
    if (!input) return;
    const previous = input.status
      ? await pool.query(
        "SELECT t.id, t.status, t.github_repo, p.repo_url AS project_repo FROM tasks t LEFT JOIN projects p ON p.id = t.project_id WHERE t.task_code = $1 AND t.organization_id = $2",
        [request.params.id, request.auth.organizationId],
      )
      : null;
    if (input.status === "review" && (previous?.rows[0]?.github_repo || previous?.rows[0]?.project_repo)) {
      const verified = await pool.query("SELECT count(*)::int AS n FROM task_commits WHERE task_id = $1 AND verified", [previous.rows[0].id]);
      if (verified.rows[0].n < 1) return response.status(400).json({ message: "At least one verified GitHub commit is required before submitting this task for review." });
    }
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
    const refreshed = await pool.query(`${TASK_SELECT} WHERE t.id = $1`, [result.rows[0].id]);
    response.json(taskView(refreshed.rows[0]));
  } catch (error) { next(error); }
});

app.post("/api/tasks/:id/links", requireAuth, async (request, response, next) => {
  try {
    const linkSchema = z.object({ kind: z.enum(["repo", "link"]), url: z.string().trim().url().max(500) }).strict();
    const input = validation(linkSchema, request, response);
    if (!input) return;
    if (input.kind === "repo" && !github.parseRepoUrl(input.url)) return response.status(400).json({ message: "GitHub reference must be a repository URL (https://github.com/owner/repository)" });
    const task = await pool.query(
      "SELECT id FROM tasks WHERE task_code = $1 AND organization_id = $2",
      [request.params.id, request.auth.organizationId],
    );
    if (!task.rowCount) return response.status(404).json({ message: "Task not found" });
    const manageable = await canManageProjects(request);
    if (!manageable) {
      const mine = await pool.query(
        "SELECT 1 FROM tasks t JOIN employees e ON e.user_id = $1 WHERE t.id = $2 AND (t.employee_id = e.id OR t.reviewer_id = e.id)",
        [request.auth.sub, task.rows[0].id],
      );
      if (!mine.rowCount) return response.status(403).json({ message: "You can only add documents to your own tasks" });
    }
    await pool.query("INSERT INTO task_links (organization_id, task_id, kind, url) VALUES ($1, $2, $3, $4)", [request.auth.organizationId, task.rows[0].id, input.kind, input.url]);
    await audit(request, "task.reference_added", "task", task.rows[0].id, { kind: input.kind });
    const refreshed = await pool.query(`${TASK_SELECT} WHERE t.id = $1`, [task.rows[0].id]);
    response.status(201).json(taskView(refreshed.rows[0]));
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

app.get("/api/tasks/:id/attachments", requireAuth, async (request, response, next) => {
  try {
    const employeeFilter = request.auth.role === "employee" ? " AND t.employee_id IN (SELECT id FROM employees WHERE user_id = $3)" : "";
    const result = await pool.query(
      `SELECT a.id, a.file_name, a.content_type, a.size_bytes, a.created_at FROM task_attachments a
       JOIN tasks t ON t.id = a.task_id
       WHERE t.task_code = $1 AND t.organization_id = $2${employeeFilter}
       ORDER BY a.created_at`,
      request.auth.role === "employee" ? [request.params.id, request.auth.organizationId, request.auth.sub] : [request.params.id, request.auth.organizationId],
    );
    response.json(result.rows.map((row) => ({ id: row.id, fileName: row.file_name, contentType: row.content_type, sizeBytes: Number(row.size_bytes), uploadedAt: row.created_at })));
  } catch (error) { next(error); }
});

app.get("/api/tasks/:id/attachments/:attachmentId", requireAuth, async (request, response, next) => {
  try {
    const employeeFilter = request.auth.role === "employee" ? " AND t.employee_id IN (SELECT id FROM employees WHERE user_id = $4)" : "";
    const result = await pool.query(
      `SELECT a.file_name, a.content_type, a.content FROM task_attachments a
       JOIN tasks t ON t.id = a.task_id
       WHERE t.task_code = $1 AND t.organization_id = $2 AND a.id::text = $3${employeeFilter}`,
      request.auth.role === "employee"
        ? [request.params.id, request.auth.organizationId, request.params.attachmentId, request.auth.sub]
        : [request.params.id, request.auth.organizationId, request.params.attachmentId],
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
    const author = await pool.query("SELECT display_name FROM users WHERE id = $1", [request.auth.sub]);
    response.status(201).json({ ...result.rows[0], author: author.rows[0]?.display_name || "User" });
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
    let commitBonus = 0;
    if (approved) {
      const commits = await client.query("SELECT count(*)::int AS n FROM task_commits WHERE task_id = $1 AND verified", [task.rows[0].id]);
      commitBonus = Math.min(Math.max(commits.rows[0].n - 1, 0) * 3, 15);
    }
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
    if (approved && commitBonus > 0) {
      await client.query("INSERT INTO point_ledger (organization_id, employee_id, task_id, value, reason) VALUES ($1, $2, $3, $4, $5)", [request.auth.organizationId, task.rows[0].employee_id, task.rows[0].id, commitBonus, `GitHub commit bonus for ${task.rows[0].task_code}`]);
      await client.query("UPDATE employees SET points = points + $2, updated_at = now() WHERE id = $1", [task.rows[0].employee_id, commitBonus]);
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

// ── Projects ─────────────────────────────────────────────

async function canManageProjects(request) {
  if (["manager", "hr"].includes(request.auth.role)) return true;
  if (request.auth.role !== "employee") return false;
  const result = await pool.query(
    `SELECT 1 FROM employees
     WHERE user_id = $1 AND organization_id = $2
       AND lower(title) IN ('team lead', 'teamlead')`,
    [request.auth.sub, request.auth.organizationId],
  );
  return result.rowCount > 0;
}

function requireProjectManager(request, response, next) {
  canManageProjects(request).then((allowed) => {
    if (!allowed) return response.status(403).json({ message: "Only managers and team leads can manage projects" });
    next();
  }).catch(next);
}

async function inviteProjectCollaborators(project, creatorUserId) {
  const parsed = github.parseRepoUrl(project.repo_url || "");
  if (!parsed) return { repo: null, invites: [], error: null };
  const creator = await pool.query("SELECT github_login, access_token FROM github_accounts WHERE user_id = $1", [creatorUserId]);
  if (!creator.rowCount) return { repo: parsed, invites: [], error: "creator-not-connected" };
  const members = await pool.query(
    `SELECT e.id, e.name, e.employee_code, ga.github_login
     FROM project_members pm
     JOIN employees e ON e.id = pm.employee_id
     LEFT JOIN users u ON u.id = e.user_id
     LEFT JOIN github_accounts ga ON ga.user_id = u.id
     WHERE pm.project_id = $1 AND pm.role <> 'lead'`,
    [project.id],
  );
  const invites = [];
  for (const member of members.rows) {
    if (!member.github_login) {
      invites.push({ employeeId: member.employee_code, name: member.name, status: "github-not-connected" });
      continue;
    }
    const result = await github.inviteCollaborator(parsed.owner, parsed.repo, member.github_login, "push", creator.rows[0].access_token);
    invites.push({ employeeId: member.employee_code, name: member.name, login: member.github_login, status: result.status });
  }
  return { repo: parsed, invites, error: null };
}

async function repoTeamActivity(repoUrl, token) {
  const parsed = github.parseRepoUrl(repoUrl);
  if (!parsed) return { ok: false, reason: "no-repo", pullRequests: [], commits: [] };
  const pullRequests = [];
  const commits = [];
  for (let page = 1; page <= 2; page += 1) {
    const response = await github.listPullRequests(parsed.owner, parsed.repo, token, page).catch(() => null);
    if (!response || response.status !== 200 || !Array.isArray(response.data)) return { ok: false, reason: "github", pullRequests: [], commits: [] };
    pullRequests.push(...response.data);
    if (response.data.length < 100) break;
  }
  for (let page = 1; page <= 2; page += 1) {
    const response = await github.listCommits(parsed.owner, parsed.repo, token, null, page).catch(() => null);
    if (!response || response.status !== 200 || !Array.isArray(response.data)) return { ok: false, reason: "github", pullRequests: [], commits: [] };
    commits.push(...response.data);
    if (response.data.length < 100) break;
  }
  const approvedSet = new Set(pullRequests.filter((pr) => pr.merged_at).map((pr) => pr.number));
  for (const pr of pullRequests.filter((item) => !item.merged_at).slice(0, 20)) {
    const reviews = await github.listPullReviews(parsed.owner, parsed.repo, pr.number, token).catch(() => null);
    if (reviews?.status === 200 && Array.isArray(reviews.data) && reviews.data.some((review) => review.state === "APPROVED")) approvedSet.add(pr.number);
  }
  return {
    ok: true,
    pullRequests: pullRequests.map((pr) => ({
      number: pr.number, title: pr.title, state: pr.state, merged: Boolean(pr.merged_at),
      approved: approvedSet.has(pr.number), author: pr.user?.login || null, url: pr.html_url,
      createdAt: pr.created_at, closedAt: pr.closed_at, mergedAt: pr.merged_at,
    })),
    commits: commits.filter((commit) => commit.commit).map((commit) => ({
      sha: commit.sha, shortSha: String(commit.sha).slice(0, 7), message: commit.commit.message,
      url: commit.html_url, committedAt: commit.commit.author?.date,
      author: commit.author?.login || commit.commit.author?.email?.split("@")[0] || null,
    })),
  };
}

function memberGitHubStats(activity, login) {
  const match = (value) => String(value || "").toLowerCase() === String(login || "").toLowerCase();
  const pullRequests = activity.pullRequests.filter((pr) => match(pr.author));
  const commits = activity.commits.filter((commit) => match(commit.author));
  return {
    pullRequests: pullRequests.length,
    approvedPullRequests: pullRequests.filter((pr) => pr.approved).length,
    mergedPullRequests: pullRequests.filter((pr) => pr.merged).length,
    commits: commits.length,
  };
}

app.get("/api/projects", requireAuth, async (request, response, next) => {
  try {
    const result = await pool.query(
      `SELECT p.id, p.project_code, p.name, p.description, p.repo_url, p.status, p.created_at, u.display_name AS created_by_name,
        (SELECT count(*)::int FROM tasks t WHERE t.project_id = p.id) AS task_count,
        coalesce(json_agg(json_build_object('employeeId', e.employee_code, 'name', e.name, 'title', e.title, 'role', pm.role, 'githubConnected', (mga.user_id IS NOT NULL)) ORDER BY e.name) FILTER (WHERE e.id IS NOT NULL), '[]') AS members
       FROM projects p
       LEFT JOIN project_members pm ON pm.project_id = p.id
       LEFT JOIN employees e ON e.id = pm.employee_id
       LEFT JOIN users mu ON mu.id = e.user_id
       LEFT JOIN github_accounts mga ON mga.user_id = mu.id
       LEFT JOIN users u ON u.id = p.created_by
       WHERE p.organization_id = $1
         AND ($2 <> 'employee' OR EXISTS (SELECT 1 FROM project_members fpm JOIN employees fe ON fe.id = fpm.employee_id WHERE fpm.project_id = p.id AND fe.user_id = $3))
       GROUP BY p.id, u.display_name
       ORDER BY p.created_at DESC`,
      [request.auth.organizationId, request.auth.role, request.auth.sub],
    );
    response.json(result.rows.map((row) => ({ ...row, id: row.project_code, taskCount: Number(row.task_count) })));
  } catch (error) { next(error); }
});

app.post("/api/projects", requireAuth, requireProjectManager, async (request, response, next) => {
  const input = validation(projectSchema, request, response);
  if (!input) return;
  if (input.repoUrl && !github.parseRepoUrl(input.repoUrl)) return response.status(400).json({ message: "Repo URL must be a GitHub repository URL" });
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const created = await client.query(
      `INSERT INTO projects (organization_id, project_code, name, description, repo_url, created_by)
       VALUES ($1, 'PRJ-' || ((SELECT coalesce(max(substring(project_code from 5)::int), 100) + 1 FROM projects WHERE organization_id = $1)), $2, $3, nullif($4, ''), $5)
       RETURNING *`,
      [request.auth.organizationId, input.name, input.description || null, input.repoUrl || "", request.auth.sub],
    );
    const project = created.rows[0];
    const lead = await client.query("SELECT id FROM employees WHERE user_id = $1 AND organization_id = $2", [request.auth.sub, request.auth.organizationId]);
    if (lead.rowCount) await client.query("INSERT INTO project_members (project_id, employee_id, role) VALUES ($1, $2, 'lead') ON CONFLICT DO NOTHING", [project.id, lead.rows[0].id]);
    for (const memberId of input.memberIds) {
      const employee = await client.query("SELECT id FROM employees WHERE (id::text = $2 OR employee_code = $2) AND organization_id = $1", [request.auth.organizationId, memberId]);
      if (employee.rowCount) await client.query("INSERT INTO project_members (project_id, employee_id, role) VALUES ($1, $2, 'member') ON CONFLICT DO NOTHING", [project.id, employee.rows[0].id]);
    }
    await client.query("COMMIT");
    await audit(request, "project.created", "project", project.id, { projectCode: project.project_code });
    const full = await pool.query(
      `SELECT p.*, coalesce(json_agg(json_build_object('employeeId', e.employee_code, 'name', e.name, 'title', e.title, 'role', pm.role, 'githubConnected', (mga.user_id IS NOT NULL)) ORDER BY e.name) FILTER (WHERE e.id IS NOT NULL), '[]') AS members
       FROM projects p LEFT JOIN project_members pm ON pm.project_id = p.id LEFT JOIN employees e ON e.id = pm.employee_id
       LEFT JOIN users mu ON mu.id = e.user_id LEFT JOIN github_accounts mga ON mga.user_id = mu.id
       WHERE p.id = $1 GROUP BY p.id`,
      [project.id],
    );
    const invites = await inviteProjectCollaborators(project, request.auth.sub);
    await audit(request, "project.repo_invites_sent", "project", project.id, { sent: invites.invites.filter((item) => item.status === "invited").length });
    response.status(201).json({ ...full.rows[0], id: full.rows[0].project_code, githubInvites: invites });
  } catch (error) {
    await client.query("ROLLBACK");
    next(error);
  } finally { client.release(); }
});

app.patch("/api/projects/:id", requireAuth, requireRole("manager", "hr"), async (request, response, next) => {
  try {
    const input = validation(projectUpdateSchema, request, response);
    if (!input) return;
    if (input.repoUrl && !github.parseRepoUrl(input.repoUrl)) return response.status(400).json({ message: "Repo URL must be a GitHub repository URL" });
    const result = await pool.query(
      `UPDATE projects SET name = coalesce($3, name), description = coalesce($4, description), repo_url = coalesce(nullif($5, ''), repo_url), status = coalesce($6, status), updated_at = now()
       WHERE project_code = $1 AND organization_id = $2 RETURNING *`,
      [request.params.id, request.auth.organizationId, input.name || null, input.description || null, input.repoUrl || "", input.status || null],
    );
    if (!result.rowCount) return response.status(404).json({ message: "Project not found" });
    await audit(request, "project.updated", "project", result.rows[0].id, { fields: Object.keys(input) });
    response.json({ ...result.rows[0], id: result.rows[0].project_code });
  } catch (error) { next(error); }
});

app.post("/api/projects/:id/members", requireAuth, requireProjectManager, async (request, response, next) => {
  try {
    const input = validation(memberSchema, request, response);
    if (!input) return;
    const result = await pool.query(
      `INSERT INTO project_members (project_id, employee_id, role)
       SELECT p.id, e.id, 'member' FROM projects p JOIN employees e
       ON (e.id::text = $3 OR e.employee_code = $3) AND e.organization_id = p.organization_id
       WHERE p.project_code = $1 AND p.organization_id = $2
       ON CONFLICT DO NOTHING RETURNING employee_id`,
      [request.params.id, request.auth.organizationId, input.employeeId],
    );
    if (!result.rowCount) return response.status(404).json({ message: "Project or employee was not found" });
    await audit(request, "project.member_added", "project", result.rows[0].employee_id, { projectCode: request.params.id });
    const project = await pool.query("SELECT id, project_code, repo_url FROM projects WHERE project_code = $1 AND organization_id = $2", [request.params.id, request.auth.organizationId]);
    let invite = null;
    if (project.rows[0]?.repo_url) {
      const memberLogin = await pool.query(
        `SELECT e.name, e.employee_code, ga.github_login FROM employees e
         LEFT JOIN users u ON u.id = e.user_id LEFT JOIN github_accounts ga ON ga.user_id = u.id
         WHERE e.id = $1`,
        [result.rows[0].employee_id],
      );
      if (memberLogin.rowCount) {
        const parsed = github.parseRepoUrl(project.rows[0].repo_url);
        if (!memberLogin.rows[0].github_login) invite = { employeeId: memberLogin.rows[0].employee_code, name: memberLogin.rows[0].name, status: "github-not-connected" };
        else if (!parsed) invite = { employeeId: memberLogin.rows[0].employee_code, name: memberLogin.rows[0].name, status: "no-repo" };
        else {
          const token = await pool.query("SELECT access_token FROM github_accounts WHERE user_id = $1", [request.auth.sub]);
          const inviteResult = token.rowCount
            ? await github.inviteCollaborator(parsed.owner, parsed.repo, memberLogin.rows[0].github_login, "push", token.rows[0].access_token)
            : { status: "creator-not-connected" };
          invite = { employeeId: memberLogin.rows[0].employee_code, name: memberLogin.rows[0].name, login: memberLogin.rows[0].github_login, status: inviteResult.status };
        }
      }
    }
    response.status(201).json({ message: "Member added", invite });
  } catch (error) { next(error); }
});

app.post("/api/projects/github-repos", requireAuth, requireProjectManager, async (request, response, next) => {
  try {
    const schema = z.object({
      name: z.string().trim().min(1).max(100).regex(/^[A-Za-z0-9_.-]+$/, "Repository name may only contain letters, numbers, dots, dashes and underscores"),
      description: z.string().trim().max(350).optional(),
      private: z.boolean().optional(),
      autoInit: z.boolean().optional(),
      gitignoreTemplate: z.string().trim().max(100).optional(),
      licenseTemplate: z.string().trim().max(100).optional(),
    }).strict();
    const input = validation(schema, request, response);
    if (!input) return;
    const account = await pool.query("SELECT access_token FROM github_accounts WHERE user_id = $1", [request.auth.sub]);
    if (!account.rowCount) return response.status(400).json({ message: "Connect your GitHub account first (profile ••• → GitHub) to create a repository", code: "creator-not-connected" });
    const result = await github.createRepository(account.rows[0].access_token, input);
    if (result.status === "name-taken") return response.status(409).json({ message: "A repository with this name already exists on your GitHub account — pick another name", code: "name-taken" });
    if (result.status !== "created") {
      await audit(request, "project.repo_create_failed", "project", null, { name: input.name, reason: result.status });
      return response.status(502).json({ message: result.status === "forbidden" ? "GitHub denied repository creation — check your account permissions" : "GitHub repository could not be created right now — try again", code: result.status });
    }
    await audit(request, "project.repo_created", "project", null, { name: input.name, fullName: result.fullName, private: input.private !== false });
    response.status(201).json({ repoUrl: result.repoUrl, fullName: result.fullName });
  } catch (error) { next(error); }
});

app.post("/api/projects/:id/repo-invites", requireAuth, requireProjectManager, async (request, response, next) => {
  try {
    const project = await pool.query("SELECT id, project_code, repo_url FROM projects WHERE project_code = $1 AND organization_id = $2", [request.params.id, request.auth.organizationId]);
    if (!project.rowCount) return response.status(404).json({ message: "Project not found" });
    const invites = await inviteProjectCollaborators(project.rows[0], request.auth.sub);
    await audit(request, "project.repo_invites_sent", "project", project.rows[0].id, { sent: invites.invites.filter((item) => item.status === "invited").length });
    response.json({ id: project.rows[0].project_code, repo: project.rows[0].repo_url || null, ...invites });
  } catch (error) { next(error); }
});

app.delete("/api/projects/:id/members/:employeeId", requireAuth, requireProjectManager, async (request, response, next) => {
  try {
    const result = await pool.query(
      `DELETE FROM project_members pm USING projects p, employees e
       WHERE pm.project_id = p.id AND pm.employee_id = e.id
       AND p.project_code = $1 AND p.organization_id = $2 AND (e.id::text = $3 OR e.employee_code = $3)`,
      [request.params.id, request.auth.organizationId, request.params.employeeId],
    );
    if (!result.rowCount) return response.status(404).json({ message: "Project member was not found" });
    await audit(request, "project.member_removed", "project", null, { projectCode: request.params.id, employeeId: request.params.employeeId });
    response.status(204).end();
  } catch (error) { next(error); }
});

app.get("/api/projects/:id/overview", requireAuth, requireProjectManager, async (request, response, next) => {
  try {
    const project = await pool.query(
      `SELECT p.*, u.display_name AS created_by_name,
        (SELECT count(*)::int FROM tasks t WHERE t.project_id = p.id) AS task_count
       FROM projects p LEFT JOIN users u ON u.id = p.created_by
       WHERE p.project_code = $1 AND p.organization_id = $2`,
      [request.params.id, request.auth.organizationId],
    );
    if (!project.rowCount) return response.status(404).json({ message: "Project not found" });
    const projectRow = project.rows[0];
    const members = await pool.query(
      `SELECT e.id, e.employee_code, e.name, e.title, pm.role, ga.github_login, (ga.user_id IS NOT NULL) AS github_connected
       FROM project_members pm JOIN employees e ON e.id = pm.employee_id
       LEFT JOIN users mu ON mu.id = e.user_id
       LEFT JOIN github_accounts ga ON ga.user_id = mu.id
       WHERE pm.project_id = $1 ORDER BY (pm.role = 'lead') DESC, e.name`,
      [projectRow.id],
    );
    const taskCounts = await pool.query(
      "SELECT t.employee_id, t.status, count(*)::int AS count FROM tasks t WHERE t.project_id = $1 GROUP BY t.employee_id, t.status",
      [projectRow.id],
    );
    const taskCountMap = new Map();
    for (const row of taskCounts.rows) {
      const entry = taskCountMap.get(row.employee_id) || { tasksAssigned: 0, tasksCompleted: 0, tasksActive: 0 };
      entry.tasksAssigned += row.count;
      if (row.status === "approved") entry.tasksCompleted += row.count;
      else if (row.status !== "todo") entry.tasksActive += row.count;
      taskCountMap.set(row.employee_id, entry);
    }
    const verified = await pool.query(
      "SELECT tc.employee_id, count(*)::int AS count FROM task_commits tc JOIN tasks t ON t.id = tc.task_id WHERE t.project_id = $1 GROUP BY tc.employee_id",
      [projectRow.id],
    );
    const verifiedMap = new Map(verified.rows.map((row) => [row.id, row.count]));
    const taskRows = await pool.query(
      `SELECT t.task_code, t.title, t.status, t.points, t.deadline, e.name AS assignee, e.employee_code AS assignee_code,
        (SELECT count(*)::int FROM task_commits tc WHERE tc.task_id = t.id) AS commit_count
       FROM tasks t JOIN employees e ON e.id = t.employee_id
       WHERE t.project_id = $1 ORDER BY t.created_at DESC`,
      [projectRow.id],
    );
    let activity = { ok: true, pullRequests: [], commits: [] };
    let connected = false;
    let reason = null;
    if (projectRow.repo_url) {
      const account = await pool.query("SELECT access_token FROM github_accounts WHERE user_id = $1", [request.auth.sub]);
      if (account.rowCount) {
        connected = true;
        activity = await repoTeamActivity(projectRow.repo_url, account.rows[0].access_token);
      } else {
        activity = { ok: false, pullRequests: [], commits: [] };
        reason = "creator-not-connected";
      }
    } else reason = "no-repo";
    response.json({
      project: { id: projectRow.project_code, name: projectRow.name, description: projectRow.description, repo: projectRow.repo_url || null, status: projectRow.status, createdAt: projectRow.created_at, taskCount: projectRow.task_count },
      connected, githubReachable: activity.ok, githubReason: activity.reason || reason,
      members: members.rows.map((row) => ({
        employeeId: row.employee_code, name: row.name, title: row.title, role: row.role,
        githubConnected: row.github_connected === true, githubLogin: row.github_login || null,
        ...(taskCountMap.get(row.id) || { tasksAssigned: 0, tasksCompleted: 0, tasksActive: 0 }),
        verifiedCommits: verifiedMap.get(row.id) || 0,
        ...memberGitHubStats(activity, row.github_login),
      })),
      tasks: taskRows.rows.map((row) => ({ id: row.task_code, title: row.title, status: row.status, points: Number(row.points), deadline: row.deadline, assignee: row.assignee, assigneeCode: row.assignee_code, commitCount: row.commit_count })),
      pullRequests: activity.pullRequests,
      commits: activity.commits,
    });
  } catch (error) { next(error); }
});

app.delete("/api/projects/:id", requireAuth, requireProjectManager, async (request, response, next) => {
  try {
    const result = await pool.query(
      "DELETE FROM projects WHERE project_code = $1 AND organization_id = $2 RETURNING id",
      [request.params.id, request.auth.organizationId],
    );
    if (!result.rowCount) return response.status(404).json({ message: "Project not found" });
    await audit(request, "project.deleted", "project", result.rows[0].id, { projectCode: request.params.id });
    response.status(204).end();
  } catch (error) { next(error); }
});

// ── GitHub commit verification ───────────────────────────

app.get("/api/tasks/:id/commits", requireAuth, async (request, response, next) => {
  try {
    const ownerFilter = request.auth.role === "employee"
      ? " AND (t.employee_id IN (SELECT id FROM employees WHERE user_id = $3) OR t.reviewer_id IN (SELECT id FROM employees WHERE user_id = $3))"
      : "";
    const result = await pool.query(
      `SELECT c.id, c.commit_sha, c.commit_url, c.message, c.author_login, c.author_email, c.committed_at, c.verified, c.verified_at, e.employee_code, e.name AS employee_name
       FROM task_commits c JOIN tasks t ON t.id = c.task_id JOIN employees e ON e.id = c.employee_id
       WHERE t.task_code = $1 AND t.organization_id = $2${ownerFilter}
       ORDER BY c.created_at DESC`,
      request.auth.role === "employee" ? [request.params.id, request.auth.organizationId, request.auth.sub] : [request.params.id, request.auth.organizationId],
    );
    response.json(result.rows.map((row) => ({ id: row.id, sha: row.commit_sha, shortSha: String(row.commit_sha).slice(0, 7), commitUrl: row.commit_url, message: row.message, author: row.author_login || row.author_email, committedAt: row.committed_at, verified: row.verified, employeeId: row.employee_code, employeeName: row.employee_name })));
  } catch (error) { next(error); }
});

app.post("/api/tasks/:id/commits", requireAuth, requireRole("employee"), async (request, response, next) => {
  try {
    const input = validation(commitLinkSchema, request, response);
    if (!input) return;
    const parsed = github.parseCommitUrl(input.commitUrl);
    if (!parsed) return response.status(400).json({ message: "A valid GitHub commit URL is required (https://github.com/owner/repo/commit/<sha>)" });
    const task = await pool.query(
      `SELECT t.id, t.github_repo, p.repo_url AS project_repo FROM tasks t LEFT JOIN projects p ON p.id = t.project_id
       WHERE t.task_code = $1 AND t.organization_id = $2 AND t.employee_id IN (SELECT id FROM employees WHERE user_id = $3)`,
      [request.params.id, request.auth.organizationId, request.auth.sub],
    );
    if (!task.rowCount) return response.status(404).json({ message: "Task not found" });
    const taskRow = task.rows[0];
    const repoSource = taskRow.github_repo || taskRow.project_repo;
    if (repoSource && !github.sameRepo(repoSource, input.commitUrl)) return response.status(400).json({ message: "The commit must come from the task's GitHub repository" });
    const account = await pool.query("SELECT github_login, access_token FROM github_accounts WHERE user_id = $1", [request.auth.sub]);
    if (!account.rowCount) return response.status(400).json({ message: "Connect your GitHub account first, then paste the commit link" });
    const duplicate = await pool.query("SELECT 1 FROM task_commits WHERE task_id = $1 AND commit_sha = $2", [taskRow.id, parsed.sha]);
    if (duplicate.rowCount) return response.status(409).json({ message: "This commit is already linked to the task" });
    const { status, data } = await github.getCommit(parsed.owner, parsed.repo, parsed.sha, account.rows[0].access_token);
    if (status === 404 || status === 422) return response.status(400).json({ message: "The commit was not found in that repository" });
    if (status === 401 || status === 403) return response.status(400).json({ message: "GitHub denied access to that repository — make sure your connected account can read it" });
    if (status !== 200 || !data?.sha) return response.status(502).json({ message: "GitHub verification is temporarily unavailable" });
    const authorLogin = data.author?.login || null;
    const authorEmail = data.commit?.author?.email || null;
    if (authorLogin) {
      if (String(authorLogin).toLowerCase() !== String(account.rows[0].github_login).toLowerCase()) return response.status(403).json({ message: `The commit was authored by @${authorLogin}, not your connected GitHub account` });
    } else {
      const employee = await pool.query("SELECT email FROM employees WHERE user_id = $1 AND organization_id = $2", [request.auth.sub, request.auth.organizationId]);
      const email = employee.rowCount ? String(employee.rows[0].email).toLowerCase() : "";
      if (!authorEmail || String(authorEmail).toLowerCase() !== email) return response.status(403).json({ message: "The commit is not authored by your connected GitHub account" });
    }
    const inserted = await pool.query(
      `INSERT INTO task_commits (organization_id, task_id, employee_id, repo, commit_sha, commit_url, message, author_login, author_email, committed_at, github_raw)
       SELECT $1, t.id, t.employee_id, $2, $3, $4, $5, $6, $7, $8::timestamptz, $9::jsonb
       FROM tasks t WHERE t.id = $10
       RETURNING id, commit_sha, commit_url, message, author_login, committed_at, verified`,
      [request.auth.organizationId, `${parsed.owner}/${parsed.repo}`, data.sha, input.commitUrl, String(data.commit?.message || "").slice(0, 2000), authorLogin, authorEmail, data.commit?.author?.date || null, JSON.stringify({ sha: data.sha, html_url: data.html_url }), taskRow.id],
    );
    if (!inserted.rowCount) return response.status(409).json({ message: "This commit is already linked to the task" });
    await audit(request, "task.commit_verified", "task", taskRow.id, { sha: data.sha, author: authorLogin });
    response.status(201).json({ id: inserted.rows[0].id, sha: inserted.rows[0].commit_sha, shortSha: String(inserted.rows[0].commit_sha).slice(0, 7), commitUrl: inserted.rows[0].commit_url, message: inserted.rows[0].message, author: inserted.rows[0].author_login, committedAt: inserted.rows[0].committed_at, verified: true });
  } catch (error) { next(error); }
});

// ── GitHub OAuth connection ──────────────────────────────

function requestApiOrigin(request) {
  return `${request.protocol}://${request.get("host")}`;
}

app.get("/api/auth/profile", requireAuth, async (request, response, next) => {
  try {
    const result = await pool.query(
      `SELECT u.email, u.display_name, e.name, e.title, e.employee_code, r.name AS role
       FROM users u JOIN roles r ON r.id = u.role_id LEFT JOIN employees e ON e.user_id = u.id
       WHERE u.id = $1`,
      [request.auth.sub],
    );
    if (!result.rowCount) return response.status(404).json({ message: "Profile not found" });
    const row = result.rows[0];
    response.json({
      email: row.email, displayName: row.display_name, role: row.role,
      name: row.name || row.display_name, title: row.title || null, employeeCode: row.employee_code || null,
      isEmployee: Boolean(row.employee_code),
    });
  } catch (error) { next(error); }
});

app.patch("/api/auth/profile", requireAuth, async (request, response, next) => {
  try {
    const input = validation(profileSchema, request, response);
    if (!input) return;
    if (input.displayName) {
      const updated = await pool.query("UPDATE users SET display_name = $2, updated_at = now() WHERE id = $1 RETURNING display_name", [request.auth.sub, input.displayName]);
      if (!updated.rowCount) return response.status(404).json({ message: "Profile not found" });
    }
    let employeeUpdated = null;
    if (input.name || input.title) {
      const sets = [];
      const values = [request.auth.sub];
      if (input.name) { values.push(input.name); sets.push(`name = $${values.length}`); }
      if (input.title) { values.push(input.title); sets.push(`title = $${values.length}`); }
      employeeUpdated = await pool.query(
        `UPDATE employees SET ${sets.join(", ")}, updated_at = now() WHERE user_id = $1 RETURNING name, title`,
        values,
      );
      if (!employeeUpdated.rowCount && (input.name || input.title)) {
        // Non-employee users have no employee row — sync display name instead when only title was meant for display
        if (!input.displayName && input.name) {
          const renamed = await pool.query("UPDATE users SET display_name = $2, updated_at = now() WHERE id = $1 RETURNING display_name", [request.auth.sub, input.name]);
          if (renamed.rowCount) employeeUpdated = { rowCount: 1, rows: [{ name: renamed.rows[0].display_name, title: input.title || null }] };
        }
      }
    }
    await audit(request, "profile.updated", "user", request.auth.sub, { fields: Object.keys(input) });
    response.json({ displayName: input.displayName || employeeUpdated?.rows?.[0]?.name || null, name: employeeUpdated?.rows?.[0]?.name || null, title: employeeUpdated?.rows?.[0]?.title || null });
  } catch (error) { next(error); }
});

app.post("/api/auth/password", requireAuth, async (request, response, next) => {
  try {
    const input = validation(passwordSchema, request, response);
    if (!input) return;
    const credential = await pool.query("SELECT password_hash FROM password_credentials WHERE user_id = $1", [request.auth.sub]);
    if (!credential.rowCount) return response.status(404).json({ message: "No password credential found" });
    if (!(await verifyPassword(input.currentPassword, credential.rows[0].password_hash))) return response.status(401).json({ message: "Current password is incorrect" });
    if (await verifyPassword(input.newPassword, credential.rows[0].password_hash)) return response.status(400).json({ message: "New password must be different from the current one" });
    await pool.query("UPDATE password_credentials SET password_hash = $2, failed_attempts = 0, locked_until = NULL, updated_at = now() WHERE user_id = $1", [request.auth.sub, await hashPassword(input.newPassword)]);
    await audit(request, "password.changed", "user", request.auth.sub);
    response.status(204).end();
  } catch (error) { next(error); }
});

app.get("/api/auth/github", requireAuth, async (request, response, next) => {
  try {
    const account = await pool.query("SELECT github_login, connected_at FROM github_accounts WHERE user_id = $1", [request.auth.sub]);
    response.json(account.rowCount ? { connected: true, login: account.rows[0].github_login, connectedAt: account.rows[0].connected_at } : { connected: false, login: null });
  } catch (error) { next(error); }
});

app.delete("/api/auth/github", requireAuth, async (request, response, next) => {
  try {
    await pool.query("DELETE FROM github_accounts WHERE user_id = $1", [request.auth.sub]);
    await audit(request, "github.disconnected", "user", request.auth.sub);
    response.status(204).end();
  } catch (error) { next(error); }
});

app.get("/api/auth/github/start", requireAuth, async (request, response, next) => {
  try {
    if (!github.githubConfigured()) return response.status(501).json({ message: "GitHub integration is not configured on this server yet" });
    const state = github.createOAuthState(request.auth.sub);
    response.json({ url: github.authorizeUrl(`${requestApiOrigin(request)}/api/auth/github/callback`, state) });
  } catch (error) { next(error); }
});

app.get("/api/auth/github/callback", async (request, response, next) => {
  const frontendOrigin = configuredOrigins[0] || "/";
  try {
    const code = typeof request.query.code === "string" ? request.query.code : "";
    const userId = github.verifyOAuthState(request.query.state);
    if (!userId) return response.redirect(`${frontendOrigin}/?github=error&reason=state`);
    const { accessToken, scope } = await github.exchangeCode(code, `${requestApiOrigin(request)}/api/auth/github/callback`);
    const profile = await github.getAuthenticatedUser(accessToken);
    if (profile.status !== 200 || !profile.data?.login) return response.redirect(`${frontendOrigin}/?github=error&reason=profile`);
    await pool.query(
      `INSERT INTO github_accounts (user_id, github_login, github_id, access_token, scope)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (user_id) DO UPDATE SET github_login = EXCLUDED.github_login, github_id = EXCLUDED.github_id,
         access_token = EXCLUDED.access_token, scope = EXCLUDED.scope, connected_at = now(), updated_at = now()`,
      [userId, profile.data.login, String(profile.data.id), accessToken, scope],
    );
    await pool.query("INSERT INTO audit_events (organization_id, actor_user_id, action, entity_type, entity_id) SELECT organization_id, id, 'github.connected', 'user', id FROM users WHERE id = $1", [userId]);
    response.redirect(`${frontendOrigin}/?github=connected`);
  } catch (error) {
    if (error?.status && error.status < 500) return response.redirect(`${frontendOrigin}/?github=error&reason=oauth`);
    next(error);
  }
});

const profileSchema = z.object({
  displayName: z.string().trim().min(2).max(80).optional(),
  name: z.string().trim().min(2).max(80).optional(),
  title: z.string().trim().min(2).max(80).optional(),
}).strict().refine((value) => Object.keys(value).length > 0, { message: "Nothing to update" });
const passwordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
}).strict();

// ── Employee development (GitHub activity) ───────────────

async function developmentContext(request) {
  const employee = await pool.query(
    "SELECT id, employee_code, name FROM employees WHERE user_id = $1 AND organization_id = $2",
    [request.auth.sub, request.auth.organizationId],
  );
  if (!employee.rowCount) return null;
  const account = await pool.query("SELECT github_login, access_token FROM github_accounts WHERE user_id = $1", [request.auth.sub]);
  const projects = await pool.query(
    `SELECT p.id, p.project_code, p.name, p.description, p.repo_url, p.status, p.created_at, pm.role AS member_role,
       (SELECT count(*)::int FROM tasks t WHERE t.project_id = p.id) AS task_count
     FROM projects p JOIN project_members pm ON pm.project_id = p.id
     WHERE pm.employee_id = $1 ORDER BY p.created_at DESC`,
    [employee.rows[0].id],
  );
  return { employee: employee.rows[0], account: account.rows[0] || null, projects: projects.rows };
}

async function repoActivity(repoUrl, login, token) {
  const parsed = github.parseRepoUrl(repoUrl);
  if (!parsed) return { ok: false, reason: "no-repo", pullRequests: [], commits: [] };
  const pullRequests = [];
  const commits = [];
  const matchLogin = (value) => String(value || "").toLowerCase() === String(login || "").toLowerCase();
  for (let page = 1; page <= 2; page += 1) {
    const response = await github.listPullRequests(parsed.owner, parsed.repo, token, page).catch(() => null);
    if (!response || response.status !== 200 || !Array.isArray(response.data)) return { ok: false, reason: "github", pullRequests: [], commits: [] };
    pullRequests.push(...response.data);
    if (response.data.length < 100) break;
  }
  for (let page = 1; page <= 2; page += 1) {
    const response = await github.listCommits(parsed.owner, parsed.repo, token, login, page).catch(() => null);
    if (!response || response.status !== 200 || !Array.isArray(response.data)) return { ok: false, reason: "github", pullRequests: [], commits: [] };
    commits.push(...response.data);
    if (response.data.length < 100) break;
  }
  const mine = pullRequests.filter((pr) => matchLogin(pr.user?.login));
  const approved = [];
  for (const pr of mine.slice(0, 20)) {
    if (pr.merged_at) { approved.push(pr.number); continue; }
    const reviews = await github.listPullReviews(parsed.owner, parsed.repo, pr.number, token).catch(() => null);
    if (reviews?.status === 200 && Array.isArray(reviews.data) && reviews.data.some((review) => review.state === "APPROVED")) approved.push(pr.number);
  }
  const approvedSet = new Set(approved);
  return {
    ok: true,
    pullRequests: mine.map((pr) => ({
      number: pr.number, title: pr.title, state: pr.state, merged: Boolean(pr.merged_at),
      approved: approvedSet.has(pr.number), url: pr.html_url, createdAt: pr.created_at, closedAt: pr.closed_at, mergedAt: pr.merged_at,
    })),
    commits: commits
      .filter((commit) => commit.commit && (matchLogin(commit.author?.login) || matchLogin(commit.commit.author?.email?.split("@")[0])))
      .map((commit) => ({ sha: commit.sha, shortSha: String(commit.sha).slice(0, 7), message: commit.commit.message, url: commit.html_url, committedAt: commit.commit.author?.date, author: commit.author?.login || login })),
  };
}

function projectStats(activity, verifiedCount) {
  return {
    pullRequests: activity.pullRequests.length,
    approvedPullRequests: activity.pullRequests.filter((pr) => pr.approved).length,
    mergedPullRequests: activity.pullRequests.filter((pr) => pr.merged).length,
    openPullRequests: activity.pullRequests.filter((pr) => pr.state === "open").length,
    commits: activity.commits.length,
    verifiedCommits: verifiedCount,
  };
}

app.get("/api/development/summary", requireAuth, requireRole("employee"), async (request, response, next) => {
  try {
    const context = await developmentContext(request);
    if (!context) return response.status(404).json({ message: "Employee profile not found" });
    const { employee, account, projects } = context;
    const verifiedRows = await pool.query(
      `SELECT count(*)::int AS count FROM task_commits tc JOIN tasks t ON t.id = tc.task_id JOIN projects p ON p.id = t.project_id
       WHERE tc.employee_id = $1 AND p.id = ANY($2::uuid[])`,
      [employee.id, projects.map((project) => project.id)],
    );
    const verifiedByProject = await pool.query(
      `SELECT p.id, count(*)::int AS count FROM task_commits tc JOIN tasks t ON t.id = tc.task_id JOIN projects p ON p.id = t.project_id
       WHERE tc.employee_id = $1 AND p.id = ANY($2::uuid[]) GROUP BY p.id`,
      [employee.id, projects.map((project) => project.id)],
    );
    const verifiedMap = new Map(verifiedByProject.rows.map((row) => [row.id, row.count]));
    const recentActivity = [];
    let githubReachable = true;
    const projectRows = [];
    for (const project of projects) {
      let activity = { ok: true, pullRequests: [], commits: [] };
      if (project.repo_url && account) {
        activity = await repoActivity(project.repo_url, account.github_login, account.access_token);
        if (!activity.ok && activity.reason === "github") githubReachable = false;
        recentActivity.push(...activity.pullRequests.map((pr) => ({ type: "pull_request", title: pr.title, repo: project.name, url: pr.url, at: pr.createdAt, merged: pr.merged, approved: pr.approved, state: pr.state })));
        recentActivity.push(...activity.commits.map((commit) => ({ type: "commit", title: (commit.message || "").split("\n")[0], repo: project.name, url: commit.url, at: commit.committedAt, sha: commit.shortSha })));
      } else if (project.repo_url && !account) githubReachable = false;
      projectRows.push({
        id: project.project_code, name: project.name, description: project.description, repo: project.repo_url || null, status: project.status,
        memberRole: project.member_role, taskCount: project.task_count, ...projectStats(activity, verifiedMap.get(project.id) || 0),
      });
    }
    const totals = projectRows.reduce(
      (sum, row) => ({
        pullRequests: sum.pullRequests + row.pullRequests,
        approvedPullRequests: sum.approvedPullRequests + row.approvedPullRequests,
        mergedPullRequests: sum.mergedPullRequests + row.mergedPullRequests,
        openPullRequests: sum.openPullRequests + row.openPullRequests,
        commits: sum.commits + row.commits,
        verifiedCommits: sum.verifiedCommits + row.verifiedCommits,
      }),
      { pullRequests: 0, approvedPullRequests: 0, mergedPullRequests: 0, openPullRequests: 0, commits: 0, verifiedCommits: 0 },
    );
    recentActivity.sort((a, b) => new Date(b.at || 0) - new Date(a.at || 0));
    response.json({
      connected: Boolean(account), login: account?.github_login || null, githubReachable,
      totals, projects: projectRows,
      recentActivity: recentActivity.filter((item) => item.at).slice(0, 25),
      totalVerifiedCommits: verifiedRows.rows[0].count,
    });
  } catch (error) { next(error); }
});

app.get("/api/development/projects/:projectId/activity", requireAuth, requireRole("employee"), async (request, response, next) => {
  try {
    const context = await developmentContext(request);
    if (!context) return response.status(404).json({ message: "Employee profile not found" });
    const { employee, account, projects } = context;
    const project = projects.find((item) => item.project_code === request.params.projectId);
    if (!project) return response.status(404).json({ message: "Project not found" });
    let activity = { ok: true, pullRequests: [], commits: [] };
    if (project.repo_url && account) activity = await repoActivity(project.repo_url, account.github_login, account.access_token);
    const verified = await pool.query(
      `SELECT tc.commit_sha, tc.commit_url, tc.message, tc.author_login, tc.committed_at, tc.verified_at, t.task_code, t.title AS task_title
       FROM task_commits tc JOIN tasks t ON t.id = tc.task_id
       WHERE tc.employee_id = $1 AND t.project_id = $2 AND t.organization_id = $3
       ORDER BY coalesce(tc.committed_at, tc.verified_at) DESC`,
      [employee.id, project.id, request.auth.organizationId],
    );
    const tasks = await pool.query(
      `SELECT t.task_code, t.title, t.status, t.points, t.deadline,
         (SELECT count(*)::int FROM task_commits tc WHERE tc.task_id = t.id AND tc.employee_id = $1) AS commit_count
       FROM tasks t WHERE t.project_id = $2 AND t.employee_id = $1 ORDER BY t.created_at DESC`,
      [employee.id, project.id],
    );
    response.json({
      connected: Boolean(account), login: account?.github_login || null, githubReachable: activity.ok,
      project: { id: project.project_code, name: project.name, description: project.description, repo: project.repo_url || null, status: project.status, memberRole: project.member_role, taskCount: project.task_count },
      ...projectStats(activity, verified.rowCount),
      pullRequests: activity.pullRequests,
      commits: [
        ...activity.commits.map((commit) => ({ ...commit, verified: false, taskCode: null })),
        ...verified.rows.map((row) => ({ sha: row.commit_sha, shortSha: String(row.commit_sha).slice(0, 7), message: row.message, url: row.commit_url, committedAt: row.committed_at, author: row.author_login, verified: true, taskCode: row.task_code, taskTitle: row.task_title })),
      ].sort((a, b) => new Date(b.committedAt || 0) - new Date(a.committedAt || 0)),
      tasks: tasks.rows.map((row) => ({ id: row.task_code, title: row.title, status: row.status, points: Number(row.points), deadline: row.deadline, commitCount: row.commit_count })),
    });
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
