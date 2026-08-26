import "server-only";
import { readSheet, writeSheet } from "./sheets";
import { nextNumeroCommessa } from "./counter";
import type { CommessaRecord } from "./commesse-types";

export type { CommessaRecord } from "./commesse-types";

const TAB = "Commesse";
const HEADER = [
  "Numero",
  "Committente",
  "Indirizzo",
  "Telefono",
  "Cellulare",
  "TipoMateriale",
  "TipoRiparazione",
  "Operatori",
  "RichiesteParticolari",
  "DataInizio",
  "DataConsegnaPrevista",
  "Acconto",
  "Saldo",
  "RichiestaMedica",
  "Documentazione",
  "DocumentazioneDiagnostica",
  "Altro",
  "Verifica",
  "NonConformitaNumero",
  "Esito",
  "DataProntaConsegna",
  "DataRitiro",
  "Stato",
  "Creata",
];

const bool = (v: string) => v === "1" || v.toLowerCase() === "true";
const num = (v: string) => (v.trim() === "" ? null : Number(v));

function toCommessa(row: string[]): CommessaRecord {
  const [
    numero,
    committente,
    indirizzo,
    telefono,
    cellulare,
    tipoMateriale,
    tipoRiparazione,
    operatori,
    richiesteParticolari,
    dataInizio,
    dataConsegnaPrevista,
    acconto,
    saldo,
    richiestaMedica,
    documentazione,
    documentazioneDiagnostica,
    altro,
    verifica,
    nonConformitaNumero,
    esito,
    dataProntaConsegna,
    dataRitiro,
    stato,
    creata,
  ] = row;
  return {
    numero: numero ?? "",
    committente: committente ?? "",
    indirizzo: indirizzo || null,
    telefono: telefono || null,
    cellulare: cellulare || null,
    tipoMateriale: bool(tipoMateriale ?? ""),
    tipoRiparazione: bool(tipoRiparazione ?? ""),
    operatori: operatori || null,
    richiesteParticolari: richiesteParticolari || null,
    dataInizio: dataInizio || null,
    dataConsegnaPrevista: dataConsegnaPrevista || null,
    acconto: num(acconto ?? ""),
    saldo: num(saldo ?? ""),
    richiestaMedica: bool(richiestaMedica ?? ""),
    documentazione: bool(documentazione ?? ""),
    documentazioneDiagnostica: bool(documentazioneDiagnostica ?? ""),
    altro: bool(altro ?? ""),
    verifica: verifica === "ok" || verifica === "c" || verifica === "nc" ? verifica : null,
    nonConformitaNumero: nonConformitaNumero || null,
    esito: esito || null,
    dataProntaConsegna: dataProntaConsegna || null,
    dataRitiro: dataRitiro || null,
    stato: stato === "pronta" || stato === "ritirata" ? stato : "in_lavorazione",
    creata: creata || "",
  };
}

function toRow(c: CommessaRecord): string[] {
  return [
    c.numero,
    c.committente,
    c.indirizzo ?? "",
    c.telefono ?? "",
    c.cellulare ?? "",
    c.tipoMateriale ? "1" : "",
    c.tipoRiparazione ? "1" : "",
    c.operatori ?? "",
    c.richiesteParticolari ?? "",
    c.dataInizio ?? "",
    c.dataConsegnaPrevista ?? "",
    c.acconto != null ? String(c.acconto) : "",
    c.saldo != null ? String(c.saldo) : "",
    c.richiestaMedica ? "1" : "",
    c.documentazione ? "1" : "",
    c.documentazioneDiagnostica ? "1" : "",
    c.altro ? "1" : "",
    c.verifica ?? "",
    c.nonConformitaNumero ?? "",
    c.esito ?? "",
    c.dataProntaConsegna ?? "",
    c.dataRitiro ?? "",
    c.stato,
    c.creata,
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
  input: Omit<CommessaRecord, "numero" | "stato" | "creata">
): Promise<CommessaRecord> {
  const numero = await nextNumeroCommessa();
  const commessa: CommessaRecord = {
    ...input,
    numero,
    stato: "in_lavorazione",
    creata: new Date().toISOString(),
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
  const next = { ...commesse[idx], ...patch };
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
