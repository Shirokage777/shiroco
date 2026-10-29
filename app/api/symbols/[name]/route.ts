import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { sessionSecret } from "@/lib/secret";
import { SESSION_COOKIE, verifySession } from "@/lib/session";

// Printed game symbols (copyrighted artwork, cropped from Sean's cards): only after login,
// like the card texts. The files come from the private repo at build time (scripts/fetch-cards.mjs).
const NAME = /^[a-z0-9-]+$/;

export async function GET(_request: Request, { params }: { params: Promise<{ name: string }> }) {
  const user = await verifySession((await cookies()).get(SESSION_COOKIE)?.value, sessionSecret());
  if (!user) return NextResponse.json({}, { status: 401 });

  const { name } = await params;
  if (!NAME.test(name)) return NextResponse.json({}, { status: 404 });
  const image = await readFile(join(process.cwd(), "data", "symbols", `${name}.png`)).catch(() => null);
  if (!image) return NextResponse.json({}, { status: 404 });

  return new NextResponse(new Uint8Array(image), {
    headers: { "Content-Type": "image/png", "Cache-Control": "private, max-age=86400" },
  });
}
