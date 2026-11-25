import crypto from "node:crypto";
import { config } from "./config.js";

const API_BASE = "https://api.github.com";

export function githubConfigured() {
  return Boolean(config.GITHUB_CLIENT_ID && config.GITHUB_CLIENT_SECRET);
}

export function defaultRedirectUri(origin) {
  return config.GITHUB_REDIRECT_URI || `${origin}/api/auth/github/callback`;
}

// Signed, expiring OAuth state so the unauthenticated callback can identify the user.
export function createOAuthState(userId) {
  const issuedAt = Date.now();
  const payload = `${userId}|${issuedAt}`;
  const signature = crypto.createHmac("sha256", config.JWT_ACCESS_SECRET).update(payload).digest("hex");
  return `${Buffer.from(payload).toString("base64url")}.${signature}`;
}

export function verifyOAuthState(state) {
  if (typeof state !== "string" || !state.includes(".")) return null;
  const [encoded, signature] = state.split(".");
  let payload;
  try {
    payload = Buffer.from(encoded, "base64url").toString("utf8");
  } catch {
    return null;
  }
  const expected = crypto.createHmac("sha256", config.JWT_ACCESS_SECRET).update(payload).digest("hex");
  const valid = signature.length === expected.length
    && crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  if (!valid) return null;
  const [userId, issuedAt] = payload.split("|");
  if (!userId || !issuedAt || Date.now() - Number(issuedAt) > 10 * 60 * 1000) return null;
  return userId;
}

export function authorizeUrl(redirectUri, state) {
  const params = new URLSearchParams({
    client_id: config.GITHUB_CLIENT_ID,
    redirect_uri: redirectUri,
    scope: "repo read:user",
    state,
    allow_signup: "false",
  });
  return `https://github.com/login/oauth/authorize?${params.toString()}`;
}

export async function exchangeCode(code, redirectUri) {
  const response = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      client_id: config.GITHUB_CLIENT_ID,
      client_secret: config.GITHUB_CLIENT_SECRET,
      code,
      redirect_uri: redirectUri,
    }),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok || !data?.access_token) {
    throw Object.assign(new Error(data?.error_description || "GitHub authorization failed"), { status: 400 });
  }
  return { accessToken: data.access_token, scope: data.scope || "" };
}

async function githubJson(path, token) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "zippio-kpi",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  const data = await response.json().catch(() => null);
  return { status: response.status, data };
}

export function parseRepoUrl(value) {
  const match = String(value || "").trim().match(/^https?:\/\/(?:www\.)?github\.com\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+?)(?:\.git)?\/?$/i);
  return match ? { owner: match[1], repo: match[2] } : null;
}

export function parseCommitUrl(value) {
  const match = String(value || "").trim().match(/^https?:\/\/(?:www\.)?github\.com\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)\/commit\/([0-9a-f]{7,40})\/?$/i);
  return match ? { owner: match[1], repo: match[2], sha: match[3] } : null;
}

export async function getCommit(owner, repo, sha, token = null) {
  return githubJson(`/repos/${owner}/${repo}/commits/${sha}`, token);
}

export async function getAuthenticatedUser(token) {
  return githubJson("/user", token);
}

export async function listPullRequests(owner, repo, token = null, page = 1) {
  return githubJson(`/repos/${owner}/${repo}/pulls?state=all&per_page=100&page=${page}`, token);
}

export async function listCommits(owner, repo, token = null, author = null, page = 1) {
  const authorQuery = author ? `&author=${encodeURIComponent(author)}` : "";
  return githubJson(`/repos/${owner}/${repo}/commits?per_page=100&page=${page}${authorQuery}`, token);
}

export async function listPullReviews(owner, repo, pullNumber, token = null) {
  return githubJson(`/repos/${owner}/${repo}/pulls/${pullNumber}/reviews?per_page=100`, token);
}

export async function createRepository(token, options = {}) {
  const payload = {
    name: options.name,
    description: options.description || undefined,
    private: options.private !== false,
    auto_init: options.autoInit !== false,
    ...(options.gitignoreTemplate ? { gitignore_template: options.gitignoreTemplate } : {}),
    ...(options.licenseTemplate ? { license_template: options.licenseTemplate } : {}),
  };
  const response = await fetch(`${API_BASE}/user/repos`, {
    method: "POST",
    headers: {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "zippio-kpi",
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(payload),
  });
  const data = await response.json().catch(() => null);
  const status = response.status === 201 ? "created" : response.status === 422 ? "name-taken" : response.status === 401 ? "token-invalid" : response.status === 403 ? "forbidden" : "failed";
  return { status, httpStatus: response.status, data, repoUrl: data?.html_url || null, fullName: data?.full_name || null };
}

export async function inviteCollaborator(owner, repo, username, permission = "push", token = null) {
  const response = await fetch(`${API_BASE}/repos/${owner}/${repo}/collaborators/${encodeURIComponent(username)}`, {
    method: "PUT",
    headers: {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "zippio-kpi",
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ permission }),
  });
  const data = await response.json().catch(() => null);
  const status = response.status === 201 ? "invited"
    : response.status === 204 ? "already-collaborator"
    : response.status === 403 ? "no-access"
    : response.status === 404 ? "not-found"
    : "failed";
  return { status, httpStatus: response.status, data };
}

export function sameRepo(urlA, urlB) {
  const a = parseRepoUrl(urlA) || parseCommitUrl(urlA);
  const b = parseRepoUrl(urlB) || parseCommitUrl(urlB);
  if (!a || !b) return false;
  return a.owner.toLowerCase() === b.owner.toLowerCase() && a.repo.toLowerCase() === b.repo.toLowerCase();
}
