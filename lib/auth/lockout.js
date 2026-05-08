import { addMinutes } from "date-fns";
import prisma from "../prisma";

const MAX_ATTEMPTS = 5;
const LOCK_DURATION_MIN = 15;

export async function registerFailedLogin(userId) {
  const user = await prisma.user.update({
    where: { id: userId },
    data: { failedLoginCount: { increment: 1 } },
  });

  if (user.failedLoginCount >= MAX_ATTEMPTS) {
    await prisma.user.update({
      where: { id: userId },
      data: { isLockedUntil: addMinutes(new Date(), LOCK_DURATION_MIN) },
    });
  }

  return user;
}

export async function resetFailedLogins(userId) {
  await prisma.user.update({
    where: { id: userId },
    data: { failedLoginCount: 0, isLockedUntil: null },
  });
}

export function isLocked(user) {
  if (!user?.isLockedUntil) return false;
  return new Date(user.isLockedUntil) > new Date();
}
