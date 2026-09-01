import { NextRequest, NextResponse } from "next/server";
import { requireBasicAuth } from "@/lib/basic-auth";
import { disableTwoFactor } from "@/lib/twofactor";

export const runtime = "nodejs";

// Via di fuga per chi perde sia il telefono sia i codici di recupero: un
// altro utente autorizzato disattiva il 2FA per suo conto, allo stesso
// livello di fiducia già richiesto per resettare la password altrui in
// /api/utenti (nessun ruolo separato "admin" esiste in questo gestionale).
export async function POST(req: NextRequest) {
  const unauthorized = await requireBasicAuth(req);
  if (unauthorized) return unauthorized;

  try {
    const { username } = (await req.json()) as { username?: string };
    if (!username) {
      return NextResponse.json({ error: "Username obbligatorio" }, { status: 400 });
    }
    await disableTwoFactor(username);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
