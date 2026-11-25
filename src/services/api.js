const API_URL = (import.meta.env.VITE_API_URL || (import.meta.env.PROD ? "/api" : "http://localhost:4000/api")).replace(/\/$/, "");
let accessToken = sessionStorage.getItem("zippio_access_token");

async function rawRequest(path, options = {}) {
  const headers = options.body instanceof FormData ? { ...options.headers } : { "Content-Type": "application/json", ...options.headers };
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  const response = await fetch(`${API_URL}${path}`, { cache: "no-store", ...options, headers });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const issues = Array.isArray(payload?.issues) && payload.issues.length
      ? ` (${payload.issues.map((issue) => `${issue.path.join(".") || "request"}: ${issue.message}`).join("; ")})`
      : "";
    throw new Error(`${payload?.message || `Request failed with status ${response.status}`}${issues}`);
  }
  return payload;
}

async function request(path, options) {
  try {
    return await rawRequest(path, options);
  } catch (error) {
    if (!String(error.message).includes("expired") && !String(error.message).includes("Authentication required")) throw error;
    const refreshToken = sessionStorage.getItem("zippio_refresh_token");
    if (!refreshToken) throw error;
    const result = await rawRequest("/auth/refresh", { method: "POST", body: JSON.stringify({ refreshToken }) });
    accessToken = result.token;
    sessionStorage.setItem("zippio_access_token", accessToken);
    sessionStorage.setItem("zippio_refresh_token", result.refreshToken);
    return rawRequest(path, options);
  }
}

