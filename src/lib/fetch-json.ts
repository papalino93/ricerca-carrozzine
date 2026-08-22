/**
 * Legge il corpo JSON di una risposta senza mai lanciare.
 *
 * Perché serve: il codice chiamante faceva `await res.json()` PRIMA di
 * controllare `res.ok`. Quando la risposta non è JSON — una foto scattata
 * col telefono che supera il limite di 4,5 MB del server restituisce un 413
 * testuale, e così fanno i 504 e le pagine di errore della piattaforma —
 * `res.json()` lanciava un `SyntaxError` e l'utente vedeva a schermo
 * "Unexpected token" invece di "immagine troppo grande".
 *
 * Qui la risposta illeggibile diventa un `{ error }` con un messaggio in
 * italiano scelto in base al codice di stato, così i chiamanti possono
 * continuare a usare il loro `body.error` senza modifiche.
 */
// Il tipo di ritorno resta `any` come quello di `res.json()`: questo helper
// serve a non far lanciare la lettura, non a tipizzare le risposte, e i
// chiamanti leggono campi diversi (devices, categories, photos, users...).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function readJson(res: Response): Promise<any> {
  try {
    return await res.json();
  } catch {
    return { error: messageForStatus(res.status) };
  }
}

function messageForStatus(status: number): string {
  if (status === 413) {
    return "Immagine troppo grande: scattala a risoluzione inferiore o scegline una più leggera.";
  }
  if (status === 401) {
    return "Sessione scaduta: ricarica la pagina per rientrare.";
  }
  if (status === 504 || status === 408) {
    return "Il server ci ha messo troppo a rispondere. L'operazione potrebbe non essere stata salvata: ricarica la pagina e controlla.";
  }
  if (status >= 500) {
    return "Errore del server: riprova tra qualche istante.";
  }
  return `Risposta non valida dal server (codice ${status}).`;
}

/**
 * Messaggio leggibile per un errore di rete (fetch che rifiuta prima ancora
 * di ricevere una risposta): senza questo l'utente legge "Failed to fetch",
 * che è l'errore più probabile lavorando da telefono in magazzino.
 */
export function networkErrorMessage(err: unknown): string {
  const msg = (err as Error)?.message ?? "";
  if (/failed to fetch|networkerror|load failed/i.test(msg)) {
    return "Connessione assente: la modifica NON è stata salvata. Controlla la rete e riprova.";
  }
  return msg || "Operazione non riuscita";
}
