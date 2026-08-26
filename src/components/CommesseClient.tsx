"use client";

import { Fragment, useMemo, useRef, useState } from "react";
import { COMMESSA_STATUS_LABEL, type CommessaRecord } from "@/lib/commesse-types";
import { matchesQuery } from "@/lib/search-match";
import { readJson } from "@/lib/fetch-json";
import { Toast } from "./Toast";

interface CommesseClientProps {
  initialCommesse: CommessaRecord[];
  puntiPerEuro: number;
}

const STATUS_PILL: Record<CommessaRecord["stato"], string> = {
  in_lavorazione: "noleggiato",
  pronta: "disponibile",
  ritirata: "archiviato",
};

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

// Data ordine e data ricezione coincidono nella maggior parte dei casi (un
// prodotto venduto o ritirato lì per lì): precompilarle a oggi invece di
// lasciarle vuote toglie due click nel caso comune, restando comunque
// modificabili per gli ordini che arrivano in un secondo momento.
function emptyForm() {
  return {
    cliente: "",
    indirizzo: "",
    telefono: "",
    cellulare: "",
    vendita: false,
    riparazione: false,
    operatore: "",
    richiesteParticolari: "",
    dataOrdine: todayIso(),
    consegnaPrevista: "",
    acconto: "",
    saldo: "",
    richiestaMedica: false,
    documentazione: false,
    documentazioneDiagnostica: false,
    altro: false,
  };
}

type EditForm = {
  controlloFinale: "" | "ok" | "problema";
  noteChiusura: string;
  prontaIl: string;
  ritirataIl: string;
  acconto: string;
  saldo: string;
};

