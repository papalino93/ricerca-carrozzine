import { NextRequest, NextResponse } from "next/server";
import { requireBasicAuth } from "@/lib/basic-auth";
import { generaMatricolaAsl } from "@/lib/fascicoli";

export const runtime = "nodejs";

// Genera (o, se già assegnata, riporta senza consumarne una seconda) la
// matricola ASL del fascicolo: vedi generaMatricolaAsl in fascicoli.ts.
export async function POST(req: NextRequest, { params }: { params: Promise<{ numero: string }> }) {
  const unauthorized = await requireBasicAuth(req);
  if (unauthorized) return unauthorized;

  try {
    const { numero } = await params;
    const fascicolo = await generaMatricolaAsl(numero);
    return NextResponse.json({ fascicolo });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
