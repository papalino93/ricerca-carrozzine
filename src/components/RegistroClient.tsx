"use client";

import { useMemo, useState } from "react";
import type { HistoryEvent } from "@/lib/history";
import type { Device } from "@/lib/device-types";
import type { DocumentLogEntry } from "@/lib/documentLog";
import { matchesQuery } from "@/lib/search-match";
import { IconNoleggio } from "./ReceptionIcons";

interface RegistroClientProps {
  noleggi: HistoryEvent[];
  devices: Device[];
  /** Solo i verbali generati con firma digitale (vedi DocumentPanel): la
   * maggior parte dei noleggi non ne ha uno, e va bene così — il verbale
   * "di carta" di sempre non viene mai archiviato da nessuna parte. */
  firmeDrive: DocumentLogEntry[];
}

function fmtDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

export function RegistroClient({ noleggi, devices, firmeDrive }: RegistroClientProps) {
  const [query, setQuery] = useState("");
  const [dal, setDal] = useState("");
  const [al, setAl] = useState("");

  // Un dispositivo può essere stato eliminato dopo il noleggio: la riga
  // resta comunque nel registro (è uno storico, non deve sparire), solo
  // senza marca/modello/categoria da affiancare.
  const deviceByCodice = useMemo(() => {
    const map = new Map<string, Device>();
    for (const d of devices) map.set(d.codice, d);
    return map;
  }, [devices]);

  // Chiave codice+numero noleggio: è la coppia che identifica un noleggio
  // specifico (il numero da solo già basterebbe, essendo progressivo e
  // unico, ma il codice in più costa nulla ed evita ambiguità sui pochi
  // noleggi più vecchi con numeri di contratto manuali non garantiti unici).
  //
  // I verbali SENZA numero di noleggio vengono ignorati di proposito: senza
  // quel numero la chiave sarebbe solo il codice del dispositivo, e due
  // noleggi diversi dello stesso ausilio finirebbero sulla stessa chiave —
  // col rischio di mostrare a un cliente il verbale firmato di un altro.
  // Meglio nessun collegamento che un collegamento sbagliato.
  const driveUrlByNoleggio = useMemo(() => {
    const map = new Map<string, string>();
    for (const d of firmeDrive) {
      if (!d.driveUrl || !d.numeroContratto) continue;
      map.set(`${d.codice}::${d.numeroContratto}`, d.driveUrl);
    }
    return map;
  }, [firmeDrive]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return noleggi.filter((n) => {
      if (dal && n.data < dal) return false;
      if (al && n.data > al) return false;
      if (q) {
        const d = deviceByCodice.get(n.codice);
        const hay = [n.contratto, n.codice, n.cliente, n.telefono, d?.marca, d?.modello, d?.categoria]
          .filter((v) => v != null && v !== "")
          .join(" ")
          .toLowerCase();
        if (!matchesQuery(hay, q)) return false;
      }
      return true;
    });
  }, [noleggi, query, dal, al, deviceByCodice]);

  return (
    <div className="wrap wide">
      <header className="page-header">
        <div className="page-title-row">
          <span className="page-title-icon">
            <IconNoleggio />
          </span>
          <h1>Registro noleggi</h1>
        </div>
        <p className="sub">
          {noleggi.length} noleggi registrati · numero progressivo, dispositivo e cliente di ognuno
        </p>
      </header>

      <div className="panel">
        <input
          className="searchbox"
          style={{ marginBottom: 14 }}
          placeholder="Cerca per n. noleggio, codice, cliente, telefono, marca, modello…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="field-row">
          <div className="field">
            <label>Dal</label>
            <input type="date" value={dal} onChange={(e) => setDal(e.target.value)} />
          </div>
          <div className="field">
            <label>Al</label>
            <input type="date" value={al} onChange={(e) => setAl(e.target.value)} />
          </div>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="panel">
          <p className="hint" style={{ margin: 0 }}>
            {noleggi.length === 0
              ? "Nessun noleggio ancora registrato."
              : "Nessun noleggio corrisponde ai filtri."}
          </p>
        </div>
      ) : (
        <div className="panel">
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>N. Noleggio</th>
                  <th>Data</th>
                  <th>Codice</th>
                  <th>Categoria</th>
                  <th>Marca / modello</th>
                  <th>Cliente</th>
                  <th>Telefono</th>
                  <th>Verbale firmato</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((n, i) => {
                  const d = deviceByCodice.get(n.codice);
                  const driveUrl = n.contratto
                    ? driveUrlByNoleggio.get(`${n.codice}::${n.contratto}`)
                    : undefined;
                  return (
                    <tr key={`${n.contratto ?? "—"}-${n.codice}-${i}`}>
                      <td>
                        {n.contratto ? <span className="num-badge">{n.contratto}</span> : "—"}
                      </td>
                      <td>{fmtDate(n.data)}</td>
                      <td>{n.codice}</td>
                      <td>{d?.categoria ?? "—"}</td>
                      <td>{d ? `${d.marca} ${d.modello}` : "—"}</td>
                      <td>{n.cliente ?? "—"}</td>
                      <td>{n.telefono ?? "—"}</td>
                      <td>
                        {driveUrl ? (
                          <a href={driveUrl} target="_blank" rel="noreferrer" className="pill disponibile">
                            Apri ↗
                          </a>
                        ) : (
                          <span className="pill archiviato">— nessuno</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
