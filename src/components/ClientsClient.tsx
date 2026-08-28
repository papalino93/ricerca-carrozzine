"use client";

import { Fragment, useMemo, useRef, useState } from "react";
import type { ClientRecord } from "@/lib/clients";
import type { HistoryEvent } from "@/lib/history";
import type { Device } from "@/lib/device-types";
import { matchesQuery } from "@/lib/search-match";
import { networkErrorMessage, readJson } from "@/lib/fetch-json";
import { Toast } from "./Toast";

interface ClientsClientProps {
  /** Dove si sta guardando l'anagrafica. Al banco si cerca un cliente, lo
   * si apre e semmai se ne aggiunge uno: l'import CSV è manutenzione del
   * database, si fa da seduti una volta ogni tanto e qui toglierebbe solo
   * spazio e attenzione. Vive quindi solo in amministrazione, sugli stessi
   * dati. */
  contesto?: "banco" | "admin";
  clients: ClientRecord[];
  history: HistoryEvent[];
  devices: Device[];
  /** Nome arrivato come parametro nell'indirizzo (es. da una riga di
   * Fidelity "Vicini o oltre la soglia"): precompila la ricerca e apre
   * subito la scheda, così il clic porta davvero al cliente invece che
   * a un elenco intero da scorrere. */
  initialQuery?: string;
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

function emptyNewClientForm() {
  return { nome: "", cellulare: "", email: "", indirizzo: "" };
}

export function ClientsClient({
  clients: initialClients,
  history,
  devices,
  contesto = "admin",
  initialQuery,
}: ClientsClientProps) {
  const banco = contesto === "banco";
  const [clients, setClients] = useState(initialClients);
  const [query, setQuery] = useState(initialQuery ?? "");
  // Un link diretto che arriva su un nome esatto apre già la scheda:
  // altrimenti bisognerebbe cercarlo E cliccarlo, due passaggi invece di
  // uno per l'unico caso in cui sappiamo già di preciso chi si sta
  // cercando.
  const [open, setOpen] = useState<string | null>(() => {
    const q = (initialQuery ?? "").trim().toLowerCase();
    if (!q) return null;
    const esatto = initialClients.find((c) => c.nome.toLowerCase() === q);
    return esatto ? esatto.nome : null;
  });
  const [deleting, setDeleting] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [puntiDelta, setPuntiDelta] = useState("");
  const [adjustingPunti, setAdjustingPunti] = useState(false);
  const [assigningTessera, setAssigningTessera] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newClientForm, setNewClientForm] = useState(emptyNewClientForm);
  const [savingNewClient, setSavingNewClient] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const importInputRef = useRef<HTMLInputElement>(null);

