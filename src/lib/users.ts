import "server-only";
import { randomBytes, scryptSync, timingSafeEqual } from "crypto";
import { readSheet, writeSheet } from "./sheets";

const TAB = "Utenti";
const HEADER = ["Username", "PasswordHash"];

export interface AdminUser {
  username: string;
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
