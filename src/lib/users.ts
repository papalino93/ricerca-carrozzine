import "server-only";
import { createHash, randomBytes, scryptSync, timingSafeEqual } from "crypto";
import { readSheet, writeSheet } from "./sheets";

const TAB = "Utenti";
const HEADER = ["Username", "PasswordHash"];

export interface AdminUser {
  username: string;
}

export interface RecoverableAccount {
  username: string;
  version: string;
}

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const candidate = scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, "hex");
  if (candidate.length !== expected.length) return false;
  return timingSafeEqual(candidate, expected);
}

async function readUsers(): Promise<{ username: string; hash: string }[]> {
  const rows = await readSheet(TAB);
  return rows
    .slice(1)
    .filter((row) => row.length > 0 && row[0])
    .map((row) => ({ username: row[0], hash: row[1] ?? "" }));
}

/** Elenco degli utenti autorizzati (senza esporre gli hash delle password). */
export async function listUsers(): Promise<AdminUser[]> {
  const users = await readUsers();
  return users.map((u) => ({ username: u.username }));
}

export async function addUser(username: string, password: string): Promise<AdminUser[]> {
  const clean = username.trim();
  if (!clean) throw new Error("Username obbligatorio");
  if (!password || password.length < 6) {
    throw new Error("La password deve avere almeno 6 caratteri");
  }
  const users = await readUsers();
  if (users.some((u) => u.username.toLowerCase() === clean.toLowerCase())) {
    throw new Error(`Esiste già un utente "${clean}"`);
  }
  users.push({ username: clean, hash: hashPassword(password) });
  await writeSheet(TAB, [HEADER, ...users.map((u) => [u.username, u.hash])]);
  return users.map((u) => ({ username: u.username }));
}

export async function resetPassword(username: string, newPassword: string): Promise<AdminUser[]> {
  if (!newPassword || newPassword.length < 6) {
    throw new Error("La password deve avere almeno 6 caratteri");
  }
  const users = await readUsers();
  const idx = users.findIndex((u) => u.username.toLowerCase() === username.toLowerCase());
  if (idx < 0) throw new Error(`Utente "${username}" non trovato`);
  users[idx] = { ...users[idx], hash: hashPassword(newPassword) };
  await writeSheet(TAB, [HEADER, ...users.map((u) => [u.username, u.hash])]);
  return users.map((u) => ({ username: u.username }));
}

/**
 * Reimposta anche l'account principale configurato su Vercel. In quel caso
 * viene creato un override nel foglio Utenti: da quel momento la password
 * scelta qui ha precedenza su quella storica salvata nell'ambiente.
 */
export async function setRecoveredPassword(username: string, newPassword: string): Promise<void> {
  if (!newPassword || newPassword.length < 8) {
    throw new Error("La password deve avere almeno 8 caratteri");
  }

  const users = await readUsers();
  const idx = users.findIndex((u) => u.username.toLowerCase() === username.toLowerCase());
  if (idx >= 0) {
    users[idx] = { ...users[idx], hash: hashPassword(newPassword) };
  } else if (process.env.ADMIN_USER?.toLowerCase() === username.toLowerCase()) {
    users.push({ username: process.env.ADMIN_USER, hash: hashPassword(newPassword) });
  } else {
    throw new Error("Account non trovato");
  }

  await writeSheet(TAB, [HEADER, ...users.map((u) => [u.username, u.hash])]);
}

export async function removeUser(username: string): Promise<AdminUser[]> {
  const users = await readUsers();
  const remaining = users.filter((u) => u.username.toLowerCase() !== username.toLowerCase());
  await writeSheet(TAB, [HEADER, ...remaining.map((u) => [u.username, u.hash])]);
  return remaining.map((u) => ({ username: u.username }));
}

/** Verifica le credenziali contro gli utenti autorizzati salvati nel foglio. */
export async function verifySheetCredential(username: string, password: string): Promise<boolean> {
  const users = await readUsers();
  const match = users.find((u) => u.username.toLowerCase() === username.toLowerCase());
  if (!match) return false;
  return verifyPassword(password, match.hash);
}

/** Distingue un account assente da una password errata. */
export async function verifySheetCredentialState(
  username: string,
  password: string
): Promise<"absent" | "valid" | "invalid"> {
  const users = await readUsers();
  const match = users.find((u) => u.username.toLowerCase() === username.toLowerCase());
  if (!match) return "absent";
  return verifyPassword(password, match.hash) ? "valid" : "invalid";
}

/** Account recuperabili e versione segreta della loro credenziale corrente. */
export async function listRecoverableAccounts(): Promise<RecoverableAccount[]> {
  const users = await readUsers();
  const accounts = users.map((u) => ({
    username: u.username,
    version: createHash("sha256").update(`sheet:${u.hash}`).digest("base64url"),
  }));

  const envUser = process.env.ADMIN_USER?.trim();
  const envPass = process.env.ADMIN_PASSWORD;
  if (envUser && envPass && !accounts.some((u) => u.username.toLowerCase() === envUser.toLowerCase())) {
    accounts.unshift({
      username: envUser,
      version: createHash("sha256").update(`env:${envPass}`).digest("base64url"),
    });
  }

  return accounts;
}
