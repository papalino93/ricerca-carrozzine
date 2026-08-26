// Tipi e costanti condivisi tra client e server. Nessuna dipendenza da
// googleapis: questo file può essere importato anche dai componenti client.

import type { TariffaUnita } from "./tariffe-types";

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

/**
 * Archiviazione: deliberatamente NON uno stato dentro DeviceStatus.
 * Un dispositivo venduto o rottamato non "torna disponibile" — esce
 * dal ciclo di vita normale, ma la scheda e lo storico noleggi restano
 * intatti (vedi devices.ts archiveDevice/unarchiveDevice). Un valore
 * aggiuntivo dentro DeviceStatus avrebbe richiesto di insegnare a ogni
 * controllo esistente su "stato" a ignorare anche questo caso.
 */
export type ArchiveStatus = "venduto" | "rottamato";

export const ARCHIVE_LABEL: Record<ArchiveStatus, string> = {
  venduto: "Venduto",
  rottamato: "Rottamato",
};

export interface Device {
  /** Identificativo univoco dell'unità (es. codice inventario). */
  codice: string;
  /** Reparto/famiglia del dispositivo (es. Carrozzine, Rollatori, Stampelle...), gestita da Impostazioni → Categorie. */
  categoria: string;
  /** Sottotipo libero all'interno della categoria (es. Autospinta, Transito, Bimbi per le carrozzine). */
  sottocategoria: string | null;
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
  /** Data di rientro prevista del noleggio in corso, ISO yyyy-mm-dd (facoltativa). */
  alPrevisto: string | null;
  /** Tariffa (importo + unità) applicata al noleggio in corso: prefillata
   * dal tariffario alla conferma, ma l'operatore può cambiarla per quel
   * singolo noleggio (es. uno sconto). Usata per calcolare il totale sul
   * verbale di restituzione. */
  tariffaApplicata: number | null;
  tariffaUnita: TariffaUnita | null;
  /** Data ultima sanificazione, ISO yyyy-mm-dd. */
  sanificazione: string | null;
  nota: string | null;
  /** Foto del dispositivo, come data URI (vedi image-to-data-uri.ts). */
  foto: string | null;
  /** Prezzo di acquisto del dispositivo, in euro. */
  prezzoAcquisto: number | null;
  /** Prezzo di ipotetica vendita, in euro. */
  prezzoVendita: number | null;
  /** Non null se il dispositivo è stato archiviato come venduto o rottamato. */
  archiviato: ArchiveStatus | null;
}

/**
 * Versione del dispositivo per la pagina di ricerca (accessibile solo dopo
 * login, vedi proxy.ts, ma comunque distinta dall'admin): il nome cliente
 * resta visibile (come nel prototipo originale), ma telefono, numero di
 * noleggio e prezzi — dati più sensibili — restano riservati a chi opera
 * dall'admin.
 */
export function toPublicDevice(d: Device): Device {
  return {
    ...d,
    telefono: null,
    contratto: null,
    prezzoAcquisto: null,
    prezzoVendita: null,
    tariffaApplicata: null,
    tariffaUnita: null,
  };
}
