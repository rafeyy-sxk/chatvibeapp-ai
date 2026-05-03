import crypto from "crypto";

const BASE_URL = process.env.CHATVIBE_BASE_URL || "http://localhost:3000";
const SAMPLE_IMAGE =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/xcAAusB9Yp0n6cAAAAASUVORK5CYII=";

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
  console.log("[health]", health.data);

  const csrf = getCsrfToken();
  if (!csrf) {
    throw new Error("CSRF cookie not found after health check");
  }

  const username = `phase2user_${crypto.randomBytes(4).toString("hex")}`;
  const password = "TestPass!234";
  const email = `${username}@example.com`;

  const signup = await request("/api/auth/signup", {
    method: "POST",
    headers: {
      "x-csrf-token": csrf,
    },
    body: JSON.stringify({ username, email, password }),
  });

  if (!signup.response.ok) {
    console.error("[signup] failed", signup.response.status, signup.data);
    process.exitCode = 1;
    return;
  }
  console.log("[signup] success", signup.data);

  const login = await request("/api/auth/login", {
    method: "POST",
    headers: {
      "x-csrf-token": getCsrfToken(),
    },
    body: JSON.stringify({ username, password }),
  });

  if (!login.response.ok) {
    console.error("[login] failed", login.response.status, login.data);
    process.exitCode = 1;
    return;
  }
  console.log("[login] success", login.data);

  const accessToken = login.data.accessToken;

  const analyze = await request("/api/analyze", {
    method: "POST",
    headers: {
      "x-csrf-token": getCsrfToken(),
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      images: [SAMPLE_IMAGE],
      customPrompt: "Return minimal but valid JSON.",
    }),
  });

  if (!analyze.response.ok) {
    console.error("[analyze] failed", analyze.response.status, analyze.data);
    process.exitCode = 1;
    return;
  }

  const { reportId, analytics } = analyze.data || {};
  console.log("[analyze] success", {
    reportId,
    hasAnalytics: Boolean(analytics),
  });

  if (!reportId || !analytics) {
    console.error("[phase2] missing analytics or reportId in analyze response");
    process.exitCode = 1;
    return;
  }

  // Fetch report by id
  const report = await request(`/api/reports/${reportId}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!report.response.ok) {
    console.error("[report] failed", report.response.status, report.data);
    process.exitCode = 1;
    return;
  }

  const r = report.data;
  console.log("[report] success", {
    id: r.id,
    hasSentiment: Array.isArray(r.analytics?.sentimentTimeline),
    hasToxicity: !!r.analytics?.toxicity,
  });

  if (
    !Array.isArray(r.analytics?.sentimentTimeline) ||
    !r.analytics?.toxicity ||
    !r.geminiSummary
  ) {
    console.error("[phase2] report missing expected analytics fields");
    process.exitCode = 1;
    return;
  }
}

main().catch((err) => {
  console.error("[phase2-flow] unexpected error", err);
  process.exitCode = 1;
});


