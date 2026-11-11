import crypto from "node:crypto";
import { verifyAccessToken } from "./security/auth.js";

export function requestContext(request, response, next) {
  request.requestId = request.headers["x-request-id"] || crypto.randomUUID();
  response.setHeader("x-request-id", request.requestId);
  next();
}

export function requireAuth(request, response, next) {
  const header = request.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) return response.status(401).json({ message: "Authentication required" });
  try {
    request.auth = verifyAccessToken(token);
    next();
  } catch {
    response.status(401).json({ message: "Invalid or expired access token" });
  }
}

export function requireRole(...roles) {
  return (request, response, next) => {
    if (!roles.includes(request.auth?.role)) return response.status(403).json({ message: "You do not have permission for this action" });
    next();
  };
}
