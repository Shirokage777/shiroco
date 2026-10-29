import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getCards } from "@/lib/cards";
import { sessionSecret } from "@/lib/secret";
import { SESSION_COOKIE, verifySession } from "@/lib/session";

// The middleware already blocks this without a session; checking again here keeps
// the card data safe even if the middleware matcher ever changes.
export async function GET() {
  const user = await verifySession((await cookies()).get(SESSION_COOKIE)?.value, sessionSecret());
  if (!user) return NextResponse.json({}, { status: 401 });
  return NextResponse.json({ cards: getCards() }, { headers: { "Cache-Control": "private, no-store" } });
}
