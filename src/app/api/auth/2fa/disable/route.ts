import { NextRequest, NextResponse } from "next/server";
import { verifyCredentials } from "@/lib/basic-auth";
import { readSessionToken, SESSION_COOKIE } from "@/lib/session";
import { disableTwoFactor } from "@/lib/twofactor";

export const runtime = "nodejs";

// Richiede di reinserire la password: disattivare il 2FA è un'azione
// sensibile (toglie un fattore di protezione), non deve bastare avere il
// browser aperto su una sessione dimenticata.
export async function POST(req: NextRequest) {
  const session = readSessionToken(req.cookies.get(SESSION_COOKIE)?.value);
  if (!session) {
    return NextResponse.json({ error: "Sessione scaduta: accedi di nuovo." }, { status: 401 });
  }

  let body: { password?: string };
  try {
    body = (await req.json()) as { password?: string };
  } catch {
    return NextResponse.json({ error: "Richiesta non valida" }, { status: 400 });
  }

  const esito = await verifyCredentials(session.username, body.password ?? "");
  if (esito === "verifica-fallita") {
    return NextResponse.json(
      { error: "Google Sheets non risponde: riprova tra qualche secondo." },
      { status: 503, headers: { "Retry-After": "5" } }
    );
  }
  if (esito !== "ok") {
    return NextResponse.json({ error: "Password non corretta" }, { status: 401 });
  }

  try {
    await disableTwoFactor(session.username);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
