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
  /** Precompila la ricerca, es. dal link "N. Noleggio" nella scheda cliente:
   * ci si arriva già puntati sul noleggio giusto invece di dover ricercare a
   * mano il numero appena visto. */
  initialQuery?: string;
}

function fmtDate(iso: string): string {
  const [y, m, d] = (iso.includes("T") ? iso.slice(0, 10) : iso).split("-");
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

export function RegistroClient({ noleggi, devices, firmeDrive, initialQuery }: RegistroClientProps) {
  const [query, setQuery] = useState(initialQuery ?? "");
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
  //
  // Il tipo fa parte della chiave: consegna e restituzione dello stesso
  // noleggio sono due documenti distinti, entrambi da poter aprire. E in
  // caso di più firme dello stesso tipo (un verbale rifatto) vince la più
  // recente: listDocumentLog restituisce dal più nuovo al più vecchio,
  // quindi si tiene la prima incontrata e si ignorano le successive.
  const firmeByNoleggio = useMemo(() => {
    const map = new Map<string, { consegna?: string; restituzione?: string }>();
    for (const d of firmeDrive) {
      if (!d.driveUrl || !d.numeroContratto) continue;
      const key = `${d.codice}::${d.numeroContratto}`;
      const entry = map.get(key) ?? {};
      const slot = d.tipo === "restituzione" ? "restituzione" : "consegna";
      if (entry[slot]) continue;
      entry[slot] = d.driveUrl;
      map.set(key, entry);
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
                  const firme = n.contratto
                    ? firmeByNoleggio.get(`${n.codice}::${n.contratto}`)
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
                      {/* Consegna e restituzione sono due verbali distinti:
                          vanno mostrati entrambi, altrimenti quello di
                          restituzione resterebbe su Drive irraggiungibile. */}
                      <td>
                        {firme?.consegna || firme?.restituzione ? (
                          <span className="verbale-links">
                            {firme.consegna ? (
                              <a
                                href={firme.consegna}
                                target="_blank"
                                rel="noreferrer"
                                className="pill disponibile"
                              >
                                Consegna ↗
                              </a>
                            ) : null}
                            {firme.restituzione ? (
                              <a
                                href={firme.restituzione}
                                target="_blank"
                                rel="noreferrer"
                                className="pill noleggiato"
                              >
                                Restituzione ↗
                              </a>
                            ) : null}
                          </span>
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
