"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { ClientRecord } from "@/lib/clients";
import type { HistoryEvent } from "@/lib/history";
import type { Device } from "@/lib/device-types";
import { FASCICOLO_STATO_LABEL, type FascicoloRecord } from "@/lib/fascicoli-types";
import { COMMESSA_STATUS_LABEL, type CommessaRecord } from "@/lib/commesse-types";
import { networkErrorMessage, readJson } from "@/lib/fetch-json";
import { IconModifica } from "./ReceptionIcons";
import { Toast } from "./Toast";

const TABS = ["panoramica", "commesse", "storico", "fidelity", "fascicoli"] as const;
type ClientTab = (typeof TABS)[number];

const TAB_LABEL: Record<ClientTab, string> = {
  panoramica: "Panoramica",
  commesse: "Commesse",
  storico: "Storico",
  fidelity: "Fidelity",
  fascicoli: "Fascicoli",
};

function isClientTab(v: string | undefined): v is ClientTab {
  return (TABS as readonly string[]).includes(v ?? "");
}

interface ClientDetailClientProps {
  initialClient: ClientRecord;
  history: HistoryEvent[];
  currentDevice: Device | null;
  fascicoli: FascicoloRecord[];
  commesse: CommessaRecord[];
  /** Tab da aprire subito (es. da un link diretto in "Da tenere d'occhio"):
   * un valore non riconosciuto ricade su "panoramica" invece di rompere. */
  initialTab?: string;
}

const STATUS_PILL: Record<CommessaRecord["stato"], string> = {
  in_lavorazione: "noleggiato",
  pronta: "disponibile",
  ritirata: "archiviato",
};

const EVENT_LABEL: Record<HistoryEvent["evento"], string> = {
  noleggio: "Noleggio",
  restituzione: "Restituzione",
  sanificazione: "Sanificazione",
  verifica: "Verifica completata",
};

