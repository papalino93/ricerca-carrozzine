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
