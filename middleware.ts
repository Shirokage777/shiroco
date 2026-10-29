import { NextResponse, type NextRequest } from "next/server";
import { sessionSecret } from "@/lib/secret";
import { SESSION_COOKIE, verifySession } from "@/lib/session";

// Without a valid session nothing is served except the login itself (privacy requirement).
const OPEN = ["/login", "/api/login", "/robots.txt", "/favicon.ico"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (OPEN.includes(pathname) || pathname.startsWith("/_next/static/")) return NextResponse.next();

  const user = await verifySession(request.cookies.get(SESSION_COOKIE)?.value, sessionSecret());
  if (user) return NextResponse.next();

  if (pathname.startsWith("/api/")) return NextResponse.json({}, { status: 401 });
  return NextResponse.redirect(new URL("/login", request.url));
}

export const config = {
  runtime: "nodejs",
  matcher: "/:path*",
};
