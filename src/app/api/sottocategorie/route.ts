import { NextRequest, NextResponse } from "next/server";
import { requireBasicAuth } from "@/lib/basic-auth";
import {
  addSottocategoria,
  listSottocategorie,
  removeSottocategoria,
  renameSottocategoria,
} from "@/lib/sottocategorie";
import { countDevicesBySottocategoria, renameDeviceSottocategoria } from "@/lib/devices";
import { listTariffe, removeTariffa, renameTariffaSottocategoria, upsertTariffa } from "@/lib/tariffe";
import type { TariffaUnita } from "@/lib/tariffe-types";

export const runtime = "nodejs";

// Serve al pannello "Impostazioni → Categorie" (richiede login, vedi proxy.ts).
export async function GET(req: NextRequest) {
  try {
    const categoria = req.nextUrl.searchParams.get("categoria") ?? undefined;
    const [rows, tariffe] = await Promise.all([listSottocategorie(categoria), listTariffe()]);
    const sottocategorie = await Promise.all(
      rows.map(async (r) => {
        const ausiliCount = await countDevicesBySottocategoria(r.categoria, r.nome);
        const tariffa =
          tariffe.find(
            (t) =>
              t.categoria.trim().toLowerCase() === r.categoria.trim().toLowerCase() &&
              (t.sottocategoria ?? "").trim().toLowerCase() === r.nome.trim().toLowerCase()
          ) ?? null;
        return { categoria: r.categoria, nome: r.nome, ausiliCount, tariffa };
      })
    );
    return NextResponse.json({ sottocategorie });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

interface TariffaInput {
  importo?: number | null;
  unita?: TariffaUnita;
  nota?: string | null;
}

// Se arriva un importo valido, crea/aggiorna la tariffa dedicata a quella
// sottocategoria; altrimenti rimuove quella eventualmente esistente (campo
// svuotato = "usa la tariffa della categoria", non "lascia quella vecchia").
async function syncTariffa(categoria: string, nome: string, input: TariffaInput): Promise<void> {
  if (input.importo != null && input.importo > 0) {
    // Questo form non gestisce consegna/ritiro (si imposta da Impostazioni →
    // Tariffe): va preservato com'era, non azzerato dal salvataggio qui.
    const existing = (await listTariffe()).find(
      (t) =>
        t.categoria.trim().toLowerCase() === categoria.trim().toLowerCase() &&
        (t.sottocategoria ?? "").trim().toLowerCase() === nome.trim().toLowerCase()
    );
    await upsertTariffa({
      categoria: categoria.trim(),
      sottocategoria: nome.trim(),
      importo: input.importo,
      unita: input.unita === "settimana" ? "settimana" : "giorno",
      nota: input.nota || null,
      consegnaRitiro: existing?.consegnaRitiro ?? null,
    });
  } else {
    await removeTariffa(categoria, nome);
  }
}

// Scrittura: riservata all'amministrazione.
export async function POST(req: NextRequest) {
  const unauthorized = await requireBasicAuth(req);
  if (unauthorized) return unauthorized;

  try {
    const body = (await req.json()) as { categoria: string; nome: string } & TariffaInput;
    await addSottocategoria(body.categoria, body.nome);
    if (body.importo != null && body.importo > 0) {
      await syncTariffa(body.categoria, body.nome, body);
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}

// Rinomina una sottocategoria e/o aggiorna la sua tariffa dedicata.
export async function PATCH(req: NextRequest) {
  const unauthorized = await requireBasicAuth(req);
  if (unauthorized) return unauthorized;

  try {
    const body = (await req.json()) as { categoria: string; nome: string; nuovoNome?: string } & TariffaInput;
    const { categoria, nome } = body;
    if (!categoria || !nome) {
      return NextResponse.json({ error: "Categoria e nome obbligatori" }, { status: 400 });
    }
    let currentNome = nome;
    const cleanNuovo = (body.nuovoNome ?? "").trim();
    if (cleanNuovo && cleanNuovo !== nome.trim()) {
      await renameSottocategoria(categoria, nome, cleanNuovo);
      await renameDeviceSottocategoria(categoria, nome, cleanNuovo);
      await renameTariffaSottocategoria(categoria, nome, cleanNuovo);
      currentNome = cleanNuovo;
    }
    await syncTariffa(categoria, currentNome, body);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest) {
  const unauthorized = await requireBasicAuth(req);
  if (unauthorized) return unauthorized;

  try {
    const categoria = req.nextUrl.searchParams.get("categoria");
    const nome = req.nextUrl.searchParams.get("nome");
    if (!categoria || !nome) {
      return NextResponse.json({ error: "Categoria e nome obbligatori" }, { status: 400 });
    }
    const inUse = await countDevicesBySottocategoria(categoria, nome);
    if (inUse > 0) {
      return NextResponse.json(
        {
          error: `Non puoi eliminare "${nome}": ${inUse} ausili la usano ancora. Cambia prima la loro sottocategoria.`,
        },
        { status: 400 }
      );
    }
    await removeSottocategoria(categoria, nome);
    // Non lasciare una tariffa "orfana" agganciata a una sottocategoria che
    // da Impostazioni risulta non esistere più.
    await removeTariffa(categoria, nome);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
