"use client";

import { useMemo, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import type { ClientRecord } from "@/lib/clients";
import type { Device } from "@/lib/device-types";
import { matchesQuery } from "@/lib/search-match";
import { networkErrorMessage, readJson } from "@/lib/fetch-json";
import { Toast } from "./Toast";
import { useConfirm } from "./ConfirmDialog";

interface ClientsClientProps {
  /** Dove si sta guardando l'anagrafica. Al banco si cerca un cliente, lo
   * si apre e semmai se ne aggiunge uno: l'import CSV è manutenzione del
   * database, si fa da seduti una volta ogni tanto e qui toglierebbe solo
   * spazio e attenzione. Vive quindi solo in amministrazione, sugli stessi
   * dati. */
  contesto?: "banco" | "admin";
  clients: ClientRecord[];
  devices: Device[];
  /** Nome arrivato come parametro nell'indirizzo (es. da una riga di
   * Fidelity "Vicini o oltre la soglia"): precompila la ricerca, così un
   * link che punta qui invece che direttamente alla scheda del cliente
   * (vedi /clienti/[nome]) arriva comunque già filtrato. */
  initialQuery?: string;
}

const CLIENTS_PAGE_SIZE = 50;
const MOBILE_CLIENTS_QUERY = "(max-width: 640px)";

function subscribeMobileClients(callback: () => void) {
  const media = window.matchMedia(MOBILE_CLIENTS_QUERY);
  media.addEventListener("change", callback);
  return () => media.removeEventListener("change", callback);
}

function mobileClientsSnapshot() {
  return window.matchMedia(MOBILE_CLIENTS_QUERY).matches;
}

function fmtDate(iso: string): string {
  const [y, m, d] = (iso.includes("T") ? iso.slice(0, 10) : iso).split("-");
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

function emptyNewClientForm() {
  return { nome: "", codiceFiscale: "", cellulare: "", email: "", indirizzo: "" };
}

export function ClientsClient({
  clients: initialClients,
  devices,
  contesto = "admin",
  initialQuery,
}: ClientsClientProps) {
  const confirmAction = useConfirm();
  const banco = contesto === "banco";
  const [clients, setClients] = useState(initialClients);
  const [query, setQuery] = useState(initialQuery ?? "");
  const [deleting, setDeleting] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [creating, setCreating] = useState(false);
  const [visibleCount, setVisibleCount] = useState(CLIENTS_PAGE_SIZE);
  const [newClientForm, setNewClientForm] = useState(emptyNewClientForm);
  const [savingNewClient, setSavingNewClient] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const showMobileClients = useSyncExternalStore(
    subscribeMobileClients,
    mobileClientsSnapshot,
    () => false,
  );
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
          codiceFiscale: newClientForm.codiceFiscale || null,
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
        [c.nome, c.codiceFiscale, c.telefono, c.cellulare, c.email, c.fidelity]
          .filter(Boolean)
          .join(" ")
          .toLowerCase(),
        q
      )
    );
  }, [sorted, query]);

  // La ricerca continua a lavorare sull'intera anagrafica; limitiamo solo il
  // numero di righe costruite nel DOM, che con centinaia di clienti rallentava
  // soprattutto telefoni e tablet.
  const visibleClients = filtered.slice(0, visibleCount);

  const currentDevicesByClient = useMemo(() => {
    const byClient = new Map<string, Device>();
    for (const device of devices) {
      if (device.stato === "noleggiato" && device.cliente) {
        byClient.set(device.cliente.toLowerCase(), device);
      }
    }
    return byClient;
  }, [devices]);

  function currentDeviceFor(nome: string): Device | null {
    return currentDevicesByClient.get(nome.toLowerCase()) ?? null;
  }

  async function handleDelete(e: React.MouseEvent, nome: string) {
    e.preventDefault();
    e.stopPropagation();
    const current = currentDeviceFor(nome);
    const warning = current
      ? ` Attenzione: ha un noleggio in corso (${current.codice}), che NON verrà toccato — solo la riga in anagrafica.`
      : "";
    if (!(await confirmAction({ title: `Eliminare “${nome}” dall'anagrafica?`, description: `Il cliente verrà rimosso.${warning}`, confirmLabel: "Elimina cliente", tone: "danger" }))) return;
    setDeleting(nome);
    try {
      const res = await fetch(`/api/clienti?nome=${encodeURIComponent(nome)}`, { method: "DELETE" });
      const body = await readJson(res);
      if (!res.ok) throw new Error(body.error || "Eliminazione non riuscita");
      setClients(body.clients);
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
          placeholder="Cerca per nome, codice fiscale, telefono, email…"
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
            <div className="field">
              <label>Codice fiscale</label>
              <input
                value={newClientForm.codiceFiscale}
                onChange={(e) =>
                  setNewClientForm({ ...newClientForm, codiceFiscale: e.target.value.toUpperCase() })
                }
                autoCapitalize="characters"
                autoComplete="off"
                maxLength={16}
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
              garantire che sia sempre univoco. Data e luogo di nascita si possono aggiungere dopo,
              dalla scheda del cliente.
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
          <p className="hint" style={{ marginBottom: 10 }}>
            {showMobileClients ? "Tocca" : "Clicca"} su un cliente per vedere anagrafica completa,
            fascicoli plantari collegati e storico.
          </p>
          {showMobileClients ? (
            <div className="clients-mobile-list">
              {visibleClients.map((c) => {
                const current = currentDeviceFor(c.nome);
                const telefoni = [...new Set([c.telefono, c.cellulare].filter(Boolean))].join(" · ") || "—";
                return (
                  <Link
                    key={c.nome}
                    href={`/clienti/${encodeURIComponent(c.nome)}`}
                    className="client-mobile-row"
                    aria-label={`Apri la scheda di ${c.nome}`}
                  >
                    <span className="client-mobile-main">
                      <strong>{c.nome}</strong>
                      <span className="client-mobile-meta">
                        <span>Tel. {telefoni}</span>
                        <span>CF {c.codiceFiscale ?? "—"}</span>
                      </span>
                    </span>
                    <span className="client-mobile-side">
                      <span className="client-mobile-fidelity">Fidelity {c.fidelity ?? "—"}</span>
                      {current ? (
                        <span className="pill noleggiato">{current.codice} in corso</span>
                      ) : (
                        <span className="client-mobile-status">Nessun noleggio</span>
                      )}
                    </span>
                    <span className="client-mobile-chevron" aria-hidden="true">›</span>
                  </Link>
                );
              })}
            </div>
          ) : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Codice fiscale</th>
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
                {visibleClients.map((c) => {
                  const current = currentDeviceFor(c.nome);
                  return (
                    <tr key={c.nome} className="clickable-row">
                      <td style={{ padding: 0 }}>
                        <Link href={`/clienti/${encodeURIComponent(c.nome)}`} className="table-row-link">
                          {c.nome}
                        </Link>
                      </td>
                      <td>{c.codiceFiscale ?? "—"}</td>
                      <td>
                        {[...new Set([c.telefono, c.cellulare].filter(Boolean))].join(" · ") || "—"}
                      </td>
                      <td>{c.fidelity ?? "—"}</td>
                      <td className="punti-cell">{c.punti}</td>
                      <td>{c.ultimoNoleggio ? fmtDate(c.ultimoNoleggio) : "—"}</td>
                      <td>{c.ultimoContratto ?? "—"}</td>
                      <td>{current ? <span className="pill noleggiato">{current.codice}</span> : "—"}</td>
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
                  );
                })}
              </tbody>
            </table>
          </div>
          )}
          {filtered.length > visibleCount ? (
            <div className="card-actions" style={{ marginTop: 16, alignItems: "center" }}>
              <button
                className="btn"
                type="button"
                onClick={() => setVisibleCount((count) => count + CLIENTS_PAGE_SIZE)}
              >
                Mostra altri clienti
              </button>
              <span className="hint" style={{ margin: 0 }}>
                Visualizzati {visibleClients.length} di {filtered.length}
              </span>
            </div>
          ) : null}
        </div>
      )}
      <Toast message={toast} />
    </div>
  );
}
