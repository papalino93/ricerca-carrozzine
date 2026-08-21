import "server-only";
import { readSheet, writeSheet } from "./sheets";
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
  "Dal",
  "Sanificazione",
  "Nota",
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
    dal,
    sanificazione,
    nota,
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
    dal: dal || null,
    sanificazione: sanificazione || null,
    nota: nota || null,
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
    d.dal ?? "",
    d.sanificazione ?? "",
    d.nota ?? "",
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

export async function upsertDevice(device: Device): Promise<Device[]> {
  if (!device.codice) throw new Error("Codice obbligatorio");
  const devices = await listDevices();
  const idx = devices.findIndex((d) => d.codice === device.codice);
  if (idx >= 0) devices[idx] = device;
  else devices.push(device);
  await saveAllDevices(devices);
  return devices;
}

export async function deleteDevice(codice: string): Promise<Device[]> {
  const devices = await listDevices();
  const remaining = devices.filter((d) => d.codice !== codice);
  await saveAllDevices(remaining);
  return remaining;
}
