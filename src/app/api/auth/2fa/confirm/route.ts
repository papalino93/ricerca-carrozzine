import { NextRequest, NextResponse } from "next/server";
import { readSessionToken, SESSION_COOKIE } from "@/lib/session";
import { verifyTotp } from "@/lib/totp";
import { confirmTwoFactorSetup, readSetupToken, SETUP_2FA_COOKIE } from "@/lib/twofactor";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const session = readSessionToken(req.cookies.get(SESSION_COOKIE)?.value);
  if (!session) {
    return NextResponse.json({ error: "Sessione scaduta: accedi di nuovo." }, { status: 401 });
  }

  const setup = readSetupToken(req.cookies.get(SETUP_2FA_COOKIE)?.value);
  if (!setup || setup.username.toLowerCase() !== session.username.toLowerCase()) {
    return NextResponse.json(
      { error: "Configurazione scaduta: ricomincia l'attivazione." },
      { status: 400 }
    );
  }

  let body: { code?: string };
  try {
    body = (await req.json()) as { code?: string };
  } catch {
    return NextResponse.json({ error: "Richiesta non valida" }, { status: 400 });
  }

  if (!verifyTotp(setup.secret, body.code ?? "")) {
    return NextResponse.json({ error: "Codice non valido" }, { status: 401 });
  }

  try {
    const backupCodes = await confirmTwoFactorSetup(session.username, setup.secret);
    const response = NextResponse.json({ backupCodes });
    response.cookies.delete(SETUP_2FA_COOKIE);
    return response;
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
