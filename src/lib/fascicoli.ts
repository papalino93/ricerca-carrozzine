import "server-only";
import { readSheet, writeSheet } from "./sheets";
import { nextNumeroFascicolo } from "./counter";
import { normalizeName } from "./clients";
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

/** Corregge il nome cliente sui fascicoli collegati, quando il nome viene
 * rinominato in anagrafica (vedi renameClient in clients.ts): senza questo,
 * i fascicoli di un cliente rinominato resterebbero agganciati al nome
 * vecchio e sparirebbero dalla sua scheda cliente (che li cerca per nome). */
export async function renameFascicoliCliente(nomeAttuale: string, nuovoNome: string): Promise<number> {
  const fascicoli = await readFascicoli();
  const target = normalizeName(nomeAttuale);
  let count = 0;
  for (const f of fascicoli) {
    if (normalizeName(f.clienteNome) === target) {
      f.clienteNome = nuovoNome;
      count++;
    }
  }
  if (count > 0) await writeSheet(TAB, [HEADER, ...fascicoli.map(toRow)]);
  return count;
}

/** Tutti i fascicoli di un cliente (stesso nome, normalizzato come clients.ts), più recenti prima. */
export async function listFascicoliCliente(clienteNome: string): Promise<FascicoloRecord[]> {
  const target = normalizeName(clienteNome);
  const fascicoli = await listFascicoli();
  return fascicoli.filter((f) => normalizeName(f.clienteNome) === target);
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
  /** "ultimaModifica" che il chiamante si aspetta di trovare ancora sul
   * fascicolo prima di scrivere sopra: senza, due scritture quasi
   * simultanee (due schede aperte sullo stesso fascicolo, o l'autosave che
   * parte mentre un salvataggio manuale è ancora in corso) leggono lo
   * stesso stato di partenza e l'ultima a scrivere cancella in silenzio i
   * campi cambiati dall'altra — l'intero foglio viene riscritto ad ogni
   * salvataggio, non solo la riga di questo fascicolo. Se passato e non
   * coincide più, lancia ConflictError invece di sovrascrivere. Facoltativo
   * per restare compatibile con chiamate che non lo passano. */
  ifUltimaModifica?: string;
}

/** Lanciato da updateFascicolo quando ifUltimaModifica non coincide più:
 * il chiamante l'ha già distinguibile da un errore di validazione normale
 * (vedi route API, che lo traduce in HTTP 409). */
export class FascicoloConflictError extends Error {
  constructor(numero: string) {
    super(
      `Il fascicolo ${numero} è stato modificato nel frattempo (un'altra scheda aperta, o un altro operatore): ricarica la pagina prima di continuare, per non perdere quel salvataggio.`
    );
    this.name = "FascicoloConflictError";
  }
}

export async function updateFascicolo(numero: string, patch: UpdateFascicoloInput): Promise<FascicoloRecord> {
  const fascicoli = await readFascicoli();
  const idx = fascicoli.findIndex((f) => f.numero === numero);
  if (idx === -1) throw new Error(`Fascicolo ${numero} non trovato`);

  const prev = fascicoli[idx];
  if (patch.ifUltimaModifica != null && patch.ifUltimaModifica !== prev.ultimaModifica) {
    throw new FascicoloConflictError(numero);
  }
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

  // Il client ha min/max sugli input, ma quello non impedisce una scrittura
  // diretta all'API: qui è dove un'altezza o un importo negativo/assurdo
  // vengono davvero bloccati prima di finire su un documento regolamentare.
  const { altezzaCm, pesoKg } = next.contenuto.anamnesi;
  if (altezzaCm != null && (altezzaCm < 30 || altezzaCm > 260)) {
    throw new Error("Altezza non valida: deve essere tra 30 e 260 cm.");
  }
  if (pesoKg != null && (pesoKg < 1 || pesoKg > 350)) {
    throw new Error("Peso non valido: deve essere tra 1 e 350 kg.");
  }
  if (next.contenuto.prescrizione.importo != null && next.contenuto.prescrizione.importo < 0) {
    throw new Error("L'importo non può essere negativo.");
  }

  fascicoli[idx] = next;
  await writeSheet(TAB, [HEADER, ...fascicoli.map(toRow)]);
  return next;
}

/** Elimina definitivamente un fascicolo (es. creato per errore o per prova).
 * A differenza dei dispositivi, qui non c'è un flag "archiviato" separato
 * da preservare: lo stato "archiviato" (vedi FascicoloStato) è già il modo
 * per tenere un fascicolo concluso fuori dai filtri attivi restando
 * consultabile. Questa è la cancellazione vera e propria — irreversibile,
 * per questo l'interfaccia la protegge con una doppia conferma. */
export async function deleteFascicolo(numero: string): Promise<void> {
  const fascicoli = await readFascicoli();
  const next = fascicoli.filter((f) => f.numero !== numero);
  if (next.length === fascicoli.length) {
    throw new Error(`Fascicolo ${numero} non trovato`);
  }
  await writeSheet(TAB, [HEADER, ...next.map(toRow)]);
}
