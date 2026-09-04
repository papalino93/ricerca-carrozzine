import { NextRequest, NextResponse } from "next/server";
import { listRecoverableAccounts } from "@/lib/users";
import { sendRecoveryEmail } from "@/lib/recovery-email";

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
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const last = attempts.get(ip) ?? 0;
  if (Date.now() - last < WAIT_MS) {
    return NextResponse.json({ error: "Richiesta già inviata. Attendi 10 minuti prima di riprovare." }, { status: 429 });
  }
  attempts.set(ip, Date.now());

  try {
    const accounts = await listRecoverableAccounts();
    const origin = process.env.APP_URL?.replace(/\/$/, "") || req.nextUrl.origin;
    await sendRecoveryEmail(accounts, origin);
    return NextResponse.json({ message: "Email inviata agli indirizzi di recupero configurati." });
  } catch (error) {
    attempts.delete(ip);
    console.error("Recupero accesso non riuscito:", error);
    return NextResponse.json({ error: "Il servizio email non è ancora disponibile. Riprova più tardi." }, { status: 503 });
  }
}
