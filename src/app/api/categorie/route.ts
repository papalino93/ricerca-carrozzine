import { NextRequest, NextResponse } from "next/server";
import { requireBasicAuth } from "@/lib/basic-auth";
import { addCategory, listCategories, removeCategory } from "@/lib/categories";
import { listDevices } from "@/lib/devices";

export const runtime = "nodejs";

// Pubblica: serve al filtro categoria della ricerca pubblica.
export async function GET() {
  try {
    const categories = await listCategories();
    return NextResponse.json({ categories });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

// Scrittura: riservata all'amministrazione.
export async function POST(req: NextRequest) {
  const unauthorized = await requireBasicAuth(req);
  if (unauthorized) return unauthorized;

  try {
    const { nome } = (await req.json()) as { nome: string };
    const categories = await addCategory(nome);
    return NextResponse.json({ categories });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest) {
  const unauthorized = await requireBasicAuth(req);
  if (unauthorized) return unauthorized;

  try {
    const nome = req.nextUrl.searchParams.get("nome");
    if (!nome) {
      return NextResponse.json({ error: "Nome obbligatorio" }, { status: 400 });
    }
    const devices = await listDevices();
    const inUse = devices.filter(
      (d) => d.categoria.toLowerCase() === nome.trim().toLowerCase()
    ).length;
    if (inUse > 0) {
      return NextResponse.json(
        {
          error: `Non puoi eliminare "${nome}": ${inUse} dispositivi la usano ancora. Cambia prima la loro categoria.`,
        },
        { status: 400 }
      );
    }
    const categories = await removeCategory(nome);
    return NextResponse.json({ categories });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
