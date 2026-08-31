"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  FASCICOLO_STATO_LABEL,
  FASCICOLO_STATO_OPTIONS,
  type FascicoloRecord,
  type FascicoloStato,
} from "@/lib/fascicoli-types";
import { matchesQuery } from "@/lib/search-match";
import { localDateFromIso } from "@/lib/dates";

interface FascicoliArchivioClientProps {
  fascicoli: FascicoloRecord[];
}

function fmtData(iso: string): string {
  if (!iso) return "—";
  const datePart = iso.includes("T") ? iso.slice(0, 10) : iso;
  const [y, m, d] = datePart.split("-");
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

export function FascicoliArchivioClient({ fascicoli }: FascicoliArchivioClientProps) {
  const searchParams = useSearchParams();
  const statoIniziale = searchParams.get("stato");

  const [query, setQuery] = useState("");
  const [statiAttivi, setStatiAttivi] = useState<Set<FascicoloStato>>(
    () => new Set((statoIniziale?.split(",").filter(Boolean) as FascicoloStato[]) ?? [])
  );
  const [dataDa, setDataDa] = useState("");
  const [dataA, setDataA] = useState("");
  const [operatore, setOperatore] = useState("");

  const operatoriDisponibili = useMemo(
    () => [...new Set(fascicoli.map((f) => f.operatore).filter((o): o is string => Boolean(o)))].sort(),
    [fascicoli]
  );

  function toggleStato(s: FascicoloStato) {
    setStatiAttivi((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      return next;
    });
  }

  const filtrati = useMemo(() => {
    const q = query.trim().toLowerCase();
    return fascicoli.filter((f) => {
      if (statiAttivi.size > 0 && !statiAttivi.has(f.stato)) return false;
      if (operatore && f.operatore !== operatore) return false;
      if (dataDa && localDateFromIso(f.dataCreazione) < dataDa) return false;
      if (dataA && localDateFromIso(f.dataCreazione) > dataA) return false;
      if (q) {
        const haystack = `${f.numero} ${f.clienteNome} ${f.clienteCF ?? ""} ${f.commessa ?? ""}`.toLowerCase();
        if (!matchesQuery(haystack, q)) return false;
      }
      return true;
    });
  }, [fascicoli, query, statiAttivi, dataDa, dataA, operatore]);

  return (
    <div className="wrap wide">
      <header className="page-header">
        <div className="page-header-text">
          <h1>Archivio fascicoli</h1>
          <p className="sub">{filtrati.length} di {fascicoli.length} fascicoli</p>
        </div>
      </header>

      <div className="panel">
        <input
          className="searchbox"
          placeholder="Nome, cognome, codice fiscale, numero commessa…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />

        <div className="chips" style={{ marginTop: 12 }}>
          {FASCICOLO_STATO_OPTIONS.map((o) => (
            <button
              key={o.key}
              type="button"
              className={`chip ${statiAttivi.has(o.key) ? "active" : ""}`}
              onClick={() => toggleStato(o.key)}
            >
              {o.label}
            </button>
          ))}
        </div>

        <div className="form-grid" style={{ marginTop: 14 }}>
          <div className="field">
            <label htmlFor="fascicoli-data-da">Creato dal</label>
            <input id="fascicoli-data-da" type="date" value={dataDa} onChange={(e) => setDataDa(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="fascicoli-data-a">Al</label>
            <input id="fascicoli-data-a" type="date" value={dataA} onChange={(e) => setDataA(e.target.value)} />
          </div>
          <div className="field" style={{ gridColumn: "1 / -1" }}>
            <label htmlFor="fascicoli-operatore">Operatore</label>
            <select id="fascicoli-operatore" value={operatore} onChange={(e) => setOperatore(e.target.value)}>
              <option value="">Tutti</option>
              {operatoriDisponibili.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="panel">
        {filtrati.length === 0 ? (
          <p className="empty">
            <b>Nessun fascicolo trovato</b>
            Prova a modificare i filtri, oppure crea un nuovo fascicolo.
          </p>
        ) : (
          <>
            <p className="hint" style={{ marginBottom: 10 }}>
              <span className="mobile-scroll-hint">Scorri la tabella lateralmente per vedere tutte le colonne.</span>
            </p>
            <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Commessa</th>
                  <th>Data creazione</th>
                  <th>Tipo dispositivo</th>
                  <th>Stato</th>
                  <th>Ultima modifica</th>
                  <th>Operatore</th>
                  <th>Azioni</th>
                </tr>
              </thead>
              <tbody>
                {filtrati.map((f) => (
                  <tr key={f.numero}>
                    <td>
                      <strong>{f.clienteNome}</strong>
                      {f.clienteCF ? <div className="meta">CF {f.clienteCF}</div> : null}
                    </td>
                    <td>{f.commessa || f.numero}</td>
                    <td>{fmtData(f.dataCreazione)}</td>
                    <td>{f.tipoDispositivo}</td>
                    <td>
                      <span className={`pill fascicolo-${f.stato}`}>{FASCICOLO_STATO_LABEL[f.stato]}</span>
                    </td>
                    <td>{fmtData(f.ultimaModifica)}</td>
                    <td>{f.operatore || "—"}</td>
                    <td>
                      <Link href={`/admin/fascicoli/${f.numero}`} className="btn">
                        Apri
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
