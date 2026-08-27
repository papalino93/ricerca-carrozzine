import "server-only";
import { readSheet, writeSheet } from "./sheets";
import { nextNumeroFidelity } from "./counter";

export interface ClientRecord {
  nome: string;
  telefono: string | null;
  ultimoContratto: string | null;
  ultimoNoleggio: string | null;
  /** Campi anagrafica: valorizzati solo da import CSV o inserimento manuale,
   * mai dai noleggi (che conoscono solo nome e telefono). */
  cognome: string | null;
  nomeProprio: string | null;
  sesso: string | null;
  indirizzo: string | null;
  cap: string | null;
  localita: string | null;
  provincia: string | null;
  cellulare: string | null;
  email: string | null;
  dataNascita: string | null;
  luogoNascita: string | null;
  /** Numero della tessera fedeltà nel programma punti (gestito ancora fuori
   * da questo sito, vedi fedelta.store): qui solo tracciato come riferimento. */
  fidelity: string | null;
  categoria: string | null;
  /** Punti fedeltà accumulati qui (non sincronizzati con fedelta.store):
   * 1 punto per ogni euro di saldo su una commessa ritirata, stesso rapporto
   * osservato nel sistema attuale, più eventuali rettifiche manuali. */
  punti: number;
}

const TAB = "Clienti";
const HEADER = [
  "Nome",
  "Telefono",
  "UltimoContratto",
  "UltimoNoleggio",
  "Cognome",
  "NomeProprio",
  "Sesso",
  "Indirizzo",
  "Cap",
  "Localita",
  "Provincia",
  "Cellulare",
  "Email",
  "DataNascita",
  "LuogoNascita",
  "Fidelity",
  "Categoria",
  "Punti",
];

function toClient(row: string[]): ClientRecord {
  const [
    nome,
    telefono,
    ultimoContratto,
    ultimoNoleggio,
    cognome,
    nomeProprio,
    sesso,
    indirizzo,
    cap,
    localita,
    provincia,
    cellulare,
    email,
    dataNascita,
    luogoNascita,
    fidelity,
    categoria,
    punti,
  ] = row;
  return {
    nome: nome ?? "",
    telefono: telefono || null,
    ultimoContratto: ultimoContratto || null,
    ultimoNoleggio: ultimoNoleggio || null,
    cognome: cognome || null,
    nomeProprio: nomeProprio || null,
    sesso: sesso || null,
    indirizzo: indirizzo || null,
    cap: cap || null,
    localita: localita || null,
    provincia: provincia || null,
    cellulare: cellulare || null,
    email: email || null,
    dataNascita: dataNascita || null,
    luogoNascita: luogoNascita || null,
    fidelity: fidelity || null,
    categoria: categoria || null,
    punti: Number(punti) || 0,
  };
}

function toRow(c: ClientRecord): string[] {
  return [
    c.nome,
    c.telefono ?? "",
    c.ultimoContratto ?? "",
    c.ultimoNoleggio ?? "",
    c.cognome ?? "",
    c.nomeProprio ?? "",
    c.sesso ?? "",
    c.indirizzo ?? "",
    c.cap ?? "",
    c.localita ?? "",
    c.provincia ?? "",
    c.cellulare ?? "",
    c.email ?? "",
    c.dataNascita ?? "",
    c.luogoNascita ?? "",
    c.fidelity ?? "",
    c.categoria ?? "",
    String(c.punti),
  ];
}

async function readClients(): Promise<ClientRecord[]> {
  const rows = await readSheet(TAB);
  return rows.slice(1).filter((row) => row.length > 0 && row[0]).map(toClient);
}

/**
 * Forma con cui si confrontano due nomi cliente. Da usare SEMPRE su
 * entrambi i lati del confronto: se si normalizza solo il nome in ingresso,
 * una riga salvata con uno spazio di troppo (copiata a mano nel foglio, o
 * arrivata da un import) non viene riconosciuta e si finisce per creare un
 * secondo cliente con lo stesso nome — con punti e tessera separati.
 *
 * Anche gli spazi INTERNI vanno collassati: "Mario  Rossi" digitato con due
 * spazi è la stessa persona di "Mario Rossi", e senza questo diventerebbero
 * due clienti distinti con due saldi punti.
 */
