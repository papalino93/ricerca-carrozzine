import "server-only";
import { readSheet, writeSheet } from "./sheets";
import { nextNumeroFascicolo } from "./counter";
import {
  emptyFascicoloContenuto,
  FASCICOLO_STATO_OPTIONS,
  type FascicoloContenuto,
  type FascicoloRecord,
  type FascicoloStato,
} from "./fascicoli-types";

export type { FascicoloRecord, FascicoloContenuto, FascicoloStato } from "./fascicoli-types";

const TAB = "FascicoliPlantari";
const HEADER = [
  "Numero",
  "ClienteNome",
  "ClienteCF",
  "Commessa",
  "Stato",
  "TipoDispositivo",
  "Operatore",
  "DataCreazione",
  "UltimaModifica",
  "Versione",
  "ContenutoJSON",
];

const VALID_STATI = FASCICOLO_STATO_OPTIONS.map((o) => o.key);

// Stesso margine di sicurezza già usato per note/impostazioni/condizioni
// (vedi devices.ts, settings.ts): ben sotto il limite di 50.000 caratteri
// per cella di Google Sheets, così un salvataggio troppo lungo fallisce con
// un errore chiaro invece di troncare silenziosamente il fascicolo.
const MAX_CONTENUTO_LENGTH = 45_000;

function toFascicolo(row: string[]): FascicoloRecord {
  const [
    numero,
    clienteNome,
    clienteCF,
    commessa,
    stato,
    tipoDispositivo,
    operatore,
    dataCreazione,
    ultimaModifica,
    versione,
    contenutoJson,
  ] = row;

  let contenuto: FascicoloContenuto;
  try {
    // Merge con i default: un fascicolo salvato prima di aggiungere un
    // nuovo campo al contenuto non deve rompersi in lettura, deve solo
    // leggere quel campo come "non compilato".
    const empty = emptyFascicoloContenuto();
    const parsed = contenutoJson ? JSON.parse(contenutoJson) : {};
    contenuto = {
      anamnesi: { ...empty.anamnesi, ...parsed.anamnesi },
      esamePiede: { ...empty.esamePiede, ...parsed.esamePiede },
      prescrizione: { ...empty.prescrizione, ...parsed.prescrizione },
      produzione: { ...empty.produzione, ...parsed.produzione },
      consegna: { ...empty.consegna, ...parsed.consegna },
      consensi: { ...empty.consensi, ...parsed.consensi },
    };
  } catch {
    // Contenuto illeggibile (non dovrebbe succedere): meglio un fascicolo
    // vuoto da ricompilare che una pagina di errore per l'operatore.
    contenuto = emptyFascicoloContenuto();
  }

  return {
    numero: numero ?? "",
    clienteNome: clienteNome ?? "",
    clienteCF: clienteCF || null,
    commessa: commessa || null,
    stato: (VALID_STATI as string[]).includes(stato) ? (stato as FascicoloStato) : "bozza",
    tipoDispositivo: tipoDispositivo || "Plantari su misura",
    operatore: operatore || null,
    dataCreazione: dataCreazione || "",
    ultimaModifica: ultimaModifica || dataCreazione || "",
    versione: Number(versione) || 1,
    contenuto,
  };
}

function toRow(f: FascicoloRecord): string[] {
  const json = JSON.stringify(f.contenuto);
  if (json.length > MAX_CONTENUTO_LENGTH) {
    throw new Error(
      `Il fascicolo ${f.numero} contiene troppe note/testo libero: abbrevia i campi più lunghi prima di salvare.`
    );
  }
  return [
    f.numero,
    f.clienteNome,
    f.clienteCF ?? "",
    f.commessa ?? "",
    f.stato,
    f.tipoDispositivo,
    f.operatore ?? "",
    f.dataCreazione,
    f.ultimaModifica,
    String(f.versione),
    json,
  ];
}

async function readFascicoli(): Promise<FascicoloRecord[]> {
  const rows = await readSheet(TAB);
  return rows.slice(1).filter((r) => r.length > 0 && r[0]).map(toFascicolo);
}

/** Elenco fascicoli, più recenti prima (per numero: PL-2026-0048 dopo PL-2026-0001). */
export async function listFascicoli(): Promise<FascicoloRecord[]> {
  const fascicoli = await readFascicoli();
  return fascicoli.sort((a, b) => (a.numero < b.numero ? 1 : a.numero > b.numero ? -1 : 0));
}

