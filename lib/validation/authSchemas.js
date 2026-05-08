import { z } from "zod";

export const signupSchema = z.object({
  username: z.string().min(3).max(32).optional(),
  email: z.string().email().optional().or(z.literal("")),
  password: z.string().min(8).max(128),
}).refine((d) => d.username || d.email, { message: "username or email required" });

export const loginSchema = z.object({
  username: z.string().min(1).optional(),
  email: z.string().email().optional(),
  password: z.string().min(1),
}).refine((d) => d.username || d.email, { message: "username or email required" });

export const resetRequestSchema = z.object({
  usernameOrEmail: z.string().min(3),
});

export const resetSchema = z.object({
  token: z.string().min(10),
  password: z.string().min(8),
});
