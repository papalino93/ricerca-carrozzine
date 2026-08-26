import "server-only";
import { readSheet, writeSheet } from "./sheets";
import { appendHistoryEvent } from "./history";
import { upsertClient } from "./clients";
import { nextNumeroNoleggio } from "./counter";
import { removeAllDevicePhotos } from "./photos";
import { STATUS_OPTIONS, type ArchiveStatus, type Device, type DeviceStatus } from "./device-types";

export type { Device, DeviceStatus, ArchiveStatus } from "./device-types";
export { STATUS_COLOR, STATUS_LABEL, STATUS_OPTIONS, ARCHIVE_LABEL } from "./device-types";

const VALID_STATUSES = STATUS_OPTIONS.map((o) => o.key);

// Ben sotto il limite di 50.000 caratteri per cella di Google Sheets: una
// nota più lunga farebbe fallire l'intero salvataggio del dispositivo.
const MAX_NOTA_LENGTH = 20000;

const TAB = "Dispositivi";
const HEADER = [
  "Codice",
  "Categoria",
  "Marca",
  "Modello",
  "Larghezza",
  "Stato",
  "Cliente",
  "Telefono",
  "NumeroNoleggio",
  "Dal",
  "Sanificazione",
  "Nota",
  "Foto",
  "Sottocategoria",
  "AlPrevisto",
  "PrezzoAcquisto",
  "PrezzoVendita",
  "Archiviato",
];

const VALID_ARCHIVE_STATUSES = ["venduto", "rottamato"];

function toDevice(row: string[]): Device {
  const [
    codice,
    categoria,
    marca,
    modello,
    larghezza,
    stato,
    cliente,
    telefono,
    contratto,
    dal,
    sanificazione,
    nota,
    foto,
    sottocategoria,
    alPrevisto,
    prezzoAcquisto,
    prezzoVendita,
    archiviato,
  ] = row;

  return {
    codice: codice ?? "",
    categoria: categoria ?? "",
    marca: marca ?? "",
    modello: modello ?? "",
    larghezza: larghezza ? Number(larghezza) || null : null,
    stato: (VALID_STATUSES as string[]).includes(stato)
      ? (stato as DeviceStatus)
      : "da_verificare",
    cliente: cliente || null,
    telefono: telefono || null,
    contratto: contratto || null,
    dal: dal || null,
    sanificazione: sanificazione || null,
    nota: nota || null,
    foto: foto || null,
    sottocategoria: sottocategoria || null,
    alPrevisto: alPrevisto || null,
    prezzoAcquisto: prezzoAcquisto ? Number(prezzoAcquisto) || null : null,
    prezzoVendita: prezzoVendita ? Number(prezzoVendita) || null : null,
    archiviato: VALID_ARCHIVE_STATUSES.includes(archiviato) ? (archiviato as ArchiveStatus) : null,
  };
}

function toRow(d: Device): string[] {
  return [
    d.codice,
    d.categoria,
    d.marca,
    d.modello,
    d.larghezza != null ? String(d.larghezza) : "",
    d.stato,
    d.cliente ?? "",
    d.telefono ?? "",
    d.contratto ?? "",
    d.dal ?? "",
    d.sanificazione ?? "",
    d.nota ?? "",
    d.foto ?? "",
    d.sottocategoria ?? "",
    d.alPrevisto ?? "",
    d.prezzoAcquisto != null ? String(d.prezzoAcquisto) : "",
    d.prezzoVendita != null ? String(d.prezzoVendita) : "",
    d.archiviato ?? "",
  ];
}

export async function listDevices(): Promise<Device[]> {
  const rows = await readSheet(TAB);
  return rows
    .slice(1) // salta l'intestazione
    .filter((row) => row.length > 0 && row[0])
    .map(toDevice);
}

export async function saveAllDevices(devices: Device[]): Promise<void> {
  await writeSheet(TAB, [HEADER, ...devices.map(toRow)]);
}