  function showToast(message: string) {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2400);
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/clienti/import", { method: "POST", body: form });
      const body = await readJson(res);
      if (!res.ok) throw new Error(body.error || "Import non riuscito");
      setClients(body.clients);
      showToast(`Import completato: ${body.nuovi} nuovi, ${body.aggiornati} aggiornati${body.scartati ? `, ${body.scartati} scartati` : ""}`);
    } catch (err) {
      showToast(networkErrorMessage(err));
    } finally {
      setImporting(false);
      if (importInputRef.current) importInputRef.current.value = "";
    }
  }

  async function handleCreateClient(e: React.FormEvent) {
    e.preventDefault();
    if (!newClientForm.nome.trim()) return;
    setSavingNewClient(true);
    try {
      const res = await fetch("/api/clienti", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome: newClientForm.nome,
          cellulare: newClientForm.cellulare || null,
          email: newClientForm.email || null,
          indirizzo: newClientForm.indirizzo || null,
        }),
      });
      const body = await readJson(res);
      if (!res.ok) throw new Error(body.error || "Creazione non riuscita");
      setClients(body.clients);
      showToast(`"${newClientForm.nome}" aggiunto — tessera fedeltà n. ${body.client.fidelity}`);
      setNewClientForm(emptyNewClientForm());
      setCreating(false);
      // Apre subito il dettaglio del cliente appena creato: il numero di
      // tessera resta visibile finché l'operatore non lo trascrive sulla
      // tessera fisica, invece di sparire con il toast dopo pochi secondi.
      setOpen(body.client.nome);
    } catch (err) {
      showToast(networkErrorMessage(err));
    } finally {
      setSavingNewClient(false);
    }
  }

  const sorted = useMemo(
    () => [...clients].sort((a, b) => a.nome.localeCompare(b.nome, "it")),
    [clients]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sorted;
    // Un nome esatto vince sulla ricerca sfumata: stessa logica già
    // applicata a Noleggi e Commesse, per lo stesso motivo (un link
    // diretto non deve aprire anche clienti con un nome solo simile).
    const esatti = sorted.filter((c) => c.nome.toLowerCase() === q);
    if (esatti.length) return esatti;
    return sorted.filter((c) =>
      matchesQuery(
        [c.nome, c.telefono, c.cellulare, c.email, c.fidelity].filter(Boolean).join(" ").toLowerCase(),
        q
      )
    );
  }, [sorted, query]);

  function historyFor(nome: string): HistoryEvent[] {
    return history.filter((e) => (e.cliente ?? "").toLowerCase() === nome.toLowerCase());
  }

  function currentDeviceFor(nome: string): Device | null {
    return devices.find((d) => d.stato === "noleggiato" && (d.cliente ?? "").toLowerCase() === nome.toLowerCase()) ?? null;
  }

  async function handleAdjustPunti(nome: string, sign: 1 | -1) {
    const n = Number(puntiDelta.replace(",", "."));
    if (!Number.isFinite(n) || n <= 0) {
      // Prima usciva qui senza dire nulla: chi cliccava "+ Aggiungi" col
      // campo vuoto vedeva il pulsante non fare apparentemente nulla.
      showToast("Scrivi prima quanti punti, nel campo qui accanto");
      return;
    }
    setAdjustingPunti(true);
    try {
      const res = await fetch("/api/clienti", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome, delta: Math.trunc(n) * sign }),
      });
      const body = await readJson(res);
      if (!res.ok) throw new Error(body.error || "Aggiornamento non riuscito");
      setClients(body.clients);
      setPuntiDelta("");
      showToast(`Punti aggiornati per "${nome}"`);
    } catch (err) {
      showToast(networkErrorMessage(err));
    } finally {
      setAdjustingPunti(false);
    }
  }

  async function handleAssignTessera(nome: string) {
    setAssigningTessera(nome);
    try {
      const res = await fetch("/api/clienti", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome, azione: "tessera" }),
      });
      const body = await readJson(res);
      if (!res.ok) throw new Error(body.error || "Assegnazione non riuscita");
      setClients(body.clients);
      showToast(`Tessera n. ${body.client.fidelity} assegnata a "${nome}"`);
    } catch (err) {
      showToast(networkErrorMessage(err));
    } finally {
      setAssigningTessera(null);
    }
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
      showToast(networkErrorMessage(err));
    } finally {
      setDeleting(null);
    }
  }

  return (
    <div className="wrap wide">
      <header className="page-header with-action">
        <div className="page-header-text">
          <h1>Clienti</h1>
          <p className="sub">
            {banco
              ? `${clients.length} clienti in anagrafica · cerca, apri la scheda o aggiungine uno nuovo`
              : `${clients.length} clienti in anagrafica · si aggiorna da sola a ogni noleggio, più i dati importati da CSV`}
          </p>
        </div>
        <button className="btn primary" type="button" onClick={() => setCreating((v) => !v)}>
          {creating ? "Annulla" : "+ Nuovo cliente"}
        </button>
      </header>

      <div className="panel">
        <input
          className="searchbox"
          // Il margine sotto serve solo quando segue qualcosa: al banco, con
          // l'import CSV nascosto, lascerebbe una striscia vuota in fondo al
          // riquadro di ricerca.
          style={banco ? undefined : { marginBottom: 14 }}
          placeholder="Cerca per nome, telefono, email…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {banco ? null : (
          <>
            <div className="card-actions">
              <button
                className="btn"
                type="button"
                onClick={() => importInputRef.current?.click()}
                disabled={importing}
              >
                {importing ? "Import in corso…" : "Importa CSV anagrafica"}
              </button>
              <input
                ref={importInputRef}
                type="file"
                accept=".csv,text/csv"
                style={{ display: "none" }}
                onChange={handleImport}
              />
            </div>
            <p className="hint" style={{ marginTop: 8, marginBottom: 0 }}>
              Formato export fedelta.store: abbina i clienti già presenti per nome e cognome, senza
              duplicarli — aggiunge indirizzo, email, data di nascita e numero fidelity.
            </p>
          </>
        )}

        {creating ? (
          <form onSubmit={handleCreateClient} style={{ marginTop: 16 }}>
            <div className="field">
              <label>Nome e cognome</label>
              <input
                value={newClientForm.nome}
                onChange={(e) => setNewClientForm({ ...newClientForm, nome: e.target.value })}
                required
                autoFocus
              />
            </div>
            <div className="field-row">
              <div className="field">
                <label>Cellulare</label>
                <input
                  value={newClientForm.cellulare}
                  onChange={(e) => setNewClientForm({ ...newClientForm, cellulare: e.target.value })}
                />
              </div>
              <div className="field">
                <label>Email</label>
                <input
                  type="email"
                  value={newClientForm.email}
                  onChange={(e) => setNewClientForm({ ...newClientForm, email: e.target.value })}
                />
              </div>
            </div>
            <div className="field">
              <label>Indirizzo</label>
              <input
                value={newClientForm.indirizzo}
                onChange={(e) => setNewClientForm({ ...newClientForm, indirizzo: e.target.value })}
              />
            </div>
            <p className="hint" style={{ marginTop: -6, marginBottom: 14 }}>
              Il numero di tessera fedeltà viene assegnato automaticamente alla creazione, per
              garantire che sia sempre univoco.
            </p>
            <div className="card-actions">
              <button className="btn primary" type="submit" disabled={savingNewClient}>
                {savingNewClient ? "Creazione…" : "Crea cliente"}
              </button>
            </div>
          </form>
        ) : null}
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
                  <th>Fidelity</th>
                  <th>Punti</th>
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
                        onClick={() => {
                          setOpen(isOpen ? null : c.nome);
                          setPuntiDelta("");
                        }}
                      >
                        <td>{isOpen ? "▾" : "▸"}</td>
                        <td>{c.nome}</td>
                        <td>{c.telefono ?? c.cellulare ?? "—"}</td>
                        <td>{c.fidelity ?? "—"}</td>
                        <td className="punti-cell">{c.punti}</td>
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
                          <td colSpan={9}>
                            <div className="client-history">
                              {c.indirizzo || c.email || c.fidelity || c.dataNascita || c.cellulare ? (
                                <div className="meta" style={{ marginBottom: 10 }}>
                                  {c.indirizzo
                                    ? `${c.indirizzo}${c.localita ? `, ${c.cap ? `${c.cap} ` : ""}${c.localita}${c.provincia ? ` (${c.provincia})` : ""}` : ""} · `
                                    : ""}
                                  {c.cellulare ? `Cell. ${c.cellulare} · ` : ""}
                                  {c.email ? `${c.email} · ` : ""}
                                  {c.dataNascita ? `nato/a il ${c.dataNascita} · ` : ""}
                                  {c.fidelity ? `Tessera fedeltà n. ${c.fidelity}` : ""}
                                </div>
                              ) : null}

                              <div className="card-actions" style={{ marginBottom: 14, alignItems: "center" }}>
                                <span className="punti-total">{c.punti} punti fedeltà</span>
                                <input
                                  type="number"
                                  min={1}
                                  placeholder="Quanti punti?"
                                  style={{ width: 130 }}
                                  value={puntiDelta}
                                  onChange={(e) => setPuntiDelta(e.target.value)}
                                />
                                <button
                                  className="btn"
                                  type="button"
                                  disabled={adjustingPunti || !puntiDelta.trim()}
                                  onClick={() => handleAdjustPunti(c.nome, 1)}
                                >
                                  + Aggiungi
                                </button>
                                <button
                                  className="btn"
                                  type="button"
                                  disabled={adjustingPunti || !puntiDelta.trim()}
                                  onClick={() => handleAdjustPunti(c.nome, -1)}
                                >
                                  − Togli
                                </button>
                                {/* L'anagrafica si popola anche da sola (noleggi,
                                    punti di una commessa): chi arriva così non ha
                                    tessera e non potrebbe ottenerla da "Nuovo
                                    cliente", che lo vedrebbe come duplicato. */}
                                {!c.fidelity ? (
                                  <button
                                    className="btn"
                                    type="button"
                                    disabled={assigningTessera === c.nome}
                                    onClick={() => handleAssignTessera(c.nome)}
                                  >
                                    {assigningTessera === c.nome ? "…" : "Rilascia tessera fedeltà"}
                                  </button>
                                ) : null}
                              </div>

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
