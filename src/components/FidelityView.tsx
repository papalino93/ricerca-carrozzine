import Link from "next/link";
import type { ClientRecord } from "@/lib/clients";
import type { CompanySettings } from "@/lib/settings";

interface FidelityViewProps {
  clients: ClientRecord[];
  settings: CompanySettings;
  /** Le due sezioni operative collegate cambiano indirizzo a seconda di dove
   * si vede questa vista (Operatore banco vs amministrazione), Impostazioni
   * invece vive sempre e solo in amministrazione. */
  commesseHref: string;
  clientiHref: string;
}

function fmtEuro(n: number): string {
  return `${n.toFixed(2).replace(".", ",")} €`;
}

export function FidelityView({ clients, settings, commesseHref, clientiHref }: FidelityViewProps) {
  const conPunti = clients.filter((c) => c.punti > 0).sort((a, b) => b.punti - a.punti);
  const puntiTotali = clients.reduce((sum, c) => sum + c.punti, 0);
  const alPremio = settings.sogliaPremioPunti > 0 ? conPunti.filter((c) => c.punti >= settings.sogliaPremioPunti) : [];

  return (
    <div className="wrap wide">
      <header className="page-header">
        <h1>Fidelity</h1>
        <p className="sub">
          {puntiTotali.toLocaleString("it-IT")} punti assegnati · {conPunti.length} clienti con un saldo punti
        </p>
      </header>

      <div className="panel">
        <div className="field-row" style={{ marginBottom: 0 }}>
          <div className="field">
            <label>Come si accumula</label>
            <p style={{ margin: 0, fontWeight: 700 }}>
              {settings.puntiPerEuro} punt{settings.puntiPerEuro === 1 ? "o" : "i"} per ogni euro speso
            </p>
          </div>
          <div className="field">
            <label>Soglia premio</label>
            <p style={{ margin: 0, fontWeight: 700 }}>
              {settings.sogliaPremioPunti.toLocaleString("it-IT")} punti = {fmtEuro(settings.sogliaPremioEuro)}
            </p>
          </div>
        </div>
        <p className="hint" style={{ marginTop: 10, marginBottom: 0 }}>
          I punti si accreditano da soli quando una <Link href={commesseHref}>commessa</Link> passa a
          &quot;ritirata&quot; con un saldo pagato. Le soglie si cambiano da{" "}
          <Link href="/admin/impostazioni">Impostazioni → Fidelity</Link>.
        </p>
        <div className="card-actions" style={{ marginTop: 14 }}>
          <a className="btn primary" href="/api/documento-fidelity" target="_blank" rel="noreferrer">
            Scarica modulo di adesione (PDF)
          </a>
          <Link className="btn" href={clientiHref}>
            Gestisci punti per cliente →
          </Link>
        </div>
      </div>

      {alPremio.length > 0 ? (
        <div className="panel">
          <h2>Vicini o oltre la soglia premio</h2>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Fidelity</th>
                  <th>Punti</th>
                </tr>
              </thead>
              <tbody>
                {alPremio.map((c) => (
                  <tr key={c.nome}>
                    <td>
                      <Link href={`${clientiHref}?q=${encodeURIComponent(c.nome)}`}>{c.nome}</Link>
                    </td>
                    <td>{c.fidelity ?? "—"}</td>
                    <td className="punti-cell">{c.punti.toLocaleString("it-IT")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      <div className="panel">
        <h2>Tutti i clienti con punti</h2>
        {conPunti.length === 0 ? (
          <p className="hint" style={{ margin: 0 }}>
            Nessun cliente ha ancora accumulato punti.
          </p>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Fidelity</th>
                  <th>Punti</th>
                </tr>
              </thead>
              <tbody>
                {conPunti.map((c) => (
                  <tr key={c.nome}>
                    <td>
                      <Link href={`${clientiHref}?q=${encodeURIComponent(c.nome)}`}>{c.nome}</Link>
                    </td>
                    <td>{c.fidelity ?? "—"}</td>
                    <td className="punti-cell">{c.punti.toLocaleString("it-IT")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
