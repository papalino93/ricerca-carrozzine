import { NextRequest, NextResponse } from "next/server";
import { createSessionToken, SESSION_COOKIE, SESSION_MAX_AGE } from "@/lib/session";
import {
  createTrustedDeviceToken,
  PENDING_2FA_COOKIE,
  readPendingTwoFactorToken,
  TRUSTED_DEVICE_COOKIE,
  TRUSTED_DEVICE_MAX_AGE,
  verifyTwoFactorCode,
} from "@/lib/twofactor";

export const runtime = "nodejs";

// Blocco tentativi in memoria, per istanza serverless: non impedisce del
// tutto la forza bruta su un codice a 6 cifre, ma la rallenta abbastanza da
// renderla inutile nella finestra di 30s in cui un codice resta valido.
// Come la cache di basic-auth.ts, è "best effort" e si azzera a ogni cold
// start: accettabile qui perché il vero limite è il tempo, non il conteggio.
const MAX_ATTEMPTS = 6;
const ATTEMPT_WINDOW_MS = 5 * 60 * 1000;
const attempts = new Map<string, { count: number; resetAt: number }>();

function tooManyAttempts(key: string): boolean {
  const entry = attempts.get(key);
  return Boolean(entry && entry.resetAt > Date.now() && entry.count >= MAX_ATTEMPTS);
}

function registerFailedAttempt(key: string): void {
  const entry = attempts.get(key);
  if (!entry || entry.resetAt <= Date.now()) {
    attempts.set(key, { count: 1, resetAt: Date.now() + ATTEMPT_WINDOW_MS });
  } else {
    entry.count += 1;
  }
}

export async function POST(req: NextRequest) {
  const pending = readPendingTwoFactorToken(req.cookies.get(PENDING_2FA_COOKIE)?.value);
  if (!pending) {
    return NextResponse.json({ error: "Sessione di accesso scaduta: rifai il login." }, { status: 401 });
  }

  if (tooManyAttempts(pending.username)) {
    return NextResponse.json(
      { error: "Troppi tentativi: rifai il login e riprova tra qualche minuto." },
      { status: 429 }
    );
  }

  let body: { code?: string; remember?: boolean };
  try {
    body = (await req.json()) as { code?: string; remember?: boolean };
  } catch {
    return NextResponse.json({ error: "Richiesta non valida" }, { status: 400 });
  }

  const code = body.code?.trim() ?? "";
  if (!code) {
    return NextResponse.json({ error: "Inserisci il codice" }, { status: 400 });
  }

  let valid: boolean;
  try {
    valid = await verifyTwoFactorCode(pending.username, code);
  } catch {
    return NextResponse.json(
      { error: "Google Sheets non risponde: riprova tra qualche secondo." },
      { status: 503, headers: { "Retry-After": "5" } }
    );
  }

  if (!valid) {
    registerFailedAttempt(pending.username);
    return NextResponse.json({ error: "Codice non valido" }, { status: 401 });
  }
  attempts.delete(pending.username);

  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, createSessionToken(pending.username), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
  response.cookies.delete(PENDING_2FA_COOKIE);

  if (body.remember) {
    response.cookies.set(TRUSTED_DEVICE_COOKIE, createTrustedDeviceToken(pending.username), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: TRUSTED_DEVICE_MAX_AGE,
    });
  }

  return response;
}