function findOrThrow(devices: Device[], codice: string): { idx: number; device: Device } {
  const idx = devices.findIndex((d) => d.codice === codice);
  if (idx < 0) throw new Error(`Dispositivo ${codice} non trovato`);
  return { idx, device: devices[idx] };
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function upsertDevice(device: Device): Promise<Device[]> {
  if (!device.codice) throw new Error("Codice obbligatorio");
  if ((device.nota?.length ?? 0) > MAX_NOTA_LENGTH) {
    throw new Error(`La nota supera i ${MAX_NOTA_LENGTH} caratteri: abbreviala prima di salvare.`);
  }
  if (!(VALID_STATUSES as string[]).includes(device.stato)) {
    throw new Error(`Stato "${device.stato}" non valido.`);
  }
  const devices = await listDevices();
  const idx = devices.findIndex((d) => d.codice === device.codice);
  if (idx >= 0) devices[idx] = device;
  else devices.push(device);
  await saveAllDevices(devices);
  return devices;
}

export async function setDevicePhoto(codice: string, foto: string | null): Promise<Device[]> {
  const devices = await listDevices();
  const { idx } = findOrThrow(devices, codice);
  devices[idx] = { ...devices[idx], foto };
  await saveAllDevices(devices);
  return devices;
}

export async function deleteDevice(codice: string): Promise<Device[]> {
  const devices = await listDevices();
  const remaining = devices.filter((d) => d.codice !== codice);
  if (remaining.length === devices.length) {
    throw new Error(`Dispositivo ${codice} non trovato`);
  }
  await saveAllDevices(remaining);
  try {
    // Pulizia della galleria: informativa, non deve far fallire un'eliminazione
    // già andata a buon fine se la scrittura sul foglio Foto si inceppa.
    await removeAllDevicePhotos(codice);
  } catch {
    // best-effort
  }
  return remaining;
}

export interface RentDeviceInput {
  cliente: string;
  telefono: string | null;
  dal: string | null;
  /** Data di rientro prevista, ISO yyyy-mm-dd (facoltativa). */
  alPrevisto: string | null;
}

/**
 * disponibile → noleggiato: assegna il dispositivo a un cliente.
 *
 * Il numero di noleggio (campo "contratto") non è più digitato
 * dall'operatore: viene generato qui, progressivo e condiviso da tutti i
 * dispositivi (vedi counter.ts), così da avere un solo numero univoco per
 * ogni noleggio invece di quello che l'operatore ricordava di scrivere.
 */
export async function rentDevice(codice: string, input: RentDeviceInput): Promise<Device[]> {
  const devices = await listDevices();
  const { idx, device } = findOrThrow(devices, codice);
  // Controllo dello stato di partenza sul server, non solo nell'interfaccia:
  // due operatori con la pagina aperta da prima vedrebbero entrambi il
  // pulsante "Noleggia" sullo stesso ausilio, e il secondo sovrascriverebbe
  // in silenzio il cliente del primo.
  if (device.stato === "noleggiato") {
    throw new Error(
      `${codice} risulta già noleggiato${device.cliente ? ` a ${device.cliente}` : ""}. Ricarica la pagina per vedere la situazione aggiornata.`
    );
  }
  const dal = input.dal || todayIso();
  const contratto = await nextNumeroNoleggio();
  devices[idx] = {
    ...devices[idx],
    stato: "noleggiato",
    cliente: input.cliente,
    telefono: input.telefono,
    contratto,
    dal,
    alPrevisto: input.alPrevisto,
  };
  // Registra prima lo storico e solo dopo muta il dispositivo: se il
  // salvataggio del dispositivo falisce, resta comunque una traccia che il
  // noleggio è avvenuto (recuperabile a mano), invece del contrario.
  await appendHistoryEvent({
    data: dal,
    codice,
    evento: "noleggio",
    cliente: input.cliente,
    telefono: input.telefono,
    contratto,
    nota: null,
  });
  await saveAllDevices(devices);
  try {
    // Anagrafica clienti: informativa, non deve far fallire (né far
    // ripetere all'operatore, duplicando lo storico) un noleggio già
    // registrato con successo.
    await upsertClient({
      nome: input.cliente,
      telefono: input.telefono,
      contratto,
      dal,
    });
  } catch {
    // best-effort
  }
  return devices;
}

/** noleggiato → da_pulire: il dispositivo è rientrato, in attesa di sanificazione. */
export async function returnDevice(codice: string): Promise<Device[]> {
  const devices = await listDevices();
  const { idx, device } = findOrThrow(devices, codice);
  // Vedi rentDevice: senza questo, un doppio click da due postazioni
  // scriveva due eventi di restituzione, il secondo con cliente vuoto.
  if (device.stato !== "noleggiato") {
    throw new Error(
      `${codice} non risulta noleggiato: non può essere segnato come rientrato. Ricarica la pagina per vedere la situazione aggiornata.`
    );
  }
  const previousCliente = device.cliente;
  const previousTelefono = device.telefono;
  const previousContratto = device.contratto;
  devices[idx] = {
    ...device,
    stato: "da_pulire",
    cliente: null,
    telefono: null,
    contratto: null,
    dal: null,
    alPrevisto: null,
  };
  await appendHistoryEvent({
    data: todayIso(),
    codice,
    evento: "restituzione",
    cliente: previousCliente,
    telefono: previousTelefono,
    contratto: previousContratto,
    nota: null,
  });
  await saveAllDevices(devices);
  return devices;
}

/** da_pulire → disponibile: sanificazione/pulizia completata. */
export async function sanitizeDevice(codice: string): Promise<Device[]> {
  const devices = await listDevices();
  const { idx } = findOrThrow(devices, codice);
  const sanificazione = todayIso();
  devices[idx] = {
    ...devices[idx],
    stato: "disponibile",
    sanificazione,
  };
  await appendHistoryEvent({
    data: sanificazione,
    codice,
    evento: "sanificazione",
    cliente: null,
    telefono: null,
    contratto: null,
    nota: null,
  });
  await saveAllDevices(devices);
  return devices;
}

/**
 * Segna un dispositivo come venduto o rottamato SENZA eliminarlo: resta in
 * magazzino (nascosto dalle viste normali, vedi AdminDevicesClient/
 * SearchClient) insieme a tutto il suo storico noleggi, invece di sparire
 * come farebbe "Elimina dispositivo". Un flag separato dallo stato normale
 * (non un valore dentro DeviceStatus, vedi ArchiveStatus in device-types.ts),
 * così i controlli già esistenti su "stato" non devono imparare a ignorarlo.
 */
export async function archiveDevice(codice: string, tipo: ArchiveStatus): Promise<Device[]> {
  const devices = await listDevices();
  const { idx, device } = findOrThrow(devices, codice);
  if (device.stato === "noleggiato") {
    throw new Error(`${codice} è attualmente noleggiato: segna prima il rientro.`);
  }
  const breadcrumb = `Archiviato come ${tipo} il ${todayIso()}.`;
  devices[idx] = {
    ...device,
    archiviato: tipo,
    nota: device.nota ? `${device.nota}\n${breadcrumb}` : breadcrumb,
  };
  await saveAllDevices(devices);
  return devices;
}

/** Riporta un dispositivo archiviato in magazzino attivo. */
export async function unarchiveDevice(codice: string): Promise<Device[]> {
  const devices = await listDevices();
  const { idx, device } = findOrThrow(devices, codice);
  devices[idx] = { ...device, archiviato: null };
  await saveAllDevices(devices);
  return devices;
}