function fmtDate(iso: string): string {
  if (!iso) return "—";
  const datePart = iso.includes("T") ? iso.slice(0, 10) : iso;
  const [y, m, d] = datePart.split("-");
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

/**
 * Nome per la testata e per il campo "Nome e cognome": se l'anagrafica non è
 * ancora stata separata (cognome/nomeProprio vuoti, il caso più comune per i
 * clienti creati automaticamente da un noleggio) il nome grezzo è comunque
 * salvato — per convenzione osservata in tutta l'anagrafica esistente —
 * "COGNOME Nome", non "Nome Cognome". Qui si inverte solo per la
 * visualizzazione: il valore usato come identificativo (URL, link, conferma
 * di eliminazione) resta sempre client.nome così com'è, altrimenti si
 * romperebbero i confronti con normalizeName.
 */
function displayFullName(c: ClientRecord): string {
  if (c.nomeProprio || c.cognome) {
    return [c.nomeProprio, c.cognome].filter(Boolean).join(" ") || c.nome;
  }
  const words = c.nome.trim().split(/\s+/).filter(Boolean);
  // Solo con esattamente due parole l'inversione "COGNOME Nome" → "Nome
  // Cognome" è sicura: con un cognome composto (es. "DE ROSSI MARIO") non
  // c'è modo di sapere dove finisce il cognome e inizia il nome, quindi
  // meglio mostrare il dato grezzo così com'è che indovinare male.
  if (words.length !== 2) return c.nome;
  const [cognome, nomeProprio] = words;
  return `${nomeProprio} ${cognome}`;
}

/**
 * L'anagrafica importata da CSV (fedelta.store) salva la data di nascita
 * come "GG/MM/AAAA": <input type="date"> capisce solo "AAAA-MM-GG" e senza
 * conversione il campo si aprirebbe vuoto in modifica, anche se la data è
 * registrata e ben visibile in visualizzazione — sembrerebbe mancante quando
 * non lo è.
 */
function toIsoDate(s: string): string {
  if (!s) return "";
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return s;
  const [, d, mo, y] = m;
  return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
}

function anagraficaFromClient(c: ClientRecord) {
  return {
    nomeGrezzo: c.nome,
    cognome: c.cognome ?? "",
    nomeProprio: c.nomeProprio ?? "",
    codiceFiscale: c.codiceFiscale ?? "",
    dataNascita: toIsoDate(c.dataNascita ?? ""),
    luogoNascita: c.luogoNascita ?? "",
    indirizzo: c.indirizzo ?? "",
    cap: c.cap ?? "",
    localita: c.localita ?? "",
    provincia: c.provincia ?? "",
    telefono: c.telefono ?? "",
    cellulare: c.cellulare ?? "",
    email: c.email ?? "",
  };
}

export function ClientDetailClient({
  initialClient,
  history,
  currentDevice,
  fascicoli,
  commesse,
  initialTab,
}: ClientDetailClientProps) {
  const router = useRouter();
  const [client, setClient] = useState(initialClient);
  const [tab, setTab] = useState<ClientTab>(isClientTab(initialTab) ? initialTab : "panoramica");
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(() => anagraficaFromClient(initialClient));
  const [savingAnagrafica, setSavingAnagrafica] = useState(false);
  const [puntiDelta, setPuntiDelta] = useState("");
  const [adjustingPunti, setAdjustingPunti] = useState(false);
  const [assigningTessera, setAssigningTessera] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2400);
  }

  function startEdit() {
    setForm(anagraficaFromClient(client));
    setEditing(true);
  }

  async function handleSaveAnagrafica(e: React.FormEvent) {
    e.preventDefault();
    if (!form.nomeGrezzo.trim()) {
      showToast("Il nome non può essere vuoto");
      return;
    }
    setSavingAnagrafica(true);
    try {
      const res = await fetch("/api/clienti", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome: client.nome,
          nuovoNome: form.nomeGrezzo.trim(),
          azione: "anagrafica",
          patch: {
            cognome: form.cognome || null,
            nomeProprio: form.nomeProprio || null,
            codiceFiscale: form.codiceFiscale || null,
            dataNascita: form.dataNascita || null,
            luogoNascita: form.luogoNascita || null,
            indirizzo: form.indirizzo || null,
            cap: form.cap || null,
            localita: form.localita || null,
            provincia: form.provincia || null,
            telefono: form.telefono || null,
            cellulare: form.cellulare || null,
            email: form.email || null,
          },
        }),
      });
      const body = await readJson(res);
      if (!res.ok) throw new Error(body.error || "Salvataggio non riuscito");
      const rinominato = body.client.nome !== client.nome;
      setClient(body.client);
      setEditing(false);
      showToast(rinominato ? "Anagrafica aggiornata e nome corretto" : "Anagrafica aggiornata");
      if (rinominato) {
        // L'indirizzo di questa pagina è per nome (vedi clienti/[nome]/
        // page.tsx): dopo la correzione va aggiornato, altrimenti un
        // ricaricamento cercherebbe ancora il nome vecchio.
        router.replace(`/clienti/${encodeURIComponent(body.client.nome)}`);
      }
    } catch (err) {
      showToast(networkErrorMessage(err));
    } finally {
      setSavingAnagrafica(false);
    }
  }

  async function handleAdjustPunti(sign: 1 | -1) {
    const n = Number(puntiDelta.replace(",", "."));
    if (!Number.isFinite(n) || n <= 0) {
      showToast("Scrivi prima quanti punti, nel campo qui accanto");
      return;
    }
    setAdjustingPunti(true);
    try {
      const res = await fetch("/api/clienti", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome: client.nome, delta: Math.trunc(n) * sign }),
      });
      const body = await readJson(res);
      if (!res.ok) throw new Error(body.error || "Aggiornamento non riuscito");
      const updated = (body.clients as ClientRecord[]).find((c) => c.nome === client.nome);
      if (updated) setClient(updated);
      setPuntiDelta("");
      showToast("Punti aggiornati");
    } catch (err) {
      showToast(networkErrorMessage(err));
    } finally {
      setAdjustingPunti(false);
    }
  }

  async function handleAssignTessera() {
    setAssigningTessera(true);
    try {
      const res = await fetch("/api/clienti", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome: client.nome, azione: "tessera" }),
      });
      const body = await readJson(res);
      if (!res.ok) throw new Error(body.error || "Assegnazione non riuscita");
      setClient(body.client);
      showToast(`Tessera n. ${body.client.fidelity} assegnata`);
    } catch (err) {
      showToast(networkErrorMessage(err));
    } finally {
      setAssigningTessera(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      const res = await fetch(`/api/clienti?nome=${encodeURIComponent(client.nome)}`, { method: "DELETE" });
      const body = await readJson(res);
      if (!res.ok) throw new Error(body.error || "Eliminazione non riuscita");
      router.push("/clienti");
    } catch (err) {
      showToast(networkErrorMessage(err));
      setDeleting(false);
    }
  }

  return (
    <div className="wrap wide">
      <button type="button" className="btn client-detail-back" onClick={() => router.back()}>
        ← Indietro
      </button>

      <div className="client-detail-header">
        <header className="page-header" style={{ marginBottom: 0 }}>
          <div className="page-header-text">
            <h1>{displayFullName(client)}</h1>
            <p className="sub">
              {client.codiceFiscale ? `CF ${client.codiceFiscale}` : "Codice fiscale non registrato"}
              {client.fidelity ? ` · Tessera fedeltà n. ${client.fidelity}` : ""}
            </p>
          </div>
        </header>

        {currentDevice ? (
          <div className="banner" style={{ marginTop: 14, marginBottom: 0 }}>
            Noleggio in corso: <b>{currentDevice.codice}</b> — {currentDevice.categoria} {currentDevice.marca}{" "}
            {currentDevice.modello}
          </div>
        ) : null}
      </div>

      <div className="tabs">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            className={`tab ${tab === t ? "active" : ""}`}
            onClick={() => setTab(t)}
          >
            {TAB_LABEL[t]}
            {t === "commesse" ? <span className="tab-count">{commesse.length}</span> : null}
            {t === "fascicoli" ? <span className="tab-count">{fascicoli.length}</span> : null}
          </button>
        ))}
      </div>

      {tab === "panoramica" ? (
      <div className="panel">
        <div className="page-title-row" style={{ marginBottom: 12 }}>
          <h2 style={{ margin: 0 }}>Anagrafica</h2>
          {!editing ? (
            <button className="btn" type="button" onClick={startEdit}>
              <span className="btn-icon"><IconModifica /></span> Modifica
            </button>
          ) : null}
        </div>

        {!editing ? (
          <div className="form-grid">
            <div className="field">
              <label>Nome e cognome</label>
              <div>{displayFullName(client)}</div>
            </div>
            <div className="field">
              <label>Codice fiscale</label>
              <div>{client.codiceFiscale || "—"}</div>
            </div>
            <div className="field">
              <label>Data e luogo di nascita</label>
              <div>
                {client.dataNascita ? fmtDate(client.dataNascita) : "—"}
                {client.luogoNascita ? ` a ${client.luogoNascita}` : ""}
              </div>
            </div>
            <div className="field">
              <label>Telefono / Cellulare</label>
              <div>{[client.telefono, client.cellulare].filter(Boolean).join(" · ") || "—"}</div>
            </div>
            <div className="field">
              <label>Email</label>
              <div>{client.email || "—"}</div>
            </div>
            <div className="field" style={{ gridColumn: "1 / -1" }}>
              <label>Indirizzo</label>
              <div>
                {client.indirizzo
                  ? `${client.indirizzo}${client.localita ? `, ${client.cap ? `${client.cap} ` : ""}${client.localita}${client.provincia ? ` (${client.provincia})` : ""}` : ""}`
                  : "—"}
              </div>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSaveAnagrafica}>
            <div className="form-grid">
              <div className="field" style={{ gridColumn: "1 / -1" }}>
                <label>Nome e cognome</label>
                <input
                  value={form.nomeGrezzo}
                  onChange={(e) => setForm({ ...form, nomeGrezzo: e.target.value })}
                  required
                />
                <p className="hint" style={{ margin: "4px 0 0" }}>
                  Correggendolo, si aggiorna anche su noleggi, commesse, storico e fascicoli già collegati a questo cliente.
                </p>
              </div>
              <div className="field">
                <label>Nome proprio</label>
                <input value={form.nomeProprio} onChange={(e) => setForm({ ...form, nomeProprio: e.target.value })} />
              </div>
              <div className="field">
                <label>Cognome</label>
                <input value={form.cognome} onChange={(e) => setForm({ ...form, cognome: e.target.value })} />
              </div>
              <div className="field">
                <label>Codice fiscale</label>
                <input
                  value={form.codiceFiscale}
                  onChange={(e) => setForm({ ...form, codiceFiscale: e.target.value.toUpperCase() })}
                />
              </div>
              <div className="field">
                <label>Data di nascita</label>
                <input type="date" value={form.dataNascita} onChange={(e) => setForm({ ...form, dataNascita: e.target.value })} />
              </div>
              <div className="field">
                <label>Luogo di nascita</label>
                <input value={form.luogoNascita} onChange={(e) => setForm({ ...form, luogoNascita: e.target.value })} />
              </div>
              <div className="field">
                <label>Telefono</label>
                <input value={form.telefono} onChange={(e) => setForm({ ...form, telefono: e.target.value })} />
              </div>
              <div className="field">
                <label>Cellulare</label>
                <input value={form.cellulare} onChange={(e) => setForm({ ...form, cellulare: e.target.value })} />
              </div>
              <div className="field">
                <label>Email</label>
                <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
              <div className="field" style={{ gridColumn: "1 / -1" }}>
                <label>Indirizzo</label>
                <input value={form.indirizzo} onChange={(e) => setForm({ ...form, indirizzo: e.target.value })} />
              </div>
              <div className="field">
                <label>CAP</label>
                <input value={form.cap} onChange={(e) => setForm({ ...form, cap: e.target.value })} />
              </div>
              <div className="field">
                <label>Comune</label>
                <input value={form.localita} onChange={(e) => setForm({ ...form, localita: e.target.value })} />
              </div>
              <div className="field">
                <label>Provincia</label>
                <input value={form.provincia} onChange={(e) => setForm({ ...form, provincia: e.target.value })} />
              </div>
            </div>
            <div className="card-actions">
              <button className="btn primary" type="submit" disabled={savingAnagrafica}>
                {savingAnagrafica ? "Salvataggio…" : "Salva anagrafica"}
              </button>
              <button className="btn ghost" type="button" disabled={savingAnagrafica} onClick={() => setEditing(false)}>
                Annulla
              </button>
            </div>
          </form>
        )}
      </div>
      ) : null}

      {tab === "commesse" ? (
      <div className="panel">
        <h2>Commesse</h2>
        {commesse.length === 0 ? (
          <p className="hint" style={{ margin: 0 }}>
            Nessuna commessa registrata per questo cliente.
          </p>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>N.</th>
                  <th>Tipo</th>
                  <th>Data ordine</th>
                  <th>Stato</th>
                </tr>
              </thead>
              <tbody>
                {commesse.map((c) => (
                  <tr key={c.numero}>
                    <td>
                      <Link href={`/admin/commesse?q=${encodeURIComponent(c.numero)}`}>{c.numero}</Link>
                    </td>
                    <td>{[c.vendita && "Vendita", c.riparazione && "Riparazione"].filter(Boolean).join(" + ") || "—"}</td>
                    <td>{c.dataOrdine ? fmtDate(c.dataOrdine) : "—"}</td>
                    <td>
                      <span className={`pill ${STATUS_PILL[c.stato]}`}>{COMMESSA_STATUS_LABEL[c.stato]}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      ) : null}

      {tab === "fidelity" ? (
      <div className="panel">
        <h2>Fidelity</h2>
        <div className="card-actions" style={{ alignItems: "center" }}>
          <span className="punti-total">{client.punti} punti fedeltà</span>
          <input
            type="number"
            min={1}
            placeholder="Quanti punti?"
            style={{ width: 130 }}
            value={puntiDelta}
            onChange={(e) => setPuntiDelta(e.target.value)}
          />
          <button className="btn" type="button" disabled={adjustingPunti || !puntiDelta.trim()} onClick={() => handleAdjustPunti(1)}>
            + Aggiungi
          </button>
          <button className="btn" type="button" disabled={adjustingPunti || !puntiDelta.trim()} onClick={() => handleAdjustPunti(-1)}>
            − Togli
          </button>
          {!client.fidelity ? (
            <button className="btn" type="button" disabled={assigningTessera} onClick={handleAssignTessera}>
              {assigningTessera ? "…" : "Rilascia tessera fedeltà"}
            </button>
          ) : null}
        </div>
      </div>
      ) : null}

      {tab === "fascicoli" ? (
        <div className="panel">
          <h2>Fascicoli plantari</h2>
          {fascicoli.length === 0 ? (
            <p className="hint" style={{ margin: 0 }}>
              Nessun fascicolo plantare per questo cliente.
            </p>
          ) : (
            <ul className="search-result-list">
              {fascicoli.map((f) => (
                <li key={f.numero}>
                  <Link href={`/admin/fascicoli/${f.numero}`} className="search-result-item">
                    <strong>{f.numero}</strong> · creato il {fmtDate(f.dataCreazione)}{" "}
                    <span className={`pill fascicolo-${f.stato}`}>{FASCICOLO_STATO_LABEL[f.stato]}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}

      {tab === "storico" ? (
      <div className="panel">
        <h2>Storico</h2>
        {history.length === 0 ? (
          <p className="hint" style={{ margin: 0 }}>
            Nessun evento registrato.
          </p>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Dispositivo</th>
                  <th>Evento</th>
                  <th>N. Noleggio</th>
                </tr>
              </thead>
              <tbody>
                {history.map((e, i) => (
                  <tr key={i}>
                    <td>{fmtDate(e.data)}</td>
                    <td>{e.codice}</td>
                    <td>
                      <span
                        className={`pill ${
                          e.evento === "noleggio" ? "noleggiato" : e.evento === "restituzione" ? "da_pulire" : "disponibile"
                        }`}
                      >
                        {EVENT_LABEL[e.evento]}
                      </span>
                    </td>
                    <td>
                      {e.contratto ? (
                        <Link href={`/admin/registro?q=${encodeURIComponent(e.contratto)}`}>{e.contratto}</Link>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      ) : null}

      <div className="danger-zone">
        {!confirmingDelete ? (
          <button
            className="btn danger"
            type="button"
            onClick={() => {
              setDeleteConfirmText("");
              setConfirmingDelete(true);
            }}
          >
            Elimina cliente dall&apos;anagrafica
          </button>
        ) : (
          <div className="delete-confirm">
            <p className="hint" style={{ margin: "0 0 8px" }}>
              Azione irreversibile
              {currentDevice ? ` — attenzione: ha un noleggio in corso (${currentDevice.codice}), che NON verrà toccato` : ""}.
              Per confermare, scrivi il nome <b>{client.nome}</b> qui sotto.
            </p>
            <div className="card-actions">
              <input
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder={client.nome}
                autoFocus
                style={{ maxWidth: 260 }}
              />
              <button className="btn" type="button" onClick={() => setConfirmingDelete(false)} disabled={deleting}>
                Annulla
              </button>
              <button
                className="btn danger"
                type="button"
                onClick={handleDelete}
                disabled={deleting || deleteConfirmText.trim() !== client.nome}
              >
                {deleting ? "Eliminazione…" : "Conferma eliminazione"}
              </button>
            </div>
          </div>
        )}
      </div>

      <Toast message={toast} />
    </div>
  );
}
