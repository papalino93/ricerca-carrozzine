import "server-only";
import { readSheet, writeSheet } from "./sheets";
import { nextNumeroCommessa } from "./counter";
import { adjustClientPunti } from "./clients";
import { getSettings } from "./settings";
import type { CommessaRecord } from "./commesse-types";

export type { CommessaRecord } from "./commesse-types";

const TAB = "Commesse";
const HEADER = [
  "Numero",
  "Cliente",
  "Indirizzo",
  "Telefono",
  "Cellulare",
  "Vendita",
  "Riparazione",
  "Operatore",
  "RichiesteParticolari",
  "DataOrdine",
  "DataRicezione",
  "ConsegnaPrevista",
  "Acconto",
  "Saldo",
  "RichiestaMedica",
  "Documentazione",
  "DocumentazioneDiagnostica",
  "Altro",
  "ControlloFinale",
  "NoteChiusura",
  "ProntaIl",
  "RitirataIl",
  "Stato",
  "Creata",
  "PuntiAssegnati",
];

const bool = (v: string) => v === "1" || v.toLowerCase() === "true";
const num = (v: string) => (v.trim() === "" ? null : Number(v));

function toCommessa(row: string[]): CommessaRecord {
  const [
    numero,
    cliente,
    indirizzo,
    telefono,
    cellulare,
    vendita,
    riparazione,
    operatore,
    richiesteParticolari,
    dataOrdine,
    dataRicezione,
    consegnaPrevista,
    acconto,
    saldo,
    richiestaMedica,
    documentazione,
    documentazioneDiagnostica,
    altro,
    controlloFinale,
    noteChiusura,
    prontaIl,
    ritirataIl,
    stato,
    creata,
    puntiAssegnati,
  ] = row;
  return {
    numero: numero ?? "",
    cliente: cliente ?? "",
    indirizzo: indirizzo || null,
    telefono: telefono || null,
    cellulare: cellulare || null,
    vendita: bool(vendita ?? ""),
    riparazione: bool(riparazione ?? ""),
    operatore: operatore || null,
    richiesteParticolari: richiesteParticolari || null,
    dataOrdine: dataOrdine || null,
    dataRicezione: dataRicezione || null,
    consegnaPrevista: consegnaPrevista || null,
    acconto: num(acconto ?? ""),
    saldo: num(saldo ?? ""),
    richiestaMedica: bool(richiestaMedica ?? ""),
    documentazione: bool(documentazione ?? ""),
    documentazioneDiagnostica: bool(documentazioneDiagnostica ?? ""),
    altro: bool(altro ?? ""),
    controlloFinale: controlloFinale === "ok" || controlloFinale === "problema" ? controlloFinale : null,
    noteChiusura: noteChiusura || null,
    prontaIl: prontaIl || null,
    ritirataIl: ritirataIl || null,
    stato: stato === "pronta" || stato === "ritirata" ? stato : "in_lavorazione",
    creata: creata || "",
    puntiAssegnati: bool(puntiAssegnati ?? ""),
  };
}

function toRow(c: CommessaRecord): string[] {
  return [
    c.numero,
    c.cliente,
    c.indirizzo ?? "",
    c.telefono ?? "",
    c.cellulare ?? "",
    c.vendita ? "1" : "",
    c.riparazione ? "1" : "",
    c.operatore ?? "",
    c.richiesteParticolari ?? "",
    c.dataOrdine ?? "",
    c.dataRicezione ?? "",
    c.consegnaPrevista ?? "",
    c.acconto != null ? String(c.acconto) : "",
    c.saldo != null ? String(c.saldo) : "",
    c.richiestaMedica ? "1" : "",
    c.documentazione ? "1" : "",
    c.documentazioneDiagnostica ? "1" : "",
    c.altro ? "1" : "",
    c.controlloFinale ?? "",
    c.noteChiusura ?? "",
    c.prontaIl ?? "",
    c.ritirataIl ?? "",
    c.stato,
    c.creata,
    c.puntiAssegnati ? "1" : "",
  ];
}

async function readCommesse(): Promise<CommessaRecord[]> {
  const rows = await readSheet(TAB);
  return rows.slice(1).filter((row) => row.length > 0 && row[0]).map(toCommessa);
}

/** Elenco commesse, più recenti prima. */
export async function listCommesse(): Promise<CommessaRecord[]> {
  const commesse = await readCommesse();
  return commesse.sort((a, b) => Number(b.numero) - Number(a.numero));
}

export async function createCommessa(
  input: Omit<CommessaRecord, "numero" | "stato" | "creata" | "puntiAssegnati">
): Promise<CommessaRecord> {
  const numero = await nextNumeroCommessa();
  const commessa: CommessaRecord = {
    ...input,
    numero,
    stato: "in_lavorazione",
    creata: new Date().toISOString(),
    puntiAssegnati: false,
  };
  const commesse = await readCommesse();
  commesse.push(commessa);
  await writeSheet(TAB, [HEADER, ...commesse.map(toRow)]);
  return commessa;
}

export async function updateCommessa(
  numero: string,
  patch: Partial<Omit<CommessaRecord, "numero" | "creata">>
): Promise<CommessaRecord> {
  const commesse = await readCommesse();
  const idx = commesse.findIndex((c) => c.numero === numero);
  if (idx === -1) throw new Error(`Commessa n. ${numero} non trovata`);
  let next = { ...commesse[idx], ...patch };

  // Al passaggio a "ritirata" (una volta sola per commessa, vedi
  // puntiAssegnati) il saldo pagato genera punti fedeltà al cliente: è il
  // momento in cui ha effettivamente pagato e ritirato, corrisponde a una
  // "vendita" nel sistema fedeltà attuale.
  if (next.stato === "ritirata" && !next.puntiAssegnati && next.saldo && next.saldo > 0) {
    const { puntiPerEuro } = await getSettings();
    await adjustClientPunti(next.cliente, Math.floor(next.saldo * puntiPerEuro));
    next = { ...next, puntiAssegnati: true };
  }

  commesse[idx] = next;
  await writeSheet(TAB, [HEADER, ...commesse.map(toRow)]);
  return next;
}

export async function deleteCommessa(numero: string): Promise<CommessaRecord[]> {
  const commesse = await readCommesse();
  const remaining = commesse.filter((c) => c.numero !== numero);
  if (remaining.length === commesse.length) {
    throw new Error(`Commessa n. ${numero} non trovata`);
  }
  await writeSheet(TAB, [HEADER, ...remaining.map(toRow)]);
  return remaining;
}
