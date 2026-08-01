/* ============================================================
   ZIPPIO — demo data + scoring engine (React)
   All numbers live here. When the Laravel backend + standard
   database are ready, swap the api/ layer and this file becomes
   the source of the mock/dev fallback only.
   ============================================================ */

// ---------- 1. KPI CONFIG (weight total MUST equal 100) ----------
export const KPIS = [
  { key: 'task', name: 'Task Completion', weight: 35, color: '#35D0A0' },
  { key: 'quality', name: 'Quality', weight: 25, color: '#F4B740' },
  { key: 'teamwork', name: 'Teamwork', weight: 15, color: '#F2924A' },
  { key: 'innovation', name: 'Innovation', weight: 15, color: '#8FD14F' },
  { key: 'attendance', name: 'Attendance', weight: 10, color: '#FF6B57' },
];

// ---------- 2. SCORING ENGINE (SRS ch.5) ----------
export const LEVEL_BONUS = { A: 90, B: 64, C: 40, D: 20, E: 0 };
export const LEVEL_RANGE = [
  { level: 'A', min: 90, max: 100 },
  { level: 'B', min: 80, max: 89 },
  { level: 'C', min: 70, max: 79 },
  { level: 'D', min: 60, max: 69 },
  { level: 'E', min: 0, max: 59 },
];

export function scoreOf(cycle) {
  if (!cycle) return 0;
  return Math.round(KPIS.reduce((sum, k) => sum + (cycle[k.key] || 0) * k.weight, 0) / 100);
}
export function levelOf(score) {
  for (const r of LEVEL_RANGE) if (score >= r.min && score <= r.max) return r.level;
  return 'E';
}
// Incremental points: (score * 4) + level bonus. Calibrated so
// Farvez's Aug cycle = +412 and lifetime total = 2,140 (matches mockup).
export function pointsOf(cycle) {
  if (!cycle) return 0;
  return Math.round(scoreOf(cycle) * 4) + LEVEL_BONUS[levelOf(scoreOf(cycle))];
}
export function totalPoints(emp) {
  return (emp.cycles || []).reduce((sum, c) => sum + pointsOf(c), 0);
}
export function levelColor(level) {
  return { A: '#35D0A0', B: '#F4B740', C: '#F2924A', D: '#FF6B57', E: '#8B9AA8' }[level] || '#8B9AA8';
}
export function promotionStatus(emp) {
  const last3 = (emp.cycles || []).slice(-3).map(scoreOf);
  const eligible = last3.length === 3 && last3.every((s) => s >= 90);
  return { eligible, scores: last3 };
}
export function bonusOf(emp) {
  const rate = { A: 30, B: 20, C: 12, D: 6, E: 0 }[levelOf(scoreOf(lastCycle(emp)))];
  return Math.round((totalPoints(emp) * rate) / 500) * 500;
}
export function lastCycle(emp) {
  const arr = emp.cycles || [];
  return arr[arr.length - 1] || null;
}
export function delta(emp) {
  const arr = emp.cycles || [];
  if (arr.length < 2) return 0;
  return scoreOf(arr[arr.length - 1]) - scoreOf(arr[arr.length - 2]);
}
export function initials(name) {
  return name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
}
export function fmt(n) {
  return Number(n).toLocaleString('en-US');
}

// ---------- 3. MONTHS / CYCLE CONTEXT ----------
export const MONTHS = ['Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug'];
export const currentMonth = MONTHS[MONTHS.length - 1];

