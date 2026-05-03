import crypto from "crypto";

const BASE_URL = process.env.CHATVIBE_BASE_URL || "http://localhost:3000";
const SHOULD_RUN_ANALYZE = process.env.PHASE1_SKIP_ANALYZE === "true" ? false : true;
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
  if (health.response.ok) {
    console.log("[health]", health.data);
  } else {
    throw new Error(`Health check failed: ${health.response.status}`);
  }

  const csrf = getCsrfToken();
  if (!csrf) {
    throw new Error("CSRF cookie not found after health check");
  }

  const username = `phase1user_${crypto.randomBytes(4).toString("hex")}`;
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

  const refresh = await request("/api/auth/refresh", {
    method: "POST",
    headers: {
      "x-csrf-token": getCsrfToken(),
    },
  });

  if (!refresh.response.ok) {
    console.error("[refresh] failed", refresh.response.status, refresh.data);
    process.exitCode = 1;
    return;
  }

  console.log("[refresh] success", refresh.data);

  if (SHOULD_RUN_ANALYZE) {
    const csrfForAnalyze = getCsrfToken();
    if (!csrfForAnalyze) {
      console.error("[analyze] missing CSRF cookie before analyze call");
      process.exitCode = 1;
      return;
    }

    const analyze = await request("/api/analyze", {
      method: "POST",
      headers: {
        "x-csrf-token": csrfForAnalyze,
        Authorization: `Bearer ${login.data.accessToken}`,
      },
      body: JSON.stringify({
        images: [SAMPLE_IMAGE],
        customPrompt: "Return minimal JSON response.",
      }),
    });

    if (!analyze.response.ok) {
      console.error("[analyze] failed", analyze.response.status, analyze.data);
      process.exitCode = 1;
      return;
    }

    console.log("[analyze] success", {
      ocrCount: analyze.data?.ocrResults?.length ?? 0,
      hasAnalysis: Boolean(analyze.data?.analysis),
    });
  } else {
    console.log("[analyze] skipped (set PHASE1_SKIP_ANALYZE=false to run)");
  }

  const logout = await request("/api/auth/logout", {
    method: "POST",
    headers: {
      "x-csrf-token": getCsrfToken(),
    },
  });

  if (!logout.response.ok) {
    console.error("[logout] failed", logout.response.status, logout.data);
    process.exitCode = 1;
    return;
  }

  console.log("[logout] success", logout.data);

  const refreshAfterLogout = await request("/api/auth/refresh", {
    method: "POST",
    headers: {
      "x-csrf-token": getCsrfToken(),
    },
  });

  if (refreshAfterLogout.response.status === 401) {
    console.log("[refresh-after-logout] correctly rejected with 401");
  } else {
    console.error(
      "[refresh-after-logout] unexpected response",
      refreshAfterLogout.response.status,
      refreshAfterLogout.data,
    );
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error("[auth-flow] unexpected error", error);
  process.exitCode = 1;
});

