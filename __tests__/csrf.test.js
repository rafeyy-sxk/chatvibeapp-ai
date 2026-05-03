import { NextResponse } from "next/server";
import { ensureCsrfCookie, validateCsrf } from "@/middleware/csrf";

const createRequest = ({ method = "POST", cookieToken, headerToken } = {}) => {
  const cookies = new Map();
  if (cookieToken) {
    cookies.set("cv_csrf", cookieToken);
  }
  return {
    method,
    cookies: {
      get: (name) => (cookies.has(name) ? { value: cookies.get(name) } : undefined),
    },
    headers: {
      get: (name) => {
        if (name?.toLowerCase() === "x-csrf-token") {
          return headerToken ?? null;
        }
        return null;
      },
    },
  };
};

describe("CSRF middleware", () => {
  it("rejects requests without matching csrf token", () => {
    const request = createRequest({ cookieToken: "one", headerToken: "two" });
    const result = validateCsrf(request);
    expect(result?.status).toBe(403);
  });

  it("accepts requests with valid token", () => {
    const request = createRequest({ cookieToken: "same-token", headerToken: "same-token" });
    const result = validateCsrf(request);
    expect(result).toBeNull();
  });

  it("issues csrf cookie when missing", () => {
    const response = NextResponse.json({ ok: true });
    ensureCsrfCookie(response);
    const cookie = response.cookies.get("cv_csrf");
    expect(cookie?.value).toHaveLength(64);
    expect(cookie?.sameSite).toBe("strict");
  });
});

