import Link from "next/link";

interface FrontBarProps {
  logoUrl?: string | null;
}

/** Barra sottile in cima alle pagine di Operatore banco (Commesse, Fidelity,
 * Clienti, Magazzino noleggio): stesso brand della home, ma pensata per
 * stare sopra il contenuto normale della pagina invece che come schermata a
 * sé. Resta agganciata in alto (vedi .front-bar): con elenchi lunghi il
 * tasto per tornare indietro sparirebbe al primo scorrimento. */
export function FrontBar({ logoUrl }: FrontBarProps) {
  return (
    <div className="front-bar">
      <Link href="/" className="front-bar-brand">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logoUrl || "/logo.png"} alt="Medical Center" />
      </Link>
      <div className="front-bar-links">
        <Link href="/" className="btn front-bar-home">
          {/* Una casetta al posto della freccia "←": si riconosce senza
              doverla leggere, e dice "home" invece del generico
              "indietro" — che porterebbe alla pagina precedente, non
              necessariamente alla schermata di partenza del banco. */}
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.1"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M3 10.5 12 3l9 7.5" />
            <path d="M5.5 9.5V20h13V9.5" />
            <path d="M9.75 20v-5.5h4.5V20" />
          </svg>
          Home
        </Link>
        <Link href="/admin">Amministrazione ↗</Link>
      </div>
    </div>
  );
}
