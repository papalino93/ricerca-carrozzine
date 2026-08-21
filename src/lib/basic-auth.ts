import { createHash } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { verifySheetCredential } from "./users";

const REALM = "Area amministrazione";

// Piccola cache in memoria per evitare di interrogare il foglio Google ad
// ogni richiesta mentre l'istanza serverless resta calda. Best-effort: in
// caso di cold start si fa semplicemente una verifica in più.
const CACHE_TTL_MS = 30_000;
let cache: { key: string; ok: boolean; expires: number } | null = null;

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

async function isAuthorized(req: NextRequest): Promise<boolean> {
  const creds = decodeBasicAuth(req);
  if (!creds) return false;
  const { username, password } = creds;

  // Credenziali "di base" da variabili d'ambiente: sempre valide, nessuna
  // chiamata a Google Sheets necessaria.
  const envUser = process.env.ADMIN_USER;
  const envPass = process.env.ADMIN_PASSWORD;
  if (envUser && envPass && username === envUser && password === envPass) {
    return true;
  }

  const cacheKey = createHash("sha256").update(`${username}:${password}`).digest("hex");
  if (cache && cache.key === cacheKey && cache.expires > Date.now()) {
    return cache.ok;
  }

  let ok = false;
  try {
    ok = await verifySheetCredential(username, password);
  } catch {
    ok = false;
  }
  cache = { key: cacheKey, ok, expires: Date.now() + CACHE_TTL_MS };
  return ok;
}

/** Returns a 401 response when the request isn't authorized, otherwise null. */
export async function requireBasicAuth(req: NextRequest): Promise<NextResponse | null> {
  if (await isAuthorized(req)) return null;
  return new NextResponse("Accesso riservato all'amministrazione.", {
    status: 401,
    headers: {
      "WWW-Authenticate": `Basic realm="${REALM}", charset="UTF-8"`,
    },
  });
}
