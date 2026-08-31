import { NextRequest, NextResponse } from "next/server";
import { readValidRecoveryToken } from "@/lib/recovery";
import { setRecoveredPassword } from "@/lib/users";

export async function POST(req: NextRequest) {
  let body: { token?: string; password?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Richiesta non valida" }, { status: 400 }); }
  if (!body.token || !body.password || body.password.length < 8) return NextResponse.json({ error: "Usa una password di almeno 8 caratteri" }, { status: 400 });

  const payload = await readValidRecoveryToken(body.token);
  if (!payload) return NextResponse.json({ error: "Collegamento scaduto o già utilizzato" }, { status: 400 });

  try {
    await setRecoveredPassword(payload.username, body.password);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Cambio password non riuscito:", error);
    return NextResponse.json({ error: "Non è stato possibile aggiornare la password" }, { status: 500 });
  }
}