export async function getFascicolo(numero: string): Promise<FascicoloRecord | null> {
  const fascicoli = await readFascicoli();
  return fascicoli.find((f) => f.numero === numero) ?? null;
}

/** Tutti i fascicoli di un cliente (stesso nome, case-insensitive come clients.ts), più recenti prima. */
export async function listFascicoliCliente(clienteNome: string): Promise<FascicoloRecord[]> {
  const target = clienteNome.trim().toLowerCase();
  const fascicoli = await listFascicoli();
  return fascicoli.filter((f) => f.clienteNome.trim().toLowerCase() === target);
}

export async function createFascicolo(input: {
  clienteNome: string;
  clienteCF?: string | null;
  commessa?: string | null;
  tipoDispositivo?: string;
  operatore?: string | null;
  /** Duplicazione intelligente: dati anagrafici/contatto sì, informazioni
   * cliniche no — il chiamante decide cosa passare qui (vedi
   * /api/fascicoli). */
  contenutoIniziale?: Partial<FascicoloContenuto>;
}): Promise<FascicoloRecord> {
  const clienteNome = input.clienteNome.trim();
  if (!clienteNome) throw new Error("Cliente obbligatorio");

  const anno = new Date().getFullYear();
  const numero = await nextNumeroFascicolo(anno);
  const now = new Date().toISOString();
  const empty = emptyFascicoloContenuto();

  const fascicolo: FascicoloRecord = {
    numero,
    clienteNome,
    clienteCF: input.clienteCF || null,
    commessa: input.commessa || null,
    stato: "bozza",
    tipoDispositivo: input.tipoDispositivo || "Plantari su misura",
    operatore: input.operatore || null,
    dataCreazione: now,
    ultimaModifica: now,
    versione: 1,
    contenuto: {
      ...empty,
      ...input.contenutoIniziale,
    },
  };

  const fascicoli = await readFascicoli();
  fascicoli.push(fascicolo);
  await writeSheet(TAB, [HEADER, ...fascicoli.map(toRow)]);
  return fascicolo;
}

export interface UpdateFascicoloInput {
  clienteNome?: string;
  clienteCF?: string | null;
  commessa?: string | null;
  stato?: FascicoloStato;
  tipoDispositivo?: string;
  operatore?: string | null;
  /** Merge parziale per sezione: { contenuto: { anamnesi: {...} } }
   * sostituisce SOLO la sezione "anamnesi", le altre restano intatte —
   * ogni tab dell'editor salva la propria sezione per intero. */
  contenuto?: Partial<FascicoloContenuto>;
  /** true sui salvataggi "pieni" del contenuto di una sezione, false
   * sull'autosave silenzioso o su un semplice cambio di stato — evita di
   * far esplodere il numero di versione a ogni battitura. */
  incrementaVersione?: boolean;
}

export async function updateFascicolo(numero: string, patch: UpdateFascicoloInput): Promise<FascicoloRecord> {
  const fascicoli = await readFascicoli();
  const idx = fascicoli.findIndex((f) => f.numero === numero);
  if (idx === -1) throw new Error(`Fascicolo ${numero} non trovato`);

  const prev = fascicoli[idx];
  const { contenuto, incrementaVersione, ...rest } = patch;
  const next: FascicoloRecord = {
    ...prev,
    ...rest,
    contenuto: contenuto
      ? {
          anamnesi: { ...prev.contenuto.anamnesi, ...contenuto.anamnesi },
          esamePiede: { ...prev.contenuto.esamePiede, ...contenuto.esamePiede },
          prescrizione: { ...prev.contenuto.prescrizione, ...contenuto.prescrizione },
          produzione: { ...prev.contenuto.produzione, ...contenuto.produzione },
          consegna: { ...prev.contenuto.consegna, ...contenuto.consegna },
          consensi: { ...prev.contenuto.consensi, ...contenuto.consensi },
        }
      : prev.contenuto,
    ultimaModifica: new Date().toISOString(),
    versione: incrementaVersione ? prev.versione + 1 : prev.versione,
  };

  fascicoli[idx] = next;
  await writeSheet(TAB, [HEADER, ...fascicoli.map(toRow)]);
  return next;
}
