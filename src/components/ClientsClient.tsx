"use client";

import { Fragment, useMemo, useRef, useState } from "react";
import type { ClientRecord } from "@/lib/clients";
import type { HistoryEvent } from "@/lib/history";
import type { Device } from "@/lib/device-types";
import { matchesQuery } from "@/lib/search-match";
import { readJson } from "@/lib/fetch-json";
import { Toast } from "./Toast";

interface ClientsClientProps {
  clients: ClientRecord[];
  history: HistoryEvent[];
  devices: Device[];
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

export function ClientsClient({ clients: initialClients, history, devices }: ClientsClientProps) {
  const [clients, setClients] = useState(initialClients);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function showToast(message: string) {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2400);
  }

  const sorted = useMemo(
    () => [...clients].sort((a, b) => a.nome.localeCompare(b.nome, "it")),
    [clients]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sorted;
    return sorted.filter((c) => matchesQuery([c.nome, c.telefono].filter(Boolean).join(" ").toLowerCase(), q));
  }, [sorted, query]);

  function historyFor(nome: string): HistoryEvent[] {
    return history.filter((e) => (e.cliente ?? "").toLowerCase() === nome.toLowerCase());
  }

  function currentDeviceFor(nome: string): Device | null {
    return devices.find((d) => d.stato === "noleggiato" && (d.cliente ?? "").toLowerCase() === nome.toLowerCase()) ?? null;
  }

  async function handleDelete(e: React.MouseEvent, nome: string) {
    e.stopPropagation();
    const current = currentDeviceFor(nome);
    const warning = current
      ? ` Attenzione: ha un noleggio in corso (${current.codice}), che NON verrà toccato — solo la riga in anagrafica.`
      : "";
    if (!confirm(`Eliminare "${nome}" dall'anagrafica clienti?${warning}`)) return;
    setDeleting(nome);
    try {
      const res = await fetch(`/api/clienti?nome=${encodeURIComponent(nome)}`, { method: "DELETE" });
      const body = await readJson(res);
      if (!res.ok) throw new Error(body.error || "Eliminazione non riuscita");
      setClients(body.clients);
      if (open === nome) setOpen(null);
      showToast(`"${nome}" eliminato dall'anagrafica`);
    } catch (err) {
      showToast((err as Error).message);
    } finally {
      setDeleting(null);
    }
  }

  return (
    <div className="wrap wide">
      <header className="page-header">
        <h1>Clienti</h1>
        <p className="sub">
          {clients.length} clienti in anagrafica · si aggiorna da sola a ogni noleggio
        </p>
      </header>

      <div className="panel">
        <input
          className="searchbox"
          placeholder="Cerca per nome o telefono…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {filtered.length === 0 ? (
        <div className="panel">
          <p className="hint" style={{ margin: 0 }}>
            {clients.length === 0
              ? "Nessun cliente ancora: l'anagrafica si popola automaticamente al primo noleggio."
              : "Nessun cliente corrisponde alla ricerca."}
          </p>
        </div>
      ) : (
        <div className="panel">
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th></th>
                  <th>Nome</th>
                  <th>Telefono</th>
                  <th>Ultimo noleggio</th>
                  <th>Ultimo n. noleggio</th>
                  <th>In corso</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => {
                  const current = currentDeviceFor(c.nome);
                  const isOpen = open === c.nome;
                  return (
                    <Fragment key={c.nome}>
                      <tr
                        className="clickable-row"
                        onClick={() => setOpen(isOpen ? null : c.nome)}
                      >
                        <td>{isOpen ? "▾" : "▸"}</td>
                        <td>{c.nome}</td>
                        <td>{c.telefono ?? "—"}</td>
                        <td>{c.ultimoNoleggio ? fmtDate(c.ultimoNoleggio) : "—"}</td>
                        <td>{c.ultimoContratto ?? "—"}</td>
                        <td>
                          {current ? (
                            <span className="pill noleggiato">{current.codice}</span>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td>
                          <button
                            className="btn danger"
                            type="button"
                            onClick={(e) => handleDelete(e, c.nome)}
                            disabled={deleting === c.nome}
                          >
                            {deleting === c.nome ? "…" : "Elimina"}
                          </button>
                        </td>
                      </tr>
                      {isOpen ? (
                        <tr key={`${c.nome}-detail`}>
                          <td colSpan={7}>
                            <div className="client-history">
                              <b>Storico di {c.nome}</b>
                              {historyFor(c.nome).length === 0 ? (
                                <p className="hint" style={{ margin: "6px 0 0" }}>
                                  Nessun evento registrato.
                                </p>
                              ) : (
                                <table className="admin-table" style={{ marginTop: 8 }}>
                                  <thead>
                                    <tr>
                                      <th>Data</th>
                                      <th>Dispositivo</th>
                                      <th>Evento</th>
                                      <th>N. Noleggio</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {historyFor(c.nome).map((e, i) => (
                                      <tr key={i}>
                                        <td>{fmtDate(e.data)}</td>
                                        <td>{e.codice}</td>
                                        <td>
                                          <span
                                            className={`pill ${
                                              e.evento === "noleggio"
                                                ? "noleggiato"
                                                : e.evento === "restituzione"
                                                  ? "da_pulire"
                                                  : "disponibile"
                                            }`}
                                          >
                                            {EVENT_LABEL[e.evento]}
                                          </span>
                                        </td>
                                        <td>{e.contratto ?? "—"}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              )}
                            </div>
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
      <Toast message={toast} />
    </div>
  );
}
