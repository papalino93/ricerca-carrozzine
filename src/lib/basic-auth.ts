import "server-only";
import { createHash, timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { verifySheetCredential, verifySheetCredentialState } from "./users";
import { readSessionToken, SESSION_COOKIE } from "./session";

const REALM = "Area amministrazione";

/** Confronto a tempo costante, per non far filtrare la lunghezza corretta
 * delle credenziali d'ambiente tramite il tempo di risposta. */
function safeEqual(a: string, b: string): boolean {
  const ah = createHash("sha256").update(a).digest();
  const bh = createHash("sha256").update(b).digest();
  return timingSafeEqual(ah, bh);
}

// Piccola cache in memoria per evitare di interrogare il foglio Google ad
// ogni richiesta mentre l'istanza serverless resta calda. Best-effort: in
// caso di cold start si fa semplicemente una verifica in più.
//
// L'esito positivo si tiene a lungo e quello negativo poco. Non è una
// simmetria da poco: ogni richiesta che non trova la cache pronta legge il
// foglio Google, e sono le pagine, le immagini, le chiamate API — decine
// per ogni schermata aperta. Tenere trenta secondi il "sì" voleva dire
// martellare Google tutto il giorno e, ogni tanto, vedersi rispondere di
// no per quota. Il "no" invece resta breve: se qualcuno cambia la password
// nel foglio, la vecchia smette di funzionare quasi subito.
const CACHE_OK_MS = 300_000;
const CACHE_NO_MS = 30_000;
let cache: { key: string; ok: boolean; expires: number } | null = null;

/** Ultimo esito CONFERMATO (non da un fallback) di "esiste un override sul
 * foglio per l'account d'ambiente?", per lo stesso account d'ambiente.
 * Serve solo al ramo qui sotto quando Google non risponde: vedi commento
 * lì per il motivo. */
let envOverrideCache: { username: string; overridePresente: boolean; expires: number } | null = null;

/** Esito della verifica. "verifica-fallita" non è un rifiuto: vuol dire che
 * non è stato possibile controllare — Google Sheets non ha risposto — e va
 * tenuto distinto, perché rispondere "credenziali errate" a chi le ha
 * giuste è il modo più veloce per far pensare a un guasto del gestionale. */
export type EsitoAuth = "ok" | "negato" | "verifica-fallita";

function decodeBasicAuth(req: NextRequest): { username: string; password: string } | null {
  const header = req.headers.get("authorization");
  if (!header?.startsWith("Basic ")) return null;

  let decoded: string;
  try {
    // atob (Web API) funziona sia su Edge sia su Node.js, a differenza di Buffer.
    decoded = atob(header.slice(6));
  } catch {
    return null;
  }

  const sep = decoded.indexOf(":");
  if (sep === -1) return null;
  return { username: decoded.slice(0, sep), password: decoded.slice(sep + 1) };
}

export async function verifyCredentials(username: string, password: string): Promise<EsitoAuth> {
  // Credenziali "di base" da variabili d'ambiente: sempre valide, nessuna
  // chiamata a Google Sheets necessaria. Impostarle in produzione è anche
  // la rete di sicurezza per il caso qui sotto: con queste attive si entra
  // anche mentre Google Sheets è irraggiungibile.
  const envUser = process.env.ADMIN_USER;
  const envPass = process.env.ADMIN_PASSWORD;
  if (envUser && envPass && safeEqual(username.toLowerCase(), envUser.toLowerCase())) {
    const usernameKey = username.toLowerCase();
    try {
      const sheetState = await verifySheetCredentialState(username, password);
      // Un account omonimo nel foglio è l'override creato dal recupero: la
      // vecchia password d'ambiente non deve continuare a funzionare.
      envOverrideCache = { username: usernameKey, overridePresente: sheetState !== "absent", expires: Date.now() + CACHE_OK_MS };
      if (sheetState === "valid") return "ok";
      if (sheetState === "invalid") return "negato";
    } catch {
      // Se un controllo recente ha confermato che NON esiste un override
      // (il caso comune, nessun recupero è mai stato fatto), l'account
      // d'ambiente resta la rete di sicurezza quando Google non risponde.
      // Ma se l'ultimo controllo ha trovato un override (qualcuno ha
      // recuperato l'accesso proprio per revocare questa password) — o non
      // sappiamo nulla perché non è mai stato possibile controllare — un
      // intoppo di Google non deve far accettare una password che potrebbe
      // essere esattamente quella appena revocata.
      const cached = envOverrideCache;
      if (cached && cached.username === usernameKey && cached.expires > Date.now() && !cached.overridePresente) {
        return safeEqual(password, envPass) ? "ok" : "verifica-fallita";
      }
      return "verifica-fallita";
    }
    return safeEqual(password, envPass) ? "ok" : "negato";
  }

  const cacheKey = createHash("sha256").update(`${username}:${password}`).digest("hex");
  if (cache && cache.key === cacheKey && cache.expires > Date.now()) {
    return cache.ok ? "ok" : "negato";
  }

  // Un secondo tentativo prima di arrendersi: quasi sempre l'intoppo con
  // Google dura un istante, e riprovare qui costa molto meno che far
  // ricaricare la pagina a chi sta lavorando.
  for (let tentativo = 0; tentativo < 2; tentativo++) {
    try {
      const ok = await verifySheetCredential(username, password);
      cache = { key: cacheKey, ok, expires: Date.now() + (ok ? CACHE_OK_MS : CACHE_NO_MS) };
      return ok ? "ok" : "negato";
    } catch {
      if (tentativo === 0) await new Promise((r) => setTimeout(r, 250));
    }
  }

  // Deliberatamente NON si scrive in cache: mettere "negato" qui vorrebbe
  // dire che un singolo intoppo di Google chiude fuori l'operatore per i
  // trenta secondi successivi, anche dopo che Google è tornato a rispondere.
  return "verifica-fallita";
}

async function isAuthorized(req: NextRequest): Promise<EsitoAuth> {
  const creds = decodeBasicAuth(req);
  if (!creds) return "negato";
  return verifyCredentials(creds.username, creds.password);
}

/**
 * Restituisce la risposta da dare quando la richiesta non è autorizzata,
 * oppure null se può passare.
 *
 * Le due risposte negative sono diverse apposta. Il 401 dice "credenziali
 * sbagliate" e fa ricomparire al browser la finestra di login: giusto per
 * chi ha davvero sbagliato password. Il 503 dice "non ho potuto
 * controllare": arriva senza WWW-Authenticate, quindi il browser non
 * richiede le credenziali facendo credere che siano da rifare, e senza
 * cache, quindi al ricaricamento successivo si entra.
 */
export async function requireBasicAuth(req: NextRequest): Promise<NextResponse | null> {
  // Le rotte API storiche chiamano ancora questo helper direttamente. Una
  // sessione valida deve quindi essere riconosciuta anche qui, non soltanto
  // dal proxy, altrimenti l'interfaccia si apre ma le operazioni vengono
  // respinte subito dopo il nuovo login.
  if (readSessionToken(req.cookies.get(SESSION_COOKIE)?.value)) return null;

  const esito = await isAuthorized(req);
  if (esito === "ok") return null;

  if (esito === "verifica-fallita") {
    return new NextResponse(
      "Non è stato possibile verificare le credenziali: Google Sheets non risponde. " +
        "Le credenziali sono giuste, riprova fra qualche secondo ricaricando la pagina.",
      { status: 503, headers: { "Retry-After": "5" } }
    );
  }

  return new NextResponse("Accesso riservato all'amministrazione.", {
    status: 401,
    headers: {
      "WWW-Authenticate": `Basic realm="${REALM}", charset="UTF-8"`,
    },
  });
}
