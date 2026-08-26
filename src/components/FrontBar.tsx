import Link from "next/link";

interface FrontBarProps {
  logoUrl?: string | null;
}

/** Barra sottile in cima alle pagine del fronte banco (Commesse, Fidelity,
 * Clienti): stesso brand della home, ma pensata per stare sopra il
 * contenuto normale della pagina invece che come schermata a sé. */
export function FrontBar({ logoUrl }: FrontBarProps) {
  return (
    <div className="front-bar">
      <Link href="/" className="front-bar-brand">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logoUrl || "/logo.png"} alt="" />
        <b>Ricerca Ausili</b>
      </Link>
      <div className="front-bar-links">
        <Link href="/">← Home</Link>
        <Link href="/admin">Amministrazione ↗</Link>
      </div>
    </div>
  );
}
