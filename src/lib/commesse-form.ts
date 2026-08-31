import { readJson } from "./fetch-json";
import type { CommessaRecord } from "./commesse-types";

/**
 * Motore condiviso fra Banco (`CommesseBanco.tsx`) e Amministrazione
 * (`CommesseClient.tsx`): stesso parsing importi, stesso formato di date/euro,
 * stesse chiamate a `/api/commesse`. Le due viste restano diverse (campi
 * mostrati, ordine, azioni), ma non devono più reimplementare ciascuna per
 * conto suo la logica che sta sotto.
 */

/** Legge un importo scritto dall'operatore accettando la virgola e il simbolo €. */
export function parseImporto(v: string): number | null | "errore" {
  const t = v.trim();
  if (t === "") return null;
  const n = Number(t.replace(/[€\s]/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : "errore";
}

export function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  const [y, m, d] = (iso.includes("T") ? iso.slice(0, 10) : iso).split("-");
  // Stringa non interpretabile come data (es. un valore sporco lasciato da
  // un test): meglio vuota che stampata così com'è.
  if (!y || !m || !d) return "—";
  return `${d}/${m}/${y}`;
}

export function fmtEuro(n: number | null): string {
  if (n == null) return "—";
  return `${n.toFixed(2).replace(".", ",")} €`;
}

const STEP_ORDER: CommessaRecord["stato"][] = ["in_lavorazione", "pronta", "ritirata"];
const STEP_LABELS = ["Ordinata", "Pronta", "Ritirata"];

/** Le 3 tappe del ciclo di vita di una commessa, per un indicatore di
 * avanzamento sola lettura: dice dov'è arrivata la scheda, non impone un
 * ordine di compilazione né blocca nulla — stesso spirito libero già
 * scelto per le tab dei Fascicoli Plantari. */
export function commessaSteps(stato: CommessaRecord["stato"]): { label: string; className: string }[] {
  const idx = STEP_ORDER.indexOf(stato);
  return STEP_ORDER.map((_, i) => ({
    label: STEP_LABELS[i],
    className: i < idx ? "done" : i === idx ? (idx === STEP_ORDER.length - 1 ? "done" : "current") : "",
  }));
}

interface CommesseResponse {
  commessa: CommessaRecord;
  commesse: CommessaRecord[];
}

interface CommesseListResponse {
  commesse: CommessaRecord[];
}

export async function createCommessaRequest(
  payload: Record<string, unknown>
): Promise<CommesseResponse> {
  const res = await fetch("/api/commesse", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const body = await readJson(res);
  if (!res.ok) throw new Error(body.error || "Creazione non riuscita");
  return body as CommesseResponse;
}

export async function patchCommessaRequest(
  numero: string,
  patch: Record<string, unknown>
): Promise<CommesseListResponse> {
  const res = await fetch("/api/commesse", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ numero, ...patch }),
  });
  const body = await readJson(res);
  if (!res.ok) throw new Error(body.error || "Modifica non riuscita");
  return body as CommesseListResponse;
}

export async function deleteCommessaRequest(numero: string): Promise<CommesseListResponse> {
  const res = await fetch(`/api/commesse?numero=${encodeURIComponent(numero)}`, { method: "DELETE" });
  const body = await readJson(res);
  if (!res.ok) throw new Error(body.error || "Eliminazione non riuscita");
  return body as CommesseListResponse;
}
