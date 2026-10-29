import { NextResponse } from "next/server";
import { sessionSecret } from "@/lib/secret";
import { createSession, SESSION_COOKIE, SESSION_DAYS } from "@/lib/session";
import { checkPassword, loadUsers } from "@/lib/users";

const FAIL_DELAY_MS = 800; // slows down password guessing

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const name = typeof body.name === "string" ? body.name.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const secret = sessionSecret();

  if (!secret || !name || !password || !checkPassword(loadUsers(), name, password)) {
    await new Promise((r) => setTimeout(r, FAIL_DELAY_MS));
    return NextResponse.json({}, { status: 401 });
  }

  const res = NextResponse.json({});
  res.cookies.set(SESSION_COOKIE, await createSession(name, secret), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DAYS * 86_400,
  });
  return res;
}
