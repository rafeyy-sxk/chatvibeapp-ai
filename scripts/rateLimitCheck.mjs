const BASE_URL = process.env.CHATVIBE_BASE_URL || "http://localhost:3000";
const ATTEMPTS = Number(process.env.RATE_LIMIT_ATTEMPTS || 25);
const cookieJar = new Map();

function setCookiesFromResponse(response) {
  const getSetCookie = response.headers?.getSetCookie?.bind(response.headers);
  const cookies = getSetCookie ? getSetCookie() : [];
  for (const cookie of cookies) {
    if (!cookie) continue;
    const [pair] = cookie.split(";");
    if (!pair) continue;
    const [name, ...rest] = pair.split("=");
    if (!name) continue;
    cookieJar.set(name.trim(), rest.join("=").trim());
  }
}

function buildCookieHeader() {
  if (!cookieJar.size) return "";
  return Array.from(cookieJar.entries())
    .map(([key, value]) => `${key}=${value}`)
    .join("; ");
}

function getCsrfToken() {
  return cookieJar.get("cv_csrf");
}

async function request(path, { method = "GET", headers = {}, body } = {}) {
  const url = path.startsWith("http") ? path : `${BASE_URL}${path}`;
  const reqHeaders = new Headers(headers);
  const cookieHeader = buildCookieHeader();
  if (cookieHeader) {
    reqHeaders.set("cookie", cookieHeader);
  }
  if (body && !reqHeaders.has("content-type")) {
    reqHeaders.set("content-type", "application/json");
  }
  const response = await fetch(url, { method, headers: reqHeaders, body });
  setCookiesFromResponse(response);
  const text = await response.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }
  return { response, data, text };
}

async function main() {
  const health = await request("/api/health");
  if (!health.response.ok) {
    throw new Error(`Health check failed: ${health.response.status}`);
  }

  const csrf = getCsrfToken();
  if (!csrf) {
    throw new Error("CSRF cookie not set after health check");
  }

  const results = [];
  for (let i = 1; i <= ATTEMPTS; i += 1) {
    const attempt = await request("/api/auth/login", {
      method: "POST",
      headers: {
        "x-csrf-token": csrf,
      },
      body: JSON.stringify({
        username: `nonexistent_user_${i}`,
        password: "WrongPass!234",
      }),
    });
    results.push({
      attempt: i,
      status: attempt.response.status,
      body: attempt.data,
    });
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  const grouped = results.reduce(
    (acc, item) => {
      const key = item.status;
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    },
    {},
  );

  console.table(results, ["attempt", "status"]);
  console.log("[rate-limit] summary", grouped);
}

main().catch((error) => {
  console.error("[rate-limit] error", error);
  process.exitCode = 1;
});

