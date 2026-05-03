import jwt from "jsonwebtoken";
import crypto from "crypto";
import { env } from "../env";

const parseExpiry = (exp) => {
  if (typeof exp === "number") return exp;
  if (exp.endsWith("m")) return parseInt(exp, 10) * 60;
  if (exp.endsWith("h")) return parseInt(exp, 10) * 60 * 60;
  if (exp.endsWith("d")) return parseInt(exp, 10) * 60 * 60 * 24;
  return 60 * 15; // default 15 minutes
};

export function generateAccessToken(payload) {
  return jwt.sign(payload, env.jwtSecret, { expiresIn: env.accessTokenExpiry });
}

export function generateRefreshToken(payload) {
  return jwt.sign(payload, env.refreshSecret, { expiresIn: env.refreshTokenExpiry });
}

export function verifyAccessToken(token) {
  return jwt.verify(token, env.jwtSecret);
}

export function verifyRefreshToken(token) {
  return jwt.verify(token, env.refreshSecret);
}

export function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function secondsFromExpiry(expiry) {
  return parseExpiry(expiry);
}