function toEditForm(c: CommessaRecord): EditForm {
  return {
    controlloFinale: c.controlloFinale ?? "",
    noteChiusura: c.noteChiusura ?? "",
    prontaIl: c.prontaIl ?? "",
    ritirataIl: c.ritirataIl ?? "",
    acconto: c.acconto != null ? String(c.acconto) : "",
    saldo: c.saldo != null ? String(c.saldo) : "",
  };
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

function fmtEuro(n: number | null): string {
  if (n == null) return "—";
  return `${n.toFixed(2).replace(".", ",")} €`;
}

export function CommesseClient({ initialCommesse, puntiPerEuro }: CommesseClientProps) {
  const [commesse, setCommesse] = useState(initialCommesse);
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<EditForm | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function showToast(message: string) {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2400);
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commesse;
    return commesse.filter((c) =>
      matchesQuery([c.numero, c.cliente, c.telefono, c.cellulare].filter(Boolean).join(" ").toLowerCase(), q)
    );
  }, [commesse, query]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!form.cliente.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/commesse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          indirizzo: form.indirizzo || null,
          telefono: form.telefono || null,
          cellulare: form.cellulare || null,
          operatore: form.operatore || null,
          richiesteParticolari: form.richiesteParticolari || null,
          dataOrdine: form.dataOrdine || null,
          consegnaPrevista: form.consegnaPrevista || null,
          acconto: form.acconto ? Number(form.acconto.replace(",", ".")) : null,
          saldo: form.saldo ? Number(form.saldo.replace(",", ".")) : null,
          controlloFinale: null,
          noteChiusura: null,
          prontaIl: null,
          ritirataIl: null,
        }),
      });
      const body = await readJson(res);
      if (!res.ok) throw new Error(body.error || "Creazione non riuscita");
      setCommesse(body.commesse);
      setForm(emptyForm());
      setCreating(false);
      showToast(`Scheda n. ${body.commessa.numero} creata`);
    } catch (err) {
      showToast((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  function toggleOpen(c: CommessaRecord) {
    if (open === c.numero) {
      setOpen(null);
      setEditForm(null);
    } else {
      setOpen(c.numero);
      setEditForm(toEditForm(c));
    }
  }

  async function patchCommessa(numero: string, patch: Partial<CommessaRecord>, message: string) {
    setSavingEdit(true);
    try {
      const res = await fetch("/api/commesse", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ numero, ...patch }),
      });
      const body = await readJson(res);
      if (!res.ok) throw new Error(body.error || "Salvataggio non riuscito");
      setCommesse(body.commesse);
      showToast(message);
    } catch (err) {
      showToast((err as Error).message);
    } finally {
      setSavingEdit(false);
    }
  }

  async function handleDelete(c: CommessaRecord) {
    if (!confirm(`Eliminare la scheda n. ${c.numero} (${c.cliente})? L'operazione non si può annullare.`)) return;
    setDeleting(c.numero);
    try {
      const res = await fetch(`/api/commesse?numero=${encodeURIComponent(c.numero)}`, { method: "DELETE" });
      const body = await readJson(res);
      if (!res.ok) throw new Error(body.error || "Eliminazione non riuscita");
      setCommesse(body.commesse);
      if (open === c.numero) {
        setOpen(null);
        setEditForm(null);
      }
      showToast(`Scheda n. ${c.numero} eliminata`);
    } catch (err) {
      showToast((err as Error).message);
    } finally {
      setDeleting(null);
    }
  }

  async function handleSaveEdit(c: CommessaRecord) {
    if (!editForm) return;
    await patchCommessa(
      c.numero,
      {
        controlloFinale: editForm.controlloFinale || null,
        noteChiusura: editForm.noteChiusura || null,
        prontaIl: editForm.prontaIl || null,
        ritirataIl: editForm.ritirataIl || null,
        acconto: editForm.acconto ? Number(editForm.acconto.replace(",", ".")) : null,
        saldo: editForm.saldo ? Number(editForm.saldo.replace(",", ".")) : null,
      },
      `Scheda n. ${c.numero} aggiornata`
    );
  }

  return (
    <div className="wrap wide">
      <header className="page-header">
        <h1>Commesse</h1>
        <p className="sub">
          {commesse.length} schede lavoro · vendite e riparazioni, stesso modulo di sempre ma digitale
        </p>
      </header>

      <div className="panel">
        <div className="card-actions">
          <button className="btn primary" type="button" onClick={() => setCreating((v) => !v)}>
            {creating ? "Annulla" : "+ Nuova scheda"}
          </button>
        </div>

        {creating ? (
          <form onSubmit={handleCreate} style={{ marginTop: 16 }}>
            <div className="field">
              <label>Cliente</label>
              <input
                value={form.cliente}
                onChange={(e) => setForm({ ...form, cliente: e.target.value })}
                required
              />
            </div>
            <div className="field">
              <label>Indirizzo</label>
              <input value={form.indirizzo} onChange={(e) => setForm({ ...form, indirizzo: e.target.value })} />
            </div>
            <div className="field-row">
              <div className="field">
                <label>Telefono</label>
                <input value={form.telefono} onChange={(e) => setForm({ ...form, telefono: e.target.value })} />
              </div>
              <div className="field">
                <label>Cellulare</label>
                <input value={form.cellulare} onChange={(e) => setForm({ ...form, cellulare: e.target.value })} />
              </div>
            </div>
            <div className="field">
              <label>Che lavoro è?</label>
              <div className="chips">
                <button
                  type="button"
                  className={`chip ${form.vendita ? "active" : ""}`}
                  onClick={() => setForm({ ...form, vendita: !form.vendita })}
                >
                  Vendita
                </button>
                <button
                  type="button"
                  className={`chip ${form.riparazione ? "active" : ""}`}
                  onClick={() => setForm({ ...form, riparazione: !form.riparazione })}
                >
                  Riparazione
                </button>
              </div>
            </div>
            <div className="field">
              <label>Operatore</label>
              <input value={form.operatore} onChange={(e) => setForm({ ...form, operatore: e.target.value })} />
            </div>
            <div className="field">
              <label>Richieste del cliente</label>
              <textarea
                rows={2}
                value={form.richiesteParticolari}
                onChange={(e) => setForm({ ...form, richiesteParticolari: e.target.value })}
              />
            </div>
            <div className="field-row">
              <div className="field">
                <label>Data ordine</label>
                <input
                  type="date"
                  value={form.dataOrdine}
                  onChange={(e) => setForm({ ...form, dataOrdine: e.target.value })}
                />
              </div>
              <div className="field">
                <label>Consegna prevista il</label>
                <input
                  type="date"
                  value={form.consegnaPrevista}
                  onChange={(e) => setForm({ ...form, consegnaPrevista: e.target.value })}
                />
              </div>
            </div>
            <div className="field-row">
              <div className="field">
                <label>Acconto €</label>
                <input
                  inputMode="decimal"
                  value={form.acconto}
                  onChange={(e) => setForm({ ...form, acconto: e.target.value })}
                />
              </div>
              <div className="field">
                <label>Saldo da pagare €</label>
                <input
                  inputMode="decimal"
                  value={form.saldo}
                  onChange={(e) => setForm({ ...form, saldo: e.target.value })}
                />
              </div>
            </div>
            <p className="hint" style={{ marginTop: -8, marginBottom: 14 }}>
              Il saldo pagato, al ritiro, genera punti fedeltà per il cliente ({puntiPerEuro} punt
              {puntiPerEuro === 1 ? "o" : "i"} per euro).
            </p>
            <div className="field">
              <label>Serve altro</label>
              <div className="chips">
                {(
                  [
                    ["richiestaMedica", "Prescrizione medica"],
                    ["documentazione", "Documentazione"],
                    ["documentazioneDiagnostica", "Referto diagnostico"],
                    ["altro", "Altro"],
                  ] as const
                ).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    className={`chip ${form[key] ? "active" : ""}`}
                    onClick={() => setForm({ ...form, [key]: !form[key] })}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div className="card-actions">
              <button className="btn primary" type="submit" disabled={saving}>
                {saving ? "Creazione…" : "Crea scheda"}
              </button>
            </div>
          </form>
        ) : null}
      </div>

      <div className="panel">
        <input
          className="searchbox"
          style={{ marginBottom: 14 }}
          placeholder="Cerca per numero, cliente, telefono…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {filtered.length === 0 ? (
          <p className="hint" style={{ margin: 0 }}>
            {commesse.length === 0 ? "Nessuna scheda ancora registrata." : "Nessuna scheda corrisponde alla ricerca."}
          </p>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th></th>
                  <th>N.</th>
                  <th>Cliente</th>
                  <th>Tipo</th>
                  <th>Consegna prevista</th>
                  <th>Saldo</th>
                  <th>Stato</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => {
                  const isOpen = open === c.numero;
                  return (
                    <Fragment key={c.numero}>
                      <tr className="clickable-row" onClick={() => toggleOpen(c)}>
                        <td>{isOpen ? "▾" : "▸"}</td>
                        <td>{c.numero}</td>
                        <td>{c.cliente}</td>
                        <td>{[c.vendita && "Vendita", c.riparazione && "Riparazione"].filter(Boolean).join(" + ") || "—"}</td>
                        <td>{fmtDate(c.consegnaPrevista)}</td>
                        <td>{fmtEuro(c.saldo)}</td>
                        <td>
                          <span className={`pill ${STATUS_PILL[c.stato]}`}>{COMMESSA_STATUS_LABEL[c.stato]}</span>
                        </td>
                      </tr>
                      {isOpen && editForm ? (
                        <tr>
                          <td colSpan={7}>
                            <div className="client-history">
                              <div className="meta" style={{ marginBottom: 10 }}>
                                {c.indirizzo ? `${c.indirizzo} · ` : ""}
                                {c.telefono ? `Tel. ${c.telefono} · ` : ""}
                                {c.cellulare ? `Cell. ${c.cellulare} · ` : ""}
                                {c.operatore ? `A cura di: ${c.operatore} · ` : ""}
                                Ordinato il {fmtDate(c.dataOrdine)}
                                {c.consegnaPrevista ? ` · Consegna prevista il ${fmtDate(c.consegnaPrevista)}` : ""}
                                {c.richiesteParticolari ? ` · Richieste: ${c.richiesteParticolari}` : ""}
                                {[
                                  c.richiestaMedica && "Prescrizione medica",
                                  c.documentazione && "Documentazione",
                                  c.documentazioneDiagnostica && "Referto diagnostico",
                                  c.altro && "Altro",
                                ]
                                  .filter(Boolean)
                                  .map((t) => ` · ${t}`)
                                  .join("")}
                              </div>

                              <div className="card-actions" style={{ marginBottom: 10 }}>
                                {c.stato !== "pronta" ? (
                                  <button
                                    className="btn"
                                    type="button"
                                    disabled={savingEdit}
                                    onClick={() => patchCommessa(c.numero, { stato: "pronta" }, `Scheda n. ${c.numero} pronta per la consegna`)}
                                  >
                                    Segna pronta
                                  </button>
                                ) : null}
                                {c.stato !== "ritirata" ? (
                                  <button
                                    className="btn"
                                    type="button"
                                    disabled={savingEdit}
                                    onClick={() =>
                                      patchCommessa(
                                        c.numero,
                                        { stato: "ritirata", ritirataIl: editForm.ritirataIl || todayIso() },
                                        `Scheda n. ${c.numero} ritirata`
                                      )
                                    }
                                  >
                                    Segna ritirata
                                  </button>
                                ) : null}
                                {c.stato !== "in_lavorazione" ? (
                                  <button
                                    className="btn"
                                    type="button"
                                    disabled={savingEdit}
                                    onClick={() => patchCommessa(c.numero, { stato: "in_lavorazione" }, `Scheda n. ${c.numero} riportata in lavorazione`)}
                                  >
                                    Riporta in lavorazione
                                  </button>
                                ) : null}
                              </div>

                              <div className="field-row">
                                <div className="field">
                                  <label>Acconto €</label>
                                  <input
                                    inputMode="decimal"
                                    value={editForm.acconto}
                                    onChange={(e) => setEditForm({ ...editForm, acconto: e.target.value })}
                                  />
                                </div>
                                <div className="field">
                                  <label>Saldo da pagare €</label>
                                  <input
                                    inputMode="decimal"
                                    value={editForm.saldo}
                                    onChange={(e) => setEditForm({ ...editForm, saldo: e.target.value })}
                                  />
                                </div>
                              </div>

                              <div className="field">
                                <label>Controllo finale</label>
                                <div className="chips">
                                  <button
                                    type="button"
                                    className={`chip ${editForm.controlloFinale === "ok" ? "active" : ""}`}
                                    onClick={() =>
                                      setEditForm({ ...editForm, controlloFinale: editForm.controlloFinale === "ok" ? "" : "ok" })
                                    }
                                  >
                                    Tutto ok
                                  </button>
                                  <button
                                    type="button"
                                    className={`chip ${editForm.controlloFinale === "problema" ? "active" : ""}`}
                                    onClick={() =>
                                      setEditForm({
                                        ...editForm,
                                        controlloFinale: editForm.controlloFinale === "problema" ? "" : "problema",
                                      })
                                    }
                                  >
                                    Da sistemare
                                  </button>
                                </div>
                              </div>
                              <div className="field">
                                <label>Note di chiusura</label>
                                <textarea
                                  rows={2}
                                  value={editForm.noteChiusura}
                                  onChange={(e) => setEditForm({ ...editForm, noteChiusura: e.target.value })}
                                />
                              </div>
                              <div className="field-row">
                                <div className="field">
                                  <label>Pronto il</label>
                                  <input
                                    type="date"
                                    value={editForm.prontaIl}
                                    onChange={(e) => setEditForm({ ...editForm, prontaIl: e.target.value })}
                                  />
                                </div>
                                <div className="field">
                                  <label>Ritirato il</label>
                                  <input
                                    type="date"
                                    value={editForm.ritirataIl}
                                    onChange={(e) => setEditForm({ ...editForm, ritirataIl: e.target.value })}
                                  />
                                </div>
                              </div>
                              <div className="card-actions">
                                <button
                                  className="btn primary"
                                  type="button"
                                  disabled={savingEdit}
                                  onClick={() => handleSaveEdit(c)}
                                >
                                  {savingEdit ? "Salvataggio…" : "Salva modifiche"}
                                </button>
                                <a
                                  className="btn"
                                  href={`/api/documento-commessa?numero=${encodeURIComponent(c.numero)}`}
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  Scarica PDF
                                </a>
                                <button
                                  className="btn danger"
                                  type="button"
                                  disabled={deleting === c.numero}
                                  onClick={() => handleDelete(c)}
                                >
                                  {deleting === c.numero ? "…" : "Elimina"}
                                </button>
                              </div>
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
        )}
      </div>
      <Toast message={toast} />
    </div>
  );
}
