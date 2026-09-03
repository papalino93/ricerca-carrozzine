// Validazione morbida del codice fiscale: solo la lunghezza, nessun controllo
// del carattere di controllo o della sintassi. Un CF errato può comunque
// essere quello reale del cliente (letto male su un documento, un caso limite
// non gestito) — bloccare il salvataggio sarebbe peggio che avvisare soltanto.
export const CODICE_FISCALE_LUNGHEZZA = 16;

export function codiceFiscaleAvviso(cf: string | null | undefined): string | null {
  const v = (cf ?? "").trim();
  if (!v) return null;
  if (v.length !== CODICE_FISCALE_LUNGHEZZA) {
    return `Il codice fiscale di una persona fisica ha 16 caratteri (qui ${v.length}).`;
  }
  return null;
}