export function normalizeName(nome: string): string {
  return nome.trim().replace(/\s+/g, " ").toLowerCase();
}

/** Anagrafica clienti: popolata automaticamente a ogni noleggio, più i campi
 * aggiuntivi importati da CSV o inseriti a mano (vedi importClientsCsv). */
export async function listClients(): Promise<ClientRecord[]> {
  return readClients();
}

/**
 * Crea un nuovo cliente da zero (iscrizione manuale al banco o alla
 * fidelity card): a differenza di upsertClient, qui un nome già esistente è
 * un errore, non un aggiornamento — evita di creare per sbaglio un
 * duplicato quando si intendeva invece cercare il cliente già in anagrafica.
 */
export async function createClient(input: {
  nome: string;
  cellulare: string | null;
  email: string | null;
  indirizzo: string | null;
}): Promise<{ client: ClientRecord; clients: ClientRecord[] }> {
  const nome = input.nome.trim();
  if (!nome) throw new Error("Nome obbligatorio");
  const clients = await readClients();
  if (clients.some((c) => normalizeName(c.nome) === normalizeName(nome))) {
    throw new Error(`"${nome}" esiste già in anagrafica`);
  }
  // Il numero di tessera è assegnato qui, mai digitato dall'operatore:
  // deve restare univoco (vedi counter.ts).
  const fidelity = await nextNumeroFidelity();
  const client: ClientRecord = {
    nome,
    telefono: null,
    ultimoContratto: null,
    ultimoNoleggio: null,
    cognome: null,
    nomeProprio: null,
    sesso: null,
    indirizzo: input.indirizzo || null,
    cap: null,
    localita: null,
    provincia: null,
    cellulare: input.cellulare || null,
    email: input.email || null,
    dataNascita: null,
    luogoNascita: null,
    fidelity,
    categoria: null,
    punti: 0,
  };
  clients.push(client);
  await writeSheet(TAB, [HEADER, ...clients.map(toRow)]);
  return { client, clients };
}

/**
 * Assegna un numero di tessera a un cliente GIÀ in anagrafica che ancora non
 * ne ha uno. Serve perché l'anagrafica si popola anche da sola: chi arriva
 * da un noleggio o dai punti di una commessa esiste già come riga, quindi
 * createClient lo rifiuterebbe come duplicato e non ci sarebbe altro modo
 * di iscriverlo alla fidelity card.
 *
 * Se la tessera c'è già viene restituita invariata, senza consumare un
 * numero nuovo: così un doppio click non genera due tessere.
 */
export async function assignFidelity(
  nome: string
): Promise<{ client: ClientRecord; clients: ClientRecord[] }> {
  const target = normalizeName(nome);
  if (!target) throw new Error("Nome obbligatorio");
  const clients = await readClients();
  const idx = clients.findIndex((c) => normalizeName(c.nome) === target);
  if (idx === -1) throw new Error(`"${nome}" non è in anagrafica`);
  if (clients[idx].fidelity) return { client: clients[idx], clients };

  clients[idx] = { ...clients[idx], fidelity: await nextNumeroFidelity() };
  await writeSheet(TAB, [HEADER, ...clients.map(toRow)]);
  return { client: clients[idx], clients };
}

/**
 * Crea o aggiorna la riga del cliente con i dati più recenti noti (stesso
 * nome, case-insensitive). Chiamata da rentDevice: aggiorna solo i campi che
 * conosce (nome/telefono/noleggio), lasciando intatta l'eventuale anagrafica
 * più ricca già presente (importata da CSV o inserita a mano).
 */
