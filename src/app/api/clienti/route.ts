import { NextRequest, NextResponse } from "next/server";
import { requireBasicAuth } from "@/lib/basic-auth";
import {
  adjustClientPunti,
  assignFidelity,
  createClient,
  deleteClient,
  renameClient,
  updateClientAnagrafica,
  type ClientRecord,
} from "@/lib/clients";
import { renameDeviceClienti } from "@/lib/devices";
import { renameCommesseCliente } from "@/lib/commesse";
import { renameHistoryCliente } from "@/lib/history";
import { renameFascicoliCliente } from "@/lib/fascicoli";

export const runtime = "nodejs";

// Crea un nuovo cliente in anagrafica (es. nuova iscrizione fidelity senza
// che sia già passato da un noleggio o una commessa, oppure un cliente
// nuovo aperto dal modulo Fascicoli Plantari — che passa anche i campi
// anagrafici aggiuntivi in un solo giro, vedi createClient).
export async function POST(req: NextRequest) {
  const unauthorized = await requireBasicAuth(req);
  if (unauthorized) return unauthorized;

  try {
    const body = (await req.json()) as {
      nome?: string;
      cellulare?: string | null;
      email?: string | null;
      indirizzo?: string | null;
      cognome?: string | null;
      nomeProprio?: string | null;
      codiceFiscale?: string | null;
      dataNascita?: string | null;
      luogoNascita?: string | null;
      telefono?: string | null;
      cap?: string | null;
      localita?: string | null;
      provincia?: string | null;
    };
    if (!body.nome || !body.nome.trim()) {
      return NextResponse.json({ error: "Nome obbligatorio" }, { status: 400 });
    }
    const { client, clients } = await createClient({
      nome: body.nome,
      cellulare: body.cellulare || null,
      email: body.email || null,
      indirizzo: body.indirizzo || null,
      cognome: body.cognome || null,
      nomeProprio: body.nomeProprio || null,
      codiceFiscale: body.codiceFiscale || null,
      dataNascita: body.dataNascita || null,
      luogoNascita: body.luogoNascita || null,
      telefono: body.telefono || null,
      cap: body.cap || null,
      localita: body.localita || null,
      provincia: body.provincia || null,
    });
    return NextResponse.json({ client, clients });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 400 }
    );
  }
}

// Rettifica manuale dei punti fedeltà (es. una vendita non passata da
// Commesse, o una correzione): {nome, delta}. L'accredito automatico da una
// commessa ritirata resta in commesse.ts, questo serve solo per i casi che
// il flusso automatico non copre.
export async function PATCH(req: NextRequest) {
  const unauthorized = await requireBasicAuth(req);
  if (unauthorized) return unauthorized;

  try {
    const body = (await req.json()) as {
      nome?: string;
      delta?: number;
      azione?: "tessera" | "anagrafica";
      patch?: Partial<Omit<ClientRecord, "punti" | "fidelity">>;
      /** Nuovo nome, se l'operatore corregge un refuso: rinomina la riga
       * anagrafica E propaga il cambiamento a noleggi/commesse/storico che
       * ancora referenziano il nome vecchio (vedi renameClient in clients.ts
       * per il perché serve propagarlo, non solo rinominare la riga). */
      nuovoNome?: string;
    };
    if (!body.nome) {
      return NextResponse.json({ error: "Nome obbligatorio" }, { status: 400 });
    }

    // Rilascio della tessera a un cliente già in anagrafica (arrivato da un
    // noleggio o dai punti di una commessa): createClient lo rifiuterebbe
    // come duplicato, quindi senza questo non avrebbe altro modo di averne
    // una.
    if (body.azione === "tessera") {
      const { client, clients } = await assignFidelity(body.nome);
      return NextResponse.json({ client, clients });
    }

    // Correzione/completamento dell'anagrafica di un cliente esistente
    // (es. si scopre il codice fiscale mentre si compila un fascicolo
    // plantare): usata dal modulo Fascicoli Plantari, riusabile ovunque.
    if (body.azione === "anagrafica") {
      let nomeCorrente = body.nome;
      const nuovoNome = body.nuovoNome?.trim();
      if (nuovoNome && nuovoNome !== nomeCorrente) {
        await renameClient(nomeCorrente, nuovoNome);
        // Propagazione best-effort: la riga anagrafica è già stata
        // rinominata con successo, un problema qui non deve bloccare il
        // salvataggio — resterebbe solo qualche vecchio riferimento non
        // aggiornato, recuperabile a mano, invece di un errore a operazione
        // ormai avvenuta.
        try {
          await Promise.all([
            renameDeviceClienti(nomeCorrente, nuovoNome),
            renameCommesseCliente(nomeCorrente, nuovoNome),
            renameHistoryCliente(nomeCorrente, nuovoNome),
            renameFascicoliCliente(nomeCorrente, nuovoNome),
          ]);
        } catch (err) {
          console.error("Propagazione rinomina cliente non riuscita:", err);
        }
        nomeCorrente = nuovoNome;
      }
      const client = await updateClientAnagrafica(nomeCorrente, body.patch ?? {});
      return NextResponse.json({ client });
    }

    if (!Number.isFinite(body.delta)) {
      return NextResponse.json({ error: "Nome e delta obbligatori" }, { status: 400 });
    }
    const clients = await adjustClientPunti(body.nome, Math.trunc(body.delta as number));
    return NextResponse.json({ clients });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 }
    );
  }
}

// Riservata all'amministrazione: elimina una riga dall'anagrafica clienti
// (es. un cliente creato per errore). L'anagrafica si popola da sola a ogni
// noleggio (vedi upsertClient in clients.ts): qui serve solo la correzione.
export async function DELETE(req: NextRequest) {
  const unauthorized = await requireBasicAuth(req);
  if (unauthorized) return unauthorized;

  try {
    const nome = req.nextUrl.searchParams.get("nome");
    if (!nome) {
      return NextResponse.json({ error: "Nome obbligatorio" }, { status: 400 });
    }
    const clients = await deleteClient(nome);
    return NextResponse.json({ clients });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 }
    );
  }
}
