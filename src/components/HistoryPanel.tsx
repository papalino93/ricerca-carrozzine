"use client";

import { useEffect, useState } from "react";
import type { Device } from "@/lib/device-types";

interface HistoryEvent {
  data: string;
  codice: string;
  evento: "noleggio" | "restituzione" | "sanificazione";
  cliente: string | null;
  telefono: string | null;
  contratto: string | null;
  nota: string | null;
}

const EVENT_LABEL: Record<HistoryEvent["evento"], string> = {
  noleggio: "Noleggio",
  restituzione: "Restituzione",
  sanificazione: "Sanificazione",
};

function fmtDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

interface HistoryPanelProps {
  device: Device;
  onClose: () => void;
}

export function HistoryPanel({ device, onClose }: HistoryPanelProps) {
  const [events, setEvents] = useState<HistoryEvent[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/dispositivi/${encodeURIComponent(device.codice)}/eventi`)
      .then(async (res) => {
        const body = await res.json();
        if (!res.ok) throw new Error(body.error || "Impossibile leggere lo storico");
        if (!cancelled) setEvents(body.events);
      })
      .catch((err) => {
        if (!cancelled) setError((err as Error).message);
      });
    return () => {
      cancelled = true;
    };
  }, [device.codice]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>Storico — {device.codice}</h3>
          <button className="modal-close" onClick={onClose} aria-label="Chiudi" type="button">
            ×
          </button>
        </div>

        {error ? <div className="banner error">{error}</div> : null}

        {!events && !error ? <p className="hint">Caricamento…</p> : null}

        {events && events.length === 0 ? (
          <p className="hint">Nessun evento registrato per questo dispositivo.</p>
        ) : null}

        {events && events.length > 0 ? (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Evento</th>
                  <th>Cliente</th>
                  <th>Telefono</th>
                  <th>Contratto</th>
                </tr>
              </thead>
              <tbody>
                {events.map((e, i) => (
                  <tr key={i}>
                    <td>{fmtDate(e.data)}</td>
                    <td>
                      <span className={`pill ${e.evento === "noleggio" ? "noleggiato" : e.evento === "restituzione" ? "da_pulire" : "disponibile"}`}>
                        {EVENT_LABEL[e.evento]}
                      </span>
                    </td>
                    <td>{e.cliente ?? "—"}</td>
                    <td>{e.telefono ?? "—"}</td>
                    <td>{e.contratto ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        <div className="card-actions" style={{ marginTop: 16 }}>
          <button className="btn" onClick={onClose} type="button">
            Chiudi
          </button>
        </div>
      </div>
    </div>
  );
}
