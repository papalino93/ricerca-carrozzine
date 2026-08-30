import { NextRequest, NextResponse } from "next/server";
import { requireBasicAuth } from "@/lib/basic-auth";
import { rentDevice, returnDevice, sanitizeDevice } from "@/lib/devices";
import { listHistory } from "@/lib/history";
import type { TariffaUnita } from "@/lib/tariffe-types";

export const runtime = "nodejs";

interface EventoBody {
  tipo: "noleggio" | "restituzione" | "sanificazione";
  cliente?: string;
  telefono?: string | null;
  dal?: string | null;
  alPrevisto?: string | null;
  tariffaApplicata?: number | null;
  tariffaUnita?: TariffaUnita | null;
  consegnaRitiro?: number | null;
}

// Riservata all'amministrazione: storico eventi di un dispositivo.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ codice: string }> }
) {
  const unauthorized = await requireBasicAuth(req);
  if (unauthorized) return unauthorized;

  try {
    const { codice } = await params;
    const events = await listHistory(codice);
    return NextResponse.json({ events });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 }
    );
  }
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
          dal: body.dal || null,
          alPrevisto: body.alPrevisto || null,
          tariffaApplicata: body.tariffaApplicata ?? null,
          tariffaUnita: body.tariffaUnita ?? null,
          consegnaRitiro: body.consegnaRitiro ?? null,
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
