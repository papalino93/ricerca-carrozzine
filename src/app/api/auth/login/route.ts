import { NextRequest, NextResponse } from "next/server";
import { verifyCredentials } from "@/lib/basic-auth";
import { createSessionToken, SESSION_COOKIE, SESSION_MAX_AGE } from "@/lib/session";
import {
  createPendingTwoFactorToken,
  isTrustedDevice,
  isTwoFactorEnabled,
  PENDING_2FA_COOKIE,
  PENDING_2FA_MAX_AGE,
  TRUSTED_DEVICE_COOKIE,
} from "@/lib/twofactor";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  let body: { username?: string; password?: string };
  try {
    body = (await req.json()) as { username?: string; password?: string };
  } catch {
    return NextResponse.json({ error: "Richiesta non valida" }, { status: 400 });
  }

  const username = body.username?.trim() ?? "";
  const password = body.password ?? "";
  if (!username || !password) {
    return NextResponse.json({ error: "Inserisci username e password" }, { status: 400 });
  }

  const result = await verifyCredentials(username, password);
  if (result === "verifica-fallita") {
    return NextResponse.json(
      { error: "Google Sheets non risponde: riprova tra qualche secondo." },
      { status: 503, headers: { "Retry-After": "5" } }
    );
  }
  if (result !== "ok") {
    return NextResponse.json({ error: "Username o password non corretti" }, { status: 401 });
  }

  try {
    // Se Google Sheets non risponde qui, si considera il 2FA non attivo
    // invece di bloccare l'accesso: stessa scelta già fatta altrove nel
    // progetto (vedi basic-auth.ts) di non far dipendere l'ingresso nel
    // gestionale dalla disponibilità del foglio.
    const twoFactorOn = await isTwoFactorEnabled(username).catch(() => false);
    const trusted =
      twoFactorOn && isTrustedDevice(req.cookies.get(TRUSTED_DEVICE_COOKIE)?.value, username);

    if (twoFactorOn && !trusted) {
      const response = NextResponse.json({ requiresTwoFactor: true });
      response.cookies.set(PENDING_2FA_COOKIE, createPendingTwoFactorToken(username), {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: PENDING_2FA_MAX_AGE,
      });
      return response;
    }

    const response = NextResponse.json({ ok: true });
    response.cookies.set(SESSION_COOKIE, createSessionToken(username), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_MAX_AGE,
    });
    return response;
  } catch (err) {
    console.error("Creazione sessione non riuscita:", err);
    return NextResponse.json(
      { error: "Accesso non configurato correttamente: contatta l’amministratore." },
      { status: 500 }
    );
  }
}
