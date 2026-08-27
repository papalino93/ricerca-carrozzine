import { NextRequest, NextResponse } from "next/server";
import { requireBasicAuth } from "@/lib/basic-auth";
import { listTabNames, readSheet } from "@/lib/sheets";

export const runtime = "nodejs";
export const maxDuration = 60;

// ROTTA TEMPORANEA DI MISURA — da eliminare subito dopo l'uso.
export async function GET(req: NextRequest) {
  const unauthorized = await requireBasicAuth(req);
  if (unauthorized) return unauthorized;
  try {
    const tabs = await listTabNames();
    const out: Record<string, unknown>[] = [];
    for (const tab of tabs) {
      try {
        const rows = await readSheet(tab);
        const json = JSON.stringify(rows);
        out.push({
          tab,
          righe: rows.length,
          colonne: rows[0]?.length ?? 0,
          caratteri: json.length,
          cellaPiuGrande: Math.max(0, ...rows.flatMap((r) => r.map((c) => (c ?? "").length))),
        });
      } catch (err) {
        out.push({ tab, errore: (err as Error).message });
      }
    }
    return NextResponse.json({ tabs: out });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
