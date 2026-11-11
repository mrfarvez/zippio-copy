import { pool } from "./pool.js";
import { hashPassword } from "../security/password.js";

const client = await pool.connect();
try {
  await client.query("BEGIN");
  const organization = await client.query(
    `INSERT INTO organizations (name, slug) VALUES ('Acme workspace', 'acme')
     ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
     RETURNING id`,
  );
  const organizationId = organization.rows[0].id;
  const roles = ["manager", "employee", "hr"];
  for (const role of roles) {
    await client.query("INSERT INTO roles (organization_id, name) VALUES ($1, $2) ON CONFLICT (organization_id, name) DO NOTHING", [organizationId, role]);
  }
  const departments = [
    ["Development", "Nadia Karim"],
    ["Engineering", "Ayesha Rahman"],
    ["Design", "Sadia Ahmed"],
    ["Marketing", "Tanvir Hasan"],
    ["Accounts", "Moin Uddin"],
  ];
  for (const [name, managerName] of departments) {
    await client.query("INSERT INTO departments (organization_id, name, manager_name) VALUES ($1, $2, $3) ON CONFLICT (organization_id, name) DO NOTHING", [organizationId, name, managerName]);
  }
  const departmentIds = Object.fromEntries((await client.query("SELECT name, id FROM departments WHERE organization_id = $1", [organizationId])).rows.map((row) => [row.name, row.id]));
  const demoUsers = [
    ["manager@zippio.com", "Ayesha Rahman", "manager"],
    ["rahim@zippio.com", "Rahim Uddin", "employee"],
    ["nusrat@zippio.com", "Nusrat Jahan", "employee"],
    ["imran@zippio.com", "Imran Hossain", "employee"],
    ["hr@zippio.com", "Ayesha Rahman", "hr"],
  ];
  for (const [email, displayName, roleName] of demoUsers) {
    const role = await client.query("SELECT id FROM roles WHERE organization_id = $1 AND name = $2", [organizationId, roleName]);
    const user = await client.query(
      `INSERT INTO users (organization_id, email, display_name, role_id) VALUES ($1, $2, $3, $4)
       ON CONFLICT (organization_id, email) DO UPDATE SET display_name = EXCLUDED.display_name
       RETURNING id`,
      [organizationId, email, displayName, role.rows[0].id],
    );
    await client.query("INSERT INTO password_credentials (user_id, password_hash) VALUES ($1, $2) ON CONFLICT (user_id) DO NOTHING", [user.rows[0].id, await hashPassword("password")]);
  }
  const employees = [
    ["e1", "Rahim Uddin", "Product designer", "rahim@zippio.com", "Design", 140, [88, 84, 78, 92, 85]],
    ["e2", "Nusrat Jahan", "Senior engineer", "nusrat@zippio.com", "Engineering", 520, [93, 90, 86, 94, 91]],
    ["e3", "Imran Hossain", "QA engineer", "imran@zippio.com", "Engineering", 60, [72, 68, 70, 80, 74]],
  ];
  for (const [code, name, title, email, department, points, scores] of employees) {
    const user = await client.query("SELECT id FROM users WHERE organization_id = $1 AND email = $2", [organizationId, email]);
    await client.query(
      `INSERT INTO employees (organization_id, user_id, department_id, employee_code, name, title, email, points, scores)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (organization_id, employee_code) DO UPDATE SET points = EXCLUDED.points, scores = EXCLUDED.scores`,
      [organizationId, user.rows[0].id, departmentIds[department], code, name, title, email, points, JSON.stringify(scores)],
    );
  }
  const employeeIds = Object.fromEntries((await client.query("SELECT employee_code, id FROM employees WHERE organization_id = $1", [organizationId])).rows.map((row) => [row.employee_code, row.id]));
  const demoTasks = [
    ["ZP-101", "Design login page", "e1", "High", 6, 20, "2026-11-08", "todo"],
    ["ZP-102", "Fix dashboard API bug", "e1", "Critical", 3, 15, "2026-11-07", "progress"],
    ["ZP-103", "Write onboarding docs", "e1", "Low", 4, 10, "2026-11-12", "review"],
    ["ZP-104", "Build report export", "e2", "Medium", 8, 25, "2026-11-10", "todo"],
    ["ZP-105", "Test payment module", "e3", "High", 5, 20, "2026-11-09", "review"],
  ];
  for (const [code, title, employeeCode, priority, hours, points, deadline, status] of demoTasks) {
    await client.query(
      `INSERT INTO tasks (organization_id, task_code, title, employee_id, priority, hours, points, deadline, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (organization_id, task_code) DO NOTHING`,
      [organizationId, code, title, employeeIds[employeeCode], priority, hours, points, deadline, status],
    );
  }
  const hrSeed = [
    ["HR-101", "Development", "2 Developers", "Manpower request", "In progress", 68, "High", "2026-11-18"],
    ["HR-102", "Marketing", "1 Marketing Executive", "Recruitment request", "Pending approval", 18, "Medium", "2026-11-22"],
    ["HR-103", "Accounts", "1 Accountant", "Manpower request", "Completed", 100, "Low", "2026-11-08"],
    ["HR-104", "Engineering", "MacBook Pro 14-inch", "Equipment request", "In progress", 44, "Medium", "2026-11-15"],
    ["HR-105", "Design", "UX research training", "Training request", "Pending approval", 10, "Low", "2026-11-28"],
  ];
  for (const [code, department, requirement, type, status, progress, priority, deadline] of hrSeed) {
    await client.query(
      `INSERT INTO hr_requests (organization_id, request_code, department_id, requirement, type, status, progress, priority, deadline)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (organization_id, request_code) DO NOTHING`,
      [organizationId, code, departmentIds[department], requirement, type, status, progress, priority, deadline],
    );
  }
  await client.query("COMMIT");
  console.log("Development seed complete");
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
} finally {
  client.release();
  await pool.end();
}