// deterministic RNG so regenerated demo data stays stable
function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6d2b79f5 | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------- 4. EMPLOYEES ----------
// Farvez is hardcoded so the dashboard matches the approved mockup exactly.
const employeesBase = [
  {
    id: 'emp-01', name: 'Farvez Rakib', role: 'Software Engineer', dept: 'Engineering',
    manager: 'Tahmid Hasan', joined: 'Jan 2024',
    cycles: [
      { task: 64, quality: 66, teamwork: 62, innovation: 58, attendance: 80, comment: 'Solid ramp-up period. Onboarding completed ahead of schedule.' },
      { task: 69, quality: 71, teamwork: 67, innovation: 63, attendance: 86, comment: 'Delivered sprint scope on time; documentation improved.' },
      { task: 74, quality: 76, teamwork: 72, innovation: 68, attendance: 92, comment: 'Took ownership of the auth module refactor.' },
      { task: 80, quality: 81, teamwork: 77, innovation: 74, attendance: 94, comment: 'Led the API migration. Strong code reviews.' },
      { task: 85, quality: 86, teamwork: 81, innovation: 78, attendance: 98, comment: 'Mentored two juniors; shipped reports feature early.' },
      { task: 87, quality: 88, teamwork: 83, innovation: 82, attendance: 100, comment: 'Consistent B-level performance, trending toward Level A.' },
    ],
  },
  { id: 'emp-02', name: 'Tahmid Hasan', role: 'Senior Software Engineer', dept: 'Engineering', manager: 'Sadia Rahman', joined: 'Mar 2022', strength: 0.94 },
  { id: 'emp-03', name: 'Nusrat Jahan', role: 'QA Engineer', dept: 'Engineering', manager: 'Tahmid Hasan', joined: 'Sep 2023', strength: 0.78 },
  { id: 'emp-04', name: 'Arif Chowdhury', role: 'DevOps Engineer', dept: 'Engineering', manager: 'Tahmid Hasan', joined: 'Jun 2023', strength: 0.72 },
  { id: 'emp-05', name: 'Sumaiya Islam', role: 'UI/UX Designer', dept: 'Design', manager: 'Sadia Rahman', joined: 'Feb 2022', strength: 0.9 },
  { id: 'emp-06', name: 'Rafi Ahmed', role: 'Product Designer', dept: 'Design', manager: 'Sadia Rahman', joined: 'Nov 2023', strength: 0.68 },
  { id: 'emp-07', name: 'Sadia Rahman', role: 'HR Manager', dept: 'HR', manager: 'Admin', joined: 'Aug 2021', strength: 0.97 },
  { id: 'emp-08', name: 'Tanvir Mahmud', role: 'HR Executive', dept: 'HR', manager: 'Sadia Rahman', joined: 'Apr 2023', strength: 0.8 },
  { id: 'emp-09', name: 'Mehedi Hasan', role: 'Sales Lead', dept: 'Sales', manager: 'Sadia Rahman', joined: 'Oct 2022', strength: 0.84 },
  { id: 'emp-10', name: 'Imran Hossain', role: 'Sales Executive', dept: 'Sales', manager: 'Mehedi Hasan', joined: 'Jan 2024', strength: 0.63 },
];

// generate deterministic cycles for non-hardcoded employees
employeesBase.forEach((emp, idx) => {
  if (emp.cycles) return;
  const rnd = mulberry32(1000 + idx * 77);
  const cycles = [];
  for (let m = 0; m < MONTHS.length; m++) {
    const drift = (m - (MONTHS.length - 1)) * 1.6;
    const cycle = {};
    KPIS.forEach((k) => {
      const v = Math.round(emp.strength * 100 + (rnd() * 14 - 7) + drift);
      cycle[k.key] = Math.max(42, Math.min(100, v));
    });
    cycle.comment = ['On track with goals.', 'Good contribution to the team.', 'Delivered expected results.',
      'Strong and consistent output.', 'Exceeded expectations this cycle.'][Math.floor(rnd() * 5)];
    cycles.push(cycle);
  }
  emp.cycles = cycles;
});

// computed snapshots
employeesBase.forEach((emp) => {
  emp.current = {
    score: scoreOf(lastCycle(emp)),
    level: levelOf(scoreOf(lastCycle(emp))),
    points: pointsOf(lastCycle(emp)),
    delta: delta(emp),
    total: totalPoints(emp),
    prevScore: scoreOf((emp.cycles || [])[(emp.cycles || []).length - 2] || lastCycle(emp)),
  };
  emp.promotion = promotionStatus(emp);
  emp.bonus = bonusOf(emp);
});

// sort desc by current score for standings
export const employees = employeesBase.slice().sort((a, b) => b.current.score - a.current.score);
employees.forEach((emp, i) => { emp.rank = i + 1; });

export const ME_ID = 'emp-01'; // Farvez Rakib
export const me = employees.find((e) => e.id === ME_ID);

// ---------- 5. DEPARTMENTS ----------
export const departments = [
  { name: 'Engineering', head: 'Tahmid Hasan', color: '#35D0A0' },
  { name: 'Design', head: 'Sumaiya Islam', color: '#F4B740' },
  { name: 'HR', head: 'Sadia Rahman', color: '#F2924A' },
  { name: 'Sales', head: 'Mehedi Hasan', color: '#FF6B57' },
];
departments.forEach((d) => {
  d.members = employees.filter((e) => e.dept === d.name);
  d.avg = Math.round(d.members.reduce((s, e) => s + e.current.score, 0) / d.members.length);
});

