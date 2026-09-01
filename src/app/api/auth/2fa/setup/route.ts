import { NextRequest, NextResponse } from "next/server";
import QRCode from "qrcode";
import { readSessionToken, SESSION_COOKIE } from "@/lib/session";
import { generateSecret, otpauthUrl } from "@/lib/totp";
import { createSetupToken, SETUP_2FA_COOKIE, SETUP_2FA_MAX_AGE } from "@/lib/twofactor";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const session = readSessionToken(req.cookies.get(SESSION_COOKIE)?.value);
  if (!session) {
    return NextResponse.json({ error: "Sessione scaduta: accedi di nuovo." }, { status: 401 });
  }

  const secret = generateSecret();
  const qrDataUrl = await QRCode.toDataURL(otpauthUrl(session.username, secret));

  const response = NextResponse.json({ secret, qrDataUrl });
  response.cookies.set(SETUP_2FA_COOKIE, createSetupToken(session.username, secret), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SETUP_2FA_MAX_AGE,
  });
  return response;
}
