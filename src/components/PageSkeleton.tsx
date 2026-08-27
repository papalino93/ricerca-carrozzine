/**
 * Scheletro mostrato mentre la pagina carica i dati da Google Sheets.
 *
 * Serve a togliere l'impressione che il gestionale sia bloccato. Senza un
 * loading.tsx accanto alla pagina, Next.js tiene il browser fermo sulla
 * schermata precedente finché il server non ha finito TUTTE le letture del
 * foglio: al banco si clicca "Commesse", non succede niente per un paio di
 * secondi, e si clicca di nuovo. Con questo file al suo posto il passaggio
 * è immediato — compare subito l'intestazione con il tasto Home e una
 * traccia del contenuto — e i dati riempiono lo scheletro appena arrivano.
 */
export function PageSkeleton({ righe = 6 }: { righe?: number }) {
  return (
    <div className="wrap" aria-busy="true" aria-live="polite">
      <span className="sr-only">Caricamento in corso…</span>
      <div className="skel-title" />
      <div className="skel-sub" />
      <div className="panel" style={{ marginTop: 18 }}>
        <div className="skel-bar" style={{ height: 44, marginBottom: 16 }} />
        {Array.from({ length: righe }).map((_, i) => (
          <div key={i} className="skel-row">
            <div className="skel-bar" style={{ width: 74, height: 22 }} />
            <div className="skel-bar" style={{ flex: 1, height: 22 }} />
            <div className="skel-bar" style={{ width: 90, height: 22 }} />
          </div>
        ))}
      </div>
    </div>
  );
}
