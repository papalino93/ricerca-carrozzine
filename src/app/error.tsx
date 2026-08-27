"use client";

import Link from "next/link";

/**
 * Rete di sicurezza per qualunque errore non previsto in una pagina.
 * Senza questo file l'operatore vedrebbe la schermata predefinita del
 * framework — in inglese, con un codice esadecimale — al posto del suo
 * lavoro. Quasi sempre la causa è Google Sheets che non risponde, e in quel
 * caso basta riprovare fra qualche istante.
 */
export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="wrap">
      <div className="panel" style={{ marginTop: 40 }}>
        <h1>Qualcosa non ha funzionato</h1>
        <p className="sub" style={{ marginTop: 8 }}>
          Non è stato possibile caricare questa pagina. Di norma succede quando Google Sheets
          non risponde per qualche secondo: riprova, di solito basta.
        </p>
        <div className="card-actions" style={{ marginTop: 18 }}>
          <button className="btn primary" type="button" onClick={reset}>
            Riprova
          </button>
          <Link className="btn" href="/">
            Torna alla home
          </Link>
        </div>
      </div>
    </div>
  );
}
