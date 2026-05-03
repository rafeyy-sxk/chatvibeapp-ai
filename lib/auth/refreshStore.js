import { addSeconds } from "date-fns";
import prisma from "../prisma";
import { hashToken, secondsFromExpiry } from "./tokens";

export async function persistRefreshToken({ userId, token, fingerprint }) {
  const expiresAt = addSeconds(new Date(), secondsFromExpiry(process.env.REFRESH_TOKEN_EXPIRY || "7d"));
  return prisma.refreshToken.create({
    data: {
      userId,
      tokenHash: hashToken(token),
      expiresAt,
      fingerprint,
    },
  });
}

export async function revokeRefreshToken(token) {
  const tokenHash = hashToken(token);
  return prisma.refreshToken.updateMany({
    where: { tokenHash, revoked: false },
    data: { revoked: true },
  });
}

export async function findValidRefreshToken(token) {
  const tokenHash = hashToken(token);
  return prisma.refreshToken.findFirst({
    where: { tokenHash, revoked: false, expiresAt: { gt: new Date() } },
    include: { user: true },
  });
}

