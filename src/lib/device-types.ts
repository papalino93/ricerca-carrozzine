// Tipi e costanti condivisi tra client e server. Nessuna dipendenza da
// googleapis: questo file può essere importato anche dai componenti client.

export type DeviceStatus =
  | "disponibile"
  | "noleggiato"
  | "da_pulire"
  | "guasto"
  | "da_verificare";

export const STATUS_OPTIONS: { key: DeviceStatus; label: string }[] = [
  { key: "disponibile", label: "Disponibile" },
  { key: "da_pulire", label: "Da pulire" },
  { key: "noleggiato", label: "Noleggiato" },
  { key: "guasto", label: "Guasto" },
  { key: "da_verificare", label: "Da verificare" },
];

export const STATUS_LABEL: Record<DeviceStatus, string> = Object.fromEntries(
  STATUS_OPTIONS.map((o) => [o.key, o.label])
) as Record<DeviceStatus, string>;

export const STATUS_COLOR: Record<DeviceStatus, string> = {
  disponibile: "#1F7A3D",
  noleggiato: "#2F5A8A",
  da_pulire: "#B4590A",
  guasto: "#B23325",
  da_verificare: "#6B4E93",
};

export interface Device {
  /** Identificativo univoco dell'unità (es. codice inventario). */
  codice: string;
  /** Famiglia/tipologia del dispositivo (es. Autospinta, Transito, Bimbi, oppure altre categorie per dispositivi non-carrozzina). */
  categoria: string;
  marca: string;
  modello: string;
  /** Larghezza seduta in cm, se applicabile (può essere assente per dispositivi diversi dalle carrozzine). */
  larghezza: number | null;
  stato: DeviceStatus;
  cliente: string | null;
  telefono: string | null;
  /** Numero contratto del noleggio in corso. */
  contratto: string | null;
  /** Data inizio noleggio, ISO yyyy-mm-dd. */
  dal: string | null;
  /** Data ultima sanificazione, ISO yyyy-mm-dd. */
  sanificazione: string | null;
  nota: string | null;
  /** Foto del dispositivo, come data URI (vedi image-to-data-uri.ts). */
  foto: string | null;
}

/**
 * Versione del dispositivo sicura per esposizione pubblica (ricerca senza
 * login): il nome cliente resta visibile (come nel prototipo originale),
 * ma telefono e numero contratto — dati più sensibili — restano riservati
 * all'amministrazione autenticata.
 */
export function toPublicDevice(d: Device): Device {
  return { ...d, telefono: null, contratto: null };
}
