import "server-only";
import { createHash, createHmac, timingSafeEqual } from "crypto";
import { listRecoverableAccounts } from "./users";

const TOKEN_MAX_AGE_MS = 15 * 60 * 1000;

interface RecoveryPayload {
  username: string;
  expiresAt: number;
  version: string;
}

function recoverySecret(): Buffer {
  const source =
    process.env.AUTH_RECOVERY_SECRET ??
    process.env.AUTH_SESSION_SECRET ??
    process.env.ADMIN_PASSWORD;
  if (!source) throw new Error("Configura AUTH_RECOVERY_SECRET");
  return createHash("sha256").update(`medical-center-recovery:${source}`).digest();
}

function sign(value: string): string {
  return createHmac("sha256", recoverySecret()).update(value).digest("base64url");
}

export function createRecoveryToken(username: string, version: string): string {
  const payload: RecoveryPayload = {
    username,
    version,
    expiresAt: Date.now() + TOKEN_MAX_AGE_MS,
  };
  const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  return `${encoded}.${sign(encoded)}`;
}

export async function readValidRecoveryToken(token: string): Promise<RecoveryPayload | null> {
  const [encoded, received] = token.split(".");
  if (!encoded || !received) return null;

  try {
    const expected = sign(encoded);
    const a = Buffer.from(received, "utf8");
    const b = Buffer.from(expected, "utf8");
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as RecoveryPayload;
    if (!payload.username || !payload.version || payload.expiresAt <= Date.now()) return null;

    const accounts = await listRecoverableAccounts();
    const current = accounts.find(
      (account) => account.username.toLowerCase() === payload.username.toLowerCase()
    );
    // Il token si annulla automaticamente appena la password cambia.
    if (!current || current.version !== payload.version) return null;
    return payload;
  } catch {
    return null;
  }
}

export function recoveryRecipients(): string[] {
  return (process.env.AUTH_RECOVERY_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim())
    .filter(Boolean);
}
