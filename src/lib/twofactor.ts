import "server-only";
import { createHash, createHmac, timingSafeEqual } from "crypto";
import { readSheet, writeSheet } from "./sheets";
import { generateBackupCodes, verifyBackupCode, verifyTotp } from "./totp";

const TAB = "TOTP2FA";
const HEADER = ["Username", "Secret", "BackupCodes", "Confirmed"];

interface TwoFactorRecord {
  username: string;
  secret: string;
  backupCodes: string[];
  confirmed: boolean;
}

async function readRecords(): Promise<TwoFactorRecord[]> {
  const rows = await readSheet(TAB);
  return rows
    .slice(1)
    .filter((row) => row.length > 0 && row[0])
    .map((row) => ({
      username: row[0],
      secret: row[1] ?? "",
      backupCodes: (row[2] ?? "")
        .split(",")
        .map((c) => c.trim())
        .filter(Boolean),
      confirmed: row[3] === "1",
    }));
}

async function writeRecords(records: TwoFactorRecord[]): Promise<void> {
  await writeSheet(TAB, [
    HEADER,
    ...records.map((r) => [r.username, r.secret, r.backupCodes.join(","), r.confirmed ? "1" : "0"]),
  ]);
}

/** Vero se l'utente ha completato l'attivazione del 2FA (non basta averla iniziata). */
export async function isTwoFactorEnabled(username: string): Promise<boolean> {
  const records = await readRecords();
  return Boolean(records.find((r) => r.username.toLowerCase() === username.toLowerCase())?.confirmed);
}

/** Ultimo esito CONFERMATO (non da un fallback) di isTwoFactorEnabled per
 * utente, usato solo da isTwoFactorEnabledForLogin qui sotto. */
const ENABLED_CACHE_MS = 300_000;
let enabledCache: { username: string; enabled: boolean; expires: number } | null = null;

/**
 * Come isTwoFactorEnabled, ma per la verifica al login: se Google Sheets
 * non risponde, non si può semplicemente assumere "2FA disattivo" — chi ha
 * il 2FA attivo entrerebbe con la sola password durante un banale intoppo
 * di rete verso Google, saltando del tutto il secondo fattore. Si usa
 * invece l'ultimo esito confermato per questo utente, se recente;
 * altrimenti si segnala "verifica-fallita" e tocca al chiamante decidere
 * se bloccare l'accesso (di norma sì).
 */
export async function isTwoFactorEnabledForLogin(username: string): Promise<boolean | "verifica-fallita"> {
  const usernameKey = username.toLowerCase();
  try {
    const enabled = await isTwoFactorEnabled(username);
    enabledCache = { username: usernameKey, enabled, expires: Date.now() + ENABLED_CACHE_MS };
    return enabled;
  } catch {
    const cached = enabledCache;
    if (cached && cached.username === usernameKey && cached.expires > Date.now()) {
      return cached.enabled;
    }
    return "verifica-fallita";
  }
}

/** Elenco degli utenti con 2FA attivo, per mostrarlo in Impostazioni > Utenti. */
export async function listTwoFactorUsernames(): Promise<string[]> {
  const records = await readRecords();
  return records.filter((r) => r.confirmed).map((r) => r.username);
}

/**
 * Conferma l'attivazione: salva il secret (finora tenuto solo nel cookie di
 * setup, mai scritto prima d'ora) e genera i codici di recupero. Restituisce
 * i codici in chiaro: è l'unica volta in cui saranno visibili.
 */
export async function confirmTwoFactorSetup(username: string, secret: string): Promise<string[]> {
  const generated = generateBackupCodes();
  const records = await readRecords();
  const idx = records.findIndex((r) => r.username.toLowerCase() === username.toLowerCase());
  const record: TwoFactorRecord = {
    username,
    secret,
    backupCodes: generated.map((g) => g.hash),
    confirmed: true,
  };
  if (idx >= 0) records[idx] = record;
  else records.push(record);
  await writeRecords(records);
  return generated.map((g) => g.code);
}

export async function disableTwoFactor(username: string): Promise<void> {
  const records = await readRecords();
  const remaining = records.filter((r) => r.username.toLowerCase() !== username.toLowerCase());
  if (remaining.length !== records.length) await writeRecords(remaining);
}

/** Verifica un codice a 6 cifre (TOTP) o un codice di recupero a 10 cifre
 * (che viene consumato subito, essendo monouso). */
