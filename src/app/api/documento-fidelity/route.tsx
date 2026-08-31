import { NextRequest, NextResponse } from "next/server";
import { requireBasicAuth } from "@/lib/basic-auth";
import { renderToBuffer } from "@react-pdf/renderer";
import { getSettings } from "@/lib/settings";
import { FidelityModule } from "@/lib/pdf/FidelityModule";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function buildDocument(settings: Awaited<ReturnType<typeof getSettings>>) {
  return <FidelityModule settings={settings} />;
}

// Modulo in bianco (nessun cliente specifico: da compilare a mano per un
// nuovo iscritto), quindi GET senza corpo — a differenza di /api/documento
// che genera un verbale legato a un noleggio esistente.
export async function GET(req: NextRequest) {
  const unauthorized = await requireBasicAuth(req);
  if (unauthorized) return unauthorized;

  try {
    const settings = await getSettings();
    const buffer = await renderToBuffer(buildDocument(settings));
    const bytes = new Uint8Array(buffer);
    return new NextResponse(new Blob([bytes]), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'attachment; filename="modulo-adesione-fidelity.pdf"',
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
