/* ============================================================
   ZIPPIO — API layer (the Laravel swap-in seam)
   Every function mirrors a future REST endpoint on the Laravel
   backend. Today each one resolves from the shared mock data so
   the UI works fully offline. When the backend is deployed,
   replace the body with the real call, e.g.:
     list: () => get('/employees'),
     create: (data) => post('/employees', data),
   ============================================================ */
import {
  employees, departments, users, auditLogs, roles,
  demoAccounts, me, KPIS, MONTHS, findById, initials,
} from '../data/mock';

const delay = (d = 150) => new Promise((r) => setTimeout(r, d));

export const api = {
  // ---------- AUTH ----------
  auth: {
    // POST /api/auth/login  → { token, user }
    async login({ email }) {
      await delay();
      const account = demoAccounts.find((a) => a.email === email);
      if (!account) throw new Error('Invalid credentials');
      const user = users.find((u) => u.email === email) || {
        name: account.label === 'Employee' ? me.name : account.label,
        email,
        role: account.role,
      };
      return { token: `demo-token-${account.role}`, user };
    },
  },

  // ---------- EMPLOYEES ----------
  // GET /api/employees · POST /api/employees · PUT /api/employees/:id · DELETE /api/employees/:id
  employees: {
    list: () => Promise.resolve(employees),
    get: (id) => Promise.resolve(findById(id)),
    create: (emp) => Promise.resolve(emp),
    update: (emp) => Promise.resolve(emp),
    remove: (id) => Promise.resolve(id),
  },

  // ---------- DEPARTMENTS ----------
  departments: {
    list: () => Promise.resolve(departments),
    create: (dept) => Promise.resolve(dept),
    remove: (name) => Promise.resolve(name),
  },

  // ---------- KPIs ----------
  kpis: {
    list: () => Promise.resolve(KPIS),
    save: (kpis) => Promise.resolve(kpis),
  },

  // ---------- USERS / ROLES ----------
  users: {
    list: () => Promise.resolve(users),
    roles: () => Promise.resolve(roles),
    create: (user) => Promise.resolve(user),
    updateRole: (email, role) => Promise.resolve({ email, role }),
    toggleStatus: (email) => Promise.resolve(email),
  },

  // ---------- AUDIT ----------
  audit: {
    list: () => Promise.resolve(auditLogs),
  },

  // ---------- META ----------
  meta: {
    months: () => Promise.resolve(MONTHS),
    currentUser: () => Promise.resolve(me),
    initials: (name) => initials(name),
  },
};