// ---------- 6. USERS / ROLES (RBAC demo) ----------
export const roles = [
  { key: 'super-admin', label: 'Super Admin', color: '#35D0A0', home: '/admin/users' },
  { key: 'hr', label: 'HR Manager', color: '#F4B740', home: '/admin/employees' },
  { key: 'manager', label: 'Department Manager', color: '#F2924A', home: '/team' },
  { key: 'employee', label: 'Employee', color: '#8FD14F', home: '/dashboard' },
];

export const users = [
  { name: 'Admin', email: 'admin@zippio.io', role: 'super-admin', status: 'Active', last: '2 min ago' },
  { name: 'Sadia Rahman', email: 'sadia@zippio.io', role: 'hr', status: 'Active', last: '1 hr ago' },
  { name: 'Tahmid Hasan', email: 'tahmid@zippio.io', role: 'manager', status: 'Active', last: '35 min ago' },
  { name: 'Mehedi Hasan', email: 'mehedi@zippio.io', role: 'manager', status: 'Active', last: '3 hrs ago' },
  { name: 'Farvez Rakib', email: 'farvez@zippio.io', role: 'employee', status: 'Active', last: '5 min ago' },
  { name: 'Nusrat Jahan', email: 'nusrat@zippio.io', role: 'employee', status: 'Active', last: 'Yesterday' },
  { name: 'Rafi Ahmed', email: 'rafi@zippio.io', role: 'employee', status: 'Suspended', last: '12 days ago' },
  { name: 'Imran Hossain', email: 'imran@zippio.io', role: 'employee', status: 'Active', last: '2 hrs ago' },
];

export const demoAccounts = [
  { label: 'Employee', email: 'farvez@zippio.io', password: 'demo1234', role: 'employee' },
  { label: 'Manager', email: 'tahmid@zippio.io', password: 'demo1234', role: 'manager' },
  { label: 'HR', email: 'sadia@zippio.io', password: 'demo1234', role: 'hr' },
  { label: 'Admin', email: 'admin@zippio.io', password: 'demo1234', role: 'super-admin' },
];

// ---------- 7. AUDIT LOGS ----------
export const auditLogs = [
  { time: 'Aug 02, 2026 · 09:41', actor: 'Tahmid Hasan', action: 'Submitted evaluation', target: 'Nusrat Jahan · Aug cycle' },
  { time: 'Aug 02, 2026 · 09:12', actor: 'Sadia Rahman', action: 'Approved evaluation', target: 'Farvez Rakib · Aug cycle' },
  { time: 'Aug 01, 2026 · 17:05', actor: 'Admin', action: 'Updated KPI weights', target: 'Task Completion 35% → 35%' },
  { time: 'Aug 01, 2026 · 14:22', actor: 'Sadia Rahman', action: 'Closed evaluation period', target: 'Jul 2026' },
  { time: 'Jul 31, 2026 · 11:48', actor: 'Admin', action: 'Created user', target: 'imran@zippio.io' },
  { time: 'Jul 30, 2026 · 16:30', actor: 'Mehedi Hasan', action: 'Submitted evaluation', target: 'Imran Hossain · Jul cycle' },
  { time: 'Jul 29, 2026 · 10:02', actor: 'Sadia Rahman', action: 'Generated promotion report', target: 'Q3 2026' },
  { time: 'Jul 28, 2026 · 15:17', actor: 'Admin', action: 'Suspended user', target: 'rafi@zippio.io' },
  { time: 'Jul 26, 2026 · 09:55', actor: 'Tahmid Hasan', action: 'Added employee', target: 'Nusrat Jahan' },
  { time: 'Jul 25, 2026 · 12:40', actor: 'Sadia Rahman', action: 'Created department', target: 'Sales' },
];

// ---------- 8. NOTIFICATIONS (demo) ----------
export const notifications = [
  { text: 'Your Aug evaluation was approved by Tahmid Hasan.', time: '09:12 today' },
  { text: 'You are 3 points away from Level A.', time: '08:00 today' },
  { text: 'Promotion track updated: 2 of 3 cycles complete.', time: 'Yesterday' },
  { text: 'New cycle opened — evaluations due Aug 31.', time: 'Aug 01' },
];

export const findById = (id) => employees.find((e) => e.id === id);

export const Z = {
  KPIS, LEVEL_RANGE, LEVEL_BONUS, MONTHS, currentMonth,
  me, employees, departments, roles, users, auditLogs, notifications, demoAccounts,
  scoreOf, levelOf, pointsOf, totalPoints, levelColor,
  promotionStatus, bonusOf, lastCycle, delta, initials, fmt, findById,
};
