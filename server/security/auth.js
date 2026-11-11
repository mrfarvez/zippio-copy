import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import { config } from "../config.js";

export function issueAccessToken(user) {
  return jwt.sign({ sub: user.id, organizationId: user.organization_id, role: user.role }, config.JWT_ACCESS_SECRET, { expiresIn: config.JWT_ACCESS_TTL });
}

export function issueRefreshToken() {
  return crypto.randomBytes(48).toString("base64url");
}

export function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function verifyAccessToken(token) {
  return jwt.verify(token, config.JWT_ACCESS_SECRET);
}
