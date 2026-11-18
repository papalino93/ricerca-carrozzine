import { NextRequest, NextResponse } from "next/server";
import { listRecoverableAccounts } from "@/lib/users";
import { sendRecoveryEmail } from "@/lib/recovery-email";

// Stesso indirizzo fisso già usato in proxy.ts/layout.tsx: MAI l'origine
// della richiesta (req.nextUrl.origin deriva dall'header Host, che il
// chiamante controlla) per un link che finisce dentro un'email di
// recupero accesso — altrimenti chi chiama questa rotta senza autenticarsi
// (è per forza pubblica: serve a chi ha perso l'accesso) potrebbe far
// puntare il link firmato a un dominio proprio invece che al gestionale.
const SITE_URL = "https://medical-center-scandicci.vercel.app";

const attempts = new Map<string, number>();
const WAIT_MS = 10 * 60 * 1000;

// Senza pulizia, ogni IP distinto che abbia mai chiamato questa rotta
// resterebbe per sempre in memoria per tutta la vita dell'istanza: una
// voce scaduta non serve più a nulla (il confronto sotto la ignorerebbe
// comunque), va solo tolta.
function sweepAttempts(): void {
  const cutoff = Date.now() - WAIT_MS;
  for (const [ip, ts] of attempts) {
    if (ts < cutoff) attempts.delete(ip);
  }
}

export async function POST(req: NextRequest) {
  sweepAttempts();
  // L'ultimo indirizzo della catena, non il primo: i proxy fidati (Vercel
  // compreso) AGGIUNGONO il proprio segmento in coda, quindi è quello più
  // vicino al nostro server. Il primo segmento è quello che ha scritto
  // originariamente chi ha fatto la richiesta — su una rotta pubblica e non
  // autenticata come questa, un chiamante può scriverci qualunque valore e
  // presentarsi come un IP diverso ogni volta, svuotando il limite.
  const forwardedFor = req.headers.get("x-forwarded-for");
  const ip = forwardedFor?.split(",").map((s) => s.trim()).filter(Boolean).pop() || "unknown";
  const last = attempts.get(ip) ?? 0;
  if (Date.now() - last < WAIT_MS) {
    return NextResponse.json({ error: "Richiesta già inviata. Attendi 10 minuti prima di riprovare." }, { status: 429 });
  }
  attempts.set(ip, Date.now());

  try {
    const accounts = await listRecoverableAccounts();
    const origin = process.env.APP_URL?.replace(/\/$/, "") || SITE_URL;
    await sendRecoveryEmail(accounts, origin);
    return NextResponse.json({ message: "Email inviata agli indirizzi di recupero configurati." });
  } catch (error) {
    attempts.delete(ip);
    console.error("Recupero accesso non riuscito:", error);
    return NextResponse.json({ error: "Il servizio email non è ancora disponibile. Riprova più tardi." }, { status: 503 });
  }
}
