import "server-only";
import { createHash, createHmac, timingSafeEqual } from "crypto";

export const SESSION_COOKIE = "medical_center_session";
export const SESSION_MAX_AGE = 60 * 60 * 12;

/** Ogni quanto ricontrollare, mentre la sessione è in uso, che l'account
 * esista ancora (vedi needsRevalidation): non a ogni richiesta — sarebbe
 * una chiamata a Google Sheets su ogni pagina, immagine e chiamata API di
 * chiunque stia usando il gestionale — ma abbastanza spesso perché
 * rimuovere un utente o revocare un accesso abbia effetto in minuti,
 * non fino a 12 ore dopo. */
export const SESSION_REVALIDATE_MS = 15 * 60 * 1000;

export interface SessionPayload {
  username: string;
  expiresAt: number;
  /** Ultima volta che si è confermato (contro Google Sheets) che l'account
   * esiste ancora. Assente nei token creati prima di questo campo: trattata
   * come "va rivalidata subito", non come sessione non valida. */
  verifiedAt?: number;
}

function sessionSecret(): Buffer {
  const dedicatedSecret = process.env.AUTH_SESSION_SECRET;
  if (dedicatedSecret && dedicatedSecret.length < 32) {
    throw new Error("AUTH_SESSION_SECRET deve contenere almeno 32 caratteri");
  }

  // La chiave dedicata resta la configurazione consigliata. Il fallback
  // permette però un rilascio compatibile con i progetti già configurati:
  // deriva una chiave separata dalla password amministratore senza mai
  // inserirla nel cookie. Cambiare ADMIN_PASSWORD invalida anche le sessioni.
  const source = dedicatedSecret ?? process.env.ADMIN_PASSWORD;
  if (!source) {
    throw new Error("Configura AUTH_SESSION_SECRET oppure ADMIN_PASSWORD");
  }
  return createHash("sha256").update(`medical-center-session:${source}`).digest();
}

function signature(payload: string): string {
  return createHmac("sha256", sessionSecret()).update(payload).digest("base64url");
}

export function createSessionToken(username: string): string {
  const payload: SessionPayload = {
    username,
    expiresAt: Date.now() + SESSION_MAX_AGE * 1000,
    verifiedAt: Date.now(),
  };
  const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  return `${encoded}.${signature(encoded)}`;
}

export function readSessionToken(token: string | undefined): SessionPayload | null {
  if (!token) return null;
  const [encoded, received] = token.split(".");
  if (!encoded || !received) return null;

  try {
    const expected = signature(encoded);
    const receivedBytes = Buffer.from(received, "utf8");
    const expectedBytes = Buffer.from(expected, "utf8");
    if (
      receivedBytes.length !== expectedBytes.length ||
      !timingSafeEqual(receivedBytes, expectedBytes)
    ) {
      return null;
    }

    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as SessionPayload;
    if (!payload.username || !Number.isFinite(payload.expiresAt) || payload.expiresAt <= Date.now()) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

/** True se è ora di ricontrollare contro Google Sheets che l'account di
 * questa sessione esista ancora (vedi SESSION_REVALIDATE_MS). I token
 * creati prima dell'aggiunta di "verifiedAt" non ce l'hanno: si
 * rivalidano alla prima occasione invece di restare per sempre esenti. */
export function needsRevalidation(payload: SessionPayload): boolean {
  return !payload.verifiedAt || Date.now() - payload.verifiedAt > SESSION_REVALIDATE_MS;
}