export async function verifyTwoFactorCode(username: string, code: string): Promise<boolean> {
  const digits = code.replace(/\D/g, "");
  const records = await readRecords();
  const idx = records.findIndex((r) => r.username.toLowerCase() === username.toLowerCase());
  if (idx === -1 || !records[idx].confirmed) return false;
  const record = records[idx];

  if (digits.length === 6 && verifyTotp(record.secret, digits)) return true;
  if (digits.length !== 10) return false;

  const codeIdx = record.backupCodes.findIndex((hash) => verifyBackupCode(digits, hash));
  if (codeIdx === -1) return false;

  record.backupCodes.splice(codeIdx, 1);
  await writeRecords(records);
  return true;
}

// --- Token firmati (cookie), sullo stesso schema di session.ts/recovery.ts ---

function twoFactorSecret(): Buffer {
  const source = process.env.AUTH_SESSION_SECRET ?? process.env.ADMIN_PASSWORD;
  if (!source) throw new Error("Configura AUTH_SESSION_SECRET oppure ADMIN_PASSWORD");
  return createHash("sha256").update(`medical-center-2fa:${source}`).digest();
}

// "kind" separa gli scopi dei token (pending login / setup / dispositivo
// fidato): senza, un token rubato per uno scopo sarebbe valido anche per gli
// altri, avendo tutti la stessa firma.
function sign(kind: string, payload: string): string {
  return createHmac("sha256", twoFactorSecret()).update(`${kind}:${payload}`).digest("base64url");
}

interface TokenPayload {
  expiresAt: number;
  [key: string]: unknown;
}

function encodeToken(kind: string, payload: object): string {
  const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  return `${encoded}.${sign(kind, encoded)}`;
}

function decodeToken<T extends TokenPayload>(kind: string, token: string | undefined): T | null {
  if (!token) return null;
  const [encoded, received] = token.split(".");
  if (!encoded || !received) return null;
  try {
    const expected = sign(kind, encoded);
    const a = Buffer.from(received, "utf8");
    const b = Buffer.from(expected, "utf8");
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as T;
    if (!Number.isFinite(payload.expiresAt) || payload.expiresAt <= Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

/** Cookie temporaneo che autorizza SOLO il secondo passo del login (il
 * codice 2FA), mai l'accesso vero e proprio al gestionale. */
export const PENDING_2FA_COOKIE = "medical_center_2fa_pending";
export const PENDING_2FA_MAX_AGE = 5 * 60;

export function createPendingTwoFactorToken(username: string): string {
  return encodeToken("pending", { username, expiresAt: Date.now() + PENDING_2FA_MAX_AGE * 1000 });
}

export function readPendingTwoFactorToken(token: string | undefined): { username: string } | null {
  const payload = decodeToken<TokenPayload & { username: string }>("pending", token);
  return payload ? { username: payload.username } : null;
}

/** Cookie temporaneo usato solo durante l'attivazione: il secret non viene
 * scritto nel foglio finché l'utente non conferma con un codice valido, per
 * non rischiare di sostituire un 2FA già funzionante con uno mai confermato. */
export const SETUP_2FA_COOKIE = "medical_center_2fa_setup";
export const SETUP_2FA_MAX_AGE = 10 * 60;

export function createSetupToken(username: string, secret: string): string {
  return encodeToken("setup", { username, secret, expiresAt: Date.now() + SETUP_2FA_MAX_AGE * 1000 });
}

export function readSetupToken(token: string | undefined): { username: string; secret: string } | null {
  const payload = decodeToken<TokenPayload & { username: string; secret: string }>("setup", token);
  return payload ? { username: payload.username, secret: payload.secret } : null;
}

/** Cookie "ricordami" per dispositivo: salta il secondo passo per 30 giorni
 * su questo browser. È per-dispositivo, non per-utente: un altro telefono o
 * PC dello stesso utente richiederà comunque il codice la prima volta. */
export const TRUSTED_DEVICE_COOKIE = "medical_center_2fa_trusted";
export const TRUSTED_DEVICE_MAX_AGE = 30 * 24 * 60 * 60;

export function createTrustedDeviceToken(username: string): string {
  return encodeToken("trusted", { username, expiresAt: Date.now() + TRUSTED_DEVICE_MAX_AGE * 1000 });
}

export function isTrustedDevice(token: string | undefined, username: string): boolean {
  const payload = decodeToken<TokenPayload & { username: string }>("trusted", token);
  return Boolean(payload && payload.username.toLowerCase() === username.toLowerCase());
}
