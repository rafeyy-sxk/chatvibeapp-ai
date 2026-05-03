import { env } from "./env";

export async function sendPasswordResetEmail({ to, token, name }) {
  const origin = env.frontendOrigin || "http://localhost:3000";
  const resetLink = `${origin.replace(/\/+$/, "")}/reset-password?token=${encodeURIComponent(token)}`;

  const subject = "Reset Your ChatVibe Password";
  const body = `Hi ${name || ""}${
    name ? "" : ""
  },

We received a request to reset the password for your ChatVibe account.

If you made this request, click the button below to create a new password:

Reset Password → ${resetLink}

This link will expire in 15 minutes for security reasons.

If you did not request a password reset, you can safely ignore this email—your account is still secure.

Stay safe,
The ChatVibe Team
`;

  // Currently we log emails; production can plug in SMTP using env.smtpHost/smtpUser.
  // eslint-disable-next-line no-console
  console.info("[email] Password reset", { to, subject, body });
}

