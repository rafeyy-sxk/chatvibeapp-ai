import bcrypt from "bcrypt";
import { env } from "../env";

export async function hashPassword(password) {
  return bcrypt.hash(password, env.bcryptRounds);
}

export async function verifyPassword(password, hash) {
  return bcrypt.compare(password, hash);
}

