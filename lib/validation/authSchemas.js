import { z } from "zod";

export const signupSchema = z.object({
  username: z.string().min(3).max(32),
  email: z.string().email().optional().or(z.literal("")),
  password: z.string().min(8).max(128),
});

export const loginSchema = z.object({
  username: z.string().min(3),
  password: z.string().min(8),
});

export const resetRequestSchema = z.object({
  usernameOrEmail: z.string().min(3),
});

export const resetSchema = z.object({
  token: z.string().min(10),
  password: z.string().min(8),
});

