import { NextResponse } from "next/server";

export function jsonResponse(data, init = {}) {
  return NextResponse.json(data, init);
}

export function errorResponse(message, status = 400, extra = {}) {
  return NextResponse.json({ error: message, ...extra }, { status });
}

