import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { sessionSecret } from "@/lib/secret";
import { SESSION_COOKIE, verifySession } from "@/lib/session";

// Card narration (spoken card text, so copyrighted like the cards): only after login. The clips come
// from the private repo at build time (scripts/fetch-cards.mjs); made by scripts/make-narration.py.
const CARD = /^[a-z0-9-]+$/;
const CLIP = /^(text|option-\d)$/;

export async function GET(_request: Request, { params }: { params: Promise<{ card: string; clip: string }> }) {
  const user = await verifySession((await cookies()).get(SESSION_COOKIE)?.value, sessionSecret());
  if (!user) return NextResponse.json({}, { status: 401 });

  const { card, clip } = await params;
  if (!CARD.test(card) || !CLIP.test(clip)) return NextResponse.json({}, { status: 404 });
  const audio = await readFile(join(process.cwd(), "data", "audio", card, `${clip}.mp3`)).catch(() => null);
  if (!audio) return NextResponse.json({}, { status: 404 });

  return new NextResponse(new Uint8Array(audio), {
    headers: { "Content-Type": "audio/mpeg", "Cache-Control": "private, max-age=86400" },
  });
}