export const api = {
  projects: {
    list: () => request("/projects"),
    create: (payload) => request("/projects", { method: "POST", body: JSON.stringify(payload) }),
    overview: (id) => request(`/projects/${id}/overview`),
    remove: (id) => request(`/projects/${id}`, { method: "DELETE" }),
    createRepo: (payload) => request("/projects/github-repos", { method: "POST", body: JSON.stringify(payload) }),
    update: (id, payload) => request(`/projects/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
    addMember: (id, employeeId) => request(`/projects/${id}/members`, { method: "POST", body: JSON.stringify({ employeeId }) }),
    removeMember: (id, employeeId) => request(`/projects/${id}/members/${employeeId}`, { method: "DELETE" }),
    sendRepoInvites: (id) => request(`/projects/${id}/repo-invites`, { method: "POST" }),
  },
  commits: {
    list: (taskId) => request(`/tasks/${taskId}/commits`),
    verify: (taskId, commitUrl) => request(`/tasks/${taskId}/commits`, { method: "POST", body: JSON.stringify({ commitUrl }) }),
  },
  github: {
    status: () => request("/auth/github"),
    start: () => request("/auth/github/start"),
    disconnect: () => request("/auth/github", { method: "DELETE" }),
  },
  account: {
    profile: () => request("/auth/profile"),
    updateProfile: (payload) => request("/auth/profile", { method: "PATCH", body: JSON.stringify(payload) }),
    changePassword: (currentPassword, newPassword) => request("/auth/password", { method: "POST", body: JSON.stringify({ currentPassword, newPassword }) }),
  },
  development: {
    summary: () => request("/development/summary"),
    project: (projectId) => request(`/development/projects/${projectId}/activity`),
  },
  employees: { list: () => request("/employees"), get: (id) => request(`/employees/${id}`), create: (payload) => request("/employees", { method: "POST", body: JSON.stringify(payload) }) },
  tasks: {
    list: () => request("/tasks"),
    create: (payload) => request("/tasks", { method: "POST", body: JSON.stringify(payload) }),
    update: (id, payload) => request(`/tasks/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
    addLink: (id, payload) => request(`/tasks/${id}/links`, { method: "POST", body: JSON.stringify(payload) }),
  },
  hrRequests: {
    list: () => request("/hr-requests"),
    get: (id) => request(`/hr-requests/${id}`),
    create: (payload) => request("/hr-requests", { method: "POST", body: JSON.stringify(payload) }),
    update: (id, payload) => request(`/hr-requests/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
    comments: (id) => request(`/hr-requests/${id}/comments`),
    addComment: (id, body) => request(`/hr-requests/${id}/comments`, { method: "POST", body: JSON.stringify({ body }) }),
  },
  support: {
    list: () => request("/support/tickets"),
    create: (payload) => request("/support/tickets", { method: "POST", body: JSON.stringify(payload) }),
    update: (id, payload) => request(`/support/tickets/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  },
  reviews: {
    list: (taskId) => request(`/tasks/${taskId}/reviews`),
    submit: (taskId, payload) => request(`/tasks/${taskId}/reviews`, { method: "POST", body: JSON.stringify(payload) }),
  },
  delegations: {
    list: () => request("/delegations"),
    create: (payload) => request("/delegations", { method: "POST", body: JSON.stringify(payload) }),
    review: (id, payload) => request(`/delegations/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  },
  attendance: {
    list: () => request("/attendance"),
    checkIn: () => request("/attendance/check-in", { method: "POST" }),
    checkOut: () => request("/attendance/check-out", { method: "POST" }),
  },
  leave: {
    list: () => request("/leave-requests"),
    create: (payload) => request("/leave-requests", { method: "POST", body: JSON.stringify(payload) }),
    types: () => request("/leave-types"),
    balances: (employeeId) => request(`/leave-balances/${employeeId}`),
    review: (id, payload) => request(`/leave-requests/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  },
  performance: {
    get: (employeeId) => request(`/performance/${employeeId}`),
    cycles: () => request("/performance/cycles"),
    createCycle: (payload) => request("/performance/cycles", { method: "POST", body: JSON.stringify(payload) }),
    saveScores: (cycleId, employeeId, payload) => request(`/performance/cycles/${cycleId}/employees/${employeeId}`, { method: "PUT", body: JSON.stringify(payload) }),
  },
  reports: { summary: () => request("/reports/summary") },
  privacy: {
    list: () => request("/privacy/requests"),
    create: (payload) => request("/privacy/requests", { method: "POST", body: JSON.stringify(payload) }),
    update: (id, payload) => request(`/privacy/requests/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  },
  attachments: {
    upload: (taskId, file) => {
      const body = new FormData();
      body.append("file", file);
      return request(`/tasks/${taskId}/attachment`, { method: "POST", body });
    },
    list: (taskId) => request(`/tasks/${taskId}/attachments`),
    download: async (taskId, attachmentId) => {
      const response = await fetch(`${API_URL}/tasks/${taskId}/attachments/${attachmentId}`, {
        cache: "no-store",
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.message || `Download failed with status ${response.status}`);
      }
      return response.blob();
    },
  },
  auth: {
    employees: () => rawRequest("/auth/employees"),
    login: async ({ role, userId, email, password }) => {
      const credentials = role === "employee" && !email ? { role, userId, password } : { email, password };
      const result = await rawRequest("/auth/login", { method: "POST", body: JSON.stringify(credentials) });
      accessToken = result.token;
      sessionStorage.setItem("zippio_access_token", accessToken);
      if (result.refreshToken) sessionStorage.setItem("zippio_refresh_token", result.refreshToken);
      const resolvedRole = result.user?.role || role;
      const resolvedUserId = userId || result.user?.userId || result.user?.id;
      return { ...result, user: { ...result.user, role: resolvedRole, userId: resolvedUserId } };
    },
    logout: async () => {
      try {
        if (accessToken) await request("/auth/logout", { method: "POST", body: JSON.stringify({ refreshToken: sessionStorage.getItem("zippio_refresh_token") }) });
      } finally {
        accessToken = null;
        sessionStorage.removeItem("zippio_access_token");
        sessionStorage.removeItem("zippio_refresh_token");
        sessionStorage.removeItem("zippio_session");
      }
    },
  },
};