export async function upsertClient(input: {
  nome: string;
  telefono: string | null;
  contratto: string | null;
  dal: string | null;
}): Promise<void> {
  const nome = input.nome.trim();
  if (!nome) return;
  const clients = await readClients();
  const idx = clients.findIndex((c) => normalizeName(c.nome) === normalizeName(nome));
  const prev = idx >= 0 ? clients[idx] : null;
  const next: ClientRecord = {
    nome,
    telefono: input.telefono || prev?.telefono || null,
    ultimoContratto: input.contratto || prev?.ultimoContratto || null,
    ultimoNoleggio: input.dal || prev?.ultimoNoleggio || null,
    cognome: prev?.cognome ?? null,
    nomeProprio: prev?.nomeProprio ?? null,
    sesso: prev?.sesso ?? null,
    indirizzo: prev?.indirizzo ?? null,
    cap: prev?.cap ?? null,
    localita: prev?.localita ?? null,
    provincia: prev?.provincia ?? null,
    cellulare: prev?.cellulare ?? null,
    email: prev?.email ?? null,
    dataNascita: prev?.dataNascita ?? null,
    luogoNascita: prev?.luogoNascita ?? null,
    fidelity: prev?.fidelity ?? null,
    categoria: prev?.categoria ?? null,
    punti: prev?.punti ?? 0,
  };
  if (idx >= 0) clients[idx] = next;
  else clients.push(next);
  await writeSheet(TAB, [HEADER, ...clients.map(toRow)]);
}

/**
 * Aggiunge (o toglie, con delta negativo) punti fedeltà al saldo di un
 * cliente, creandolo se non esiste ancora in anagrafica (es. committente di
 * una commessa mai noleggiante prima). Il saldo non scende mai sotto zero.
 */
export async function adjustClientPunti(nome: string, delta: number): Promise<ClientRecord[]> {
  const trimmed = nome.trim();
  if (!trimmed || !delta) return readClients();
  const clients = await readClients();
  const idx = clients.findIndex((c) => normalizeName(c.nome) === normalizeName(trimmed));
  if (idx >= 0) {
    clients[idx] = { ...clients[idx], punti: Math.max(0, clients[idx].punti + delta) };
  } else {
    clients.push({
      nome: trimmed,
      telefono: null,
      ultimoContratto: null,
      ultimoNoleggio: null,
      cognome: null,
      nomeProprio: null,
      sesso: null,
      indirizzo: null,
      cap: null,
      localita: null,
      provincia: null,
      cellulare: null,
      email: null,
      dataNascita: null,
      luogoNascita: null,
      fidelity: null,
      categoria: null,
      punti: Math.max(0, delta),
    });
  }
  await writeSheet(TAB, [HEADER, ...clients.map(toRow)]);
  return clients;
}

/**
 * Rimuove una riga dall'anagrafica (es. cliente creato per errore). Non
 * tocca dispositivi o storico: l'anagrafica è solo una vista di comodo,
 * la fonte di verità di un noleggio in corso resta il dispositivo stesso.
 */
export async function deleteClient(nome: string): Promise<ClientRecord[]> {
  const clients = await readClients();
  const remaining = clients.filter((c) => normalizeName(c.nome) !== normalizeName(nome));
  if (remaining.length === clients.length) {
    throw new Error(`Cliente "${nome}" non trovato`);
  }
  await writeSheet(TAB, [HEADER, ...remaining.map(toRow)]);
  return remaining;
}

/** Righe minime di un CSV, gestendo campi tra virgolette con virgole,
 * virgolette doppie escaped (""), e newline interne. Basta per il formato
 * esportato da fedelta.store, senza aggiungere una dipendenza per questo. */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  const src = text.replace(/^﻿/, "");
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\r") {
      // ignorato, gestito da \n
    } else if (ch === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += ch;
    }
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((f) => f.trim() !== ""));
}

const CSV_COLUMNS: Record<string, keyof ClientRecord | "cognomeENome"> = {
  "cognome e nome": "cognomeENome",
  categoria: "categoria",
  cognome: "cognome",
  nome: "nomeProprio",
  fidelity: "fidelity",
  email: "email",
  indirizzo: "indirizzo",
  cap: "cap",
  "località": "localita",
  provincia: "provincia",
  telefono: "telefono",
  cellulare: "cellulare",
  "data di nascita": "dataNascita",
};

/**
 * Importa/aggiorna l'anagrafica da un export CSV (formato fedelta.store:
 * intestazioni it, virgolette doppie, UTF-8 con BOM). Abbina i clienti
 * esistenti per nome completo (case-insensitive, stesso criterio usato dai
 * noleggi): un cliente già noto viene arricchito con i campi anagrafica,
 * mai duplicato. Righe senza un nome utilizzabile vengono scartate.
 */
