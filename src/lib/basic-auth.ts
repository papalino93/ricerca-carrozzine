import { NextRequest, NextResponse } from "next/server";

const REALM = "Area amministrazione";

function isAuthorized(req: NextRequest): boolean {
  const user = process.env.ADMIN_USER;
  const pass = process.env.ADMIN_PASSWORD;
  if (!user || !pass) return false;

  const header = req.headers.get("authorization");
  if (!header?.startsWith("Basic ")) return false;

  let decoded: string;
  try {
    // atob (Web API) works in both the Edge and Node.js runtimes, unlike Buffer.
    decoded = atob(header.slice(6));
  } catch {
    return false;
  }

  const sep = decoded.indexOf(":");
  if (sep === -1) return false;

  const providedUser = decoded.slice(0, sep);
  const providedPass = decoded.slice(sep + 1);
  return providedUser === user && providedPass === pass;
}

/** Returns a 401 response when the request isn't authorized, otherwise null. */
export function requireBasicAuth(req: NextRequest): NextResponse | null {
  if (isAuthorized(req)) return null;
  return new NextResponse("Accesso riservato all'amministrazione.", {
    status: 401,
    headers: {
      "WWW-Authenticate": `Basic realm="${REALM}", charset="UTF-8"`,
    },
  });
}
