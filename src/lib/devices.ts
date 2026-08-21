import "server-only";
import { readSheet, writeSheet } from "./sheets";
import { appendHistoryEvent } from "./history";
import { STATUS_OPTIONS, type Device, type DeviceStatus } from "./device-types";

export type { Device, DeviceStatus } from "./device-types";
export { STATUS_COLOR, STATUS_LABEL, STATUS_OPTIONS } from "./device-types";

const VALID_STATUSES = STATUS_OPTIONS.map((o) => o.key);

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
  "Contratto",
  "Dal",
  "Sanificazione",
  "Nota",
  "Foto",
];

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
  await saveAllDevices(remaining);
  return remaining;
}

export interface RentDeviceInput {
  cliente: string;
  telefono: string | null;
  contratto: string | null;
  dal: string | null;
}

/** disponibile → noleggiato: assegna il dispositivo a un cliente. */
export async function rentDevice(codice: string, input: RentDeviceInput): Promise<Device[]> {
  const devices = await listDevices();
  const { idx } = findOrThrow(devices, codice);
  const dal = input.dal || todayIso();
  devices[idx] = {
    ...devices[idx],
    stato: "noleggiato",
    cliente: input.cliente,
    telefono: input.telefono,
    contratto: input.contratto,
    dal,
  };
  await saveAllDevices(devices);
  await appendHistoryEvent({
    data: dal,
    codice,
    evento: "noleggio",
    cliente: input.cliente,
    telefono: input.telefono,
    contratto: input.contratto,
    nota: null,
  });
  return devices;
}

/** noleggiato → da_pulire: il dispositivo è rientrato, in attesa di sanificazione. */
export async function returnDevice(codice: string): Promise<Device[]> {
  const devices = await listDevices();
  const { idx, device } = findOrThrow(devices, codice);
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
  };
  await saveAllDevices(devices);
  await appendHistoryEvent({
    data: todayIso(),
    codice,
    evento: "restituzione",
    cliente: previousCliente,
    telefono: previousTelefono,
    contratto: previousContratto,
    nota: null,
  });
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
  await saveAllDevices(devices);
  await appendHistoryEvent({
    data: sanificazione,
    codice,
    evento: "sanificazione",
    cliente: null,
    telefono: null,
    contratto: null,
    nota: null,
  });
  return devices;
}
