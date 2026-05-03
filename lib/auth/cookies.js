import { env } from "../env";
import { secondsFromExpiry } from "./tokens";

const REFRESH_COOKIE = "cv_refresh";

export function setRefreshCookie(response, token) {
  response.cookies.set(REFRESH_COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: "strict",
    path: "/",
    maxAge: secondsFromExpiry(env.refreshTokenExpiry),
  });
}

export function clearRefreshCookie(response) {
  response.cookies.set(REFRESH_COOKIE, "", {
    httpOnly: true,
    secure: true,
    sameSite: "strict",
    path: "/",
    maxAge: 0,
  });
}

