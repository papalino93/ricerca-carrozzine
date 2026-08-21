import { NextRequest, NextResponse } from "next/server";
import { requireBasicAuth } from "@/lib/basic-auth";
import { rentDevice, returnDevice, sanitizeDevice } from "@/lib/devices";

export const runtime = "nodejs";

interface EventoBody {
  tipo: "noleggio" | "restituzione" | "sanificazione";
  cliente?: string;
  telefono?: string | null;
  contratto?: string | null;
  dal?: string | null;
}

// Riservata all'amministrazione: cambia stato del dispositivo e registra l'evento nello Storico.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ codice: string }> }
) {
  const unauthorized = await requireBasicAuth(req);
  if (unauthorized) return unauthorized;

  try {
    const { codice } = await params;
    const body = (await req.json()) as EventoBody;

    let devices;
    switch (body.tipo) {
      case "noleggio":
        if (!body.cliente?.trim()) {
          return NextResponse.json({ error: "Cliente obbligatorio" }, { status: 400 });
        }
        devices = await rentDevice(codice, {
          cliente: body.cliente.trim(),
          telefono: body.telefono?.trim() || null,
          contratto: body.contratto?.trim() || null,
          dal: body.dal || null,
        });
        break;
      case "restituzione":
        devices = await returnDevice(codice);
        break;
      case "sanificazione":
        devices = await sanitizeDevice(codice);
        break;
      default:
        return NextResponse.json({ error: "Tipo evento non valido" }, { status: 400 });
    }

    return NextResponse.json({ devices });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 }
    );
  }
}