export async function importClientsCsv(
  csvText: string
): Promise<{ nuovi: number; aggiornati: number; scartati: number; totale: number }> {
  const rows = parseCsv(csvText);
  if (rows.length === 0) return { nuovi: 0, aggiornati: 0, scartati: 0, totale: 0 };

  const headerRow = rows[0].map((h) => h.trim().toLowerCase());
  const colIndex: Partial<Record<keyof ClientRecord | "cognomeENome", number>> = {};
  headerRow.forEach((h, i) => {
    const key = CSV_COLUMNS[h];
    if (key) colIndex[key] = i;
  });

  const clients = await readClients();
  // Indice nome → posizione nell'elenco, non una mappa che sostituisce
  // l'elenco: se due righe già presenti hanno nomi uguali a meno di
  // maiuscole, riscrivere il foglio a partire dalla mappa ne cancellerebbe
  // una senza dirlo. Qui l'elenco resta quello letto e si modifica solo la
  // riga corrispondente.
  const indexByName = new Map<string, number>();
  clients.forEach((c, i) => {
    const key = normalizeName(c.nome);
    if (!indexByName.has(key)) indexByName.set(key, i);
  });

  let nuovi = 0;
  let aggiornati = 0;
  let scartati = 0;

  for (const row of rows.slice(1)) {
    const get = (key: keyof ClientRecord | "cognomeENome") => {
      const idx = colIndex[key];
      return idx == null ? "" : (row[idx] ?? "").trim();
    };
    const cognome = get("cognome");
    const nomeProprio = get("nomeProprio");
    const cognomeENome = get("cognomeENome");
    const nome = cognomeENome || [cognome, nomeProprio].filter(Boolean).join(" ");
    // Riga modello/placeholder senza dati veri (es. "A A", ogni parola di
    // una sola lettera): controllato sulle parole del nome effettivo, non
    // solo su cognome/nomeProprio separati, così funziona anche con
    // l'export a colonna unica "Cognome e Nome".
    const nameWords = nome.trim().split(/\s+/).filter(Boolean);
    const isPlaceholder = nameWords.length > 0 && nameWords.every((w) => w.length <= 1);
    if (!nome.trim() || isPlaceholder) {
      scartati++;
      continue;
    }

    const key = normalizeName(nome);
    const prevIdx = indexByName.get(key);
    const prev = prevIdx == null ? null : clients[prevIdx];
    const next: ClientRecord = {
      nome: prev?.nome || nome,
      telefono: get("telefono") || prev?.telefono || null,
      ultimoContratto: prev?.ultimoContratto ?? null,
      ultimoNoleggio: prev?.ultimoNoleggio ?? null,
      cognome: cognome || prev?.cognome || null,
      nomeProprio: nomeProprio || prev?.nomeProprio || null,
      sesso: prev?.sesso ?? null,
      indirizzo: get("indirizzo") || prev?.indirizzo || null,
      cap: get("cap") || prev?.cap || null,
      localita: get("localita") || prev?.localita || null,
      provincia: get("provincia") || prev?.provincia || null,
      cellulare: get("cellulare") || prev?.cellulare || null,
      email: get("email") || prev?.email || null,
      dataNascita: get("dataNascita") || prev?.dataNascita || null,
      luogoNascita: prev?.luogoNascita ?? null,
      // La tessera già assegnata vince su quella del file: se il numero è
      // stato emesso da qui è anche già scritto sulla tessera fisica in mano
      // al cliente, e sovrascriverlo con quello del vecchio gestionale la
      // renderebbe irriconoscibile.
      fidelity: prev?.fidelity || get("fidelity") || null,
      categoria: get("categoria") || prev?.categoria || null,
      punti: prev?.punti ?? 0,
    };

    if (prevIdx != null) {
      clients[prevIdx] = next;
      aggiornati++;
    } else {
      indexByName.set(key, clients.length);
      clients.push(next);
      nuovi++;
    }
  }

  await writeSheet(TAB, [HEADER, ...clients.map(toRow)]);
  return { nuovi, aggiornati, scartati, totale: clients.length };
}
