"use client";

import { Fragment, useMemo, useRef, useState } from "react";
import { COMMESSA_STATUS_LABEL, type CommessaRecord } from "@/lib/commesse-types";
import { matchesQuery } from "@/lib/search-match";
import { readJson } from "@/lib/fetch-json";
import { Toast } from "./Toast";

interface CommesseClientProps {
  initialCommesse: CommessaRecord[];
}

const STATUS_PILL: Record<CommessaRecord["stato"], string> = {
  in_lavorazione: "noleggiato",
  pronta: "disponibile",
  ritirata: "archiviato",
};

const EMPTY_FORM = {
  committente: "",
  indirizzo: "",
  telefono: "",
  cellulare: "",
  tipoMateriale: false,
  tipoRiparazione: false,
  operatori: "",
  richiesteParticolari: "",
  dataInizio: "",
  dataConsegnaPrevista: "",
  acconto: "",
  saldo: "",
  richiestaMedica: false,
  documentazione: false,
  documentazioneDiagnostica: false,
  altro: false,
};

type EditForm = {
  verifica: "" | "ok" | "c" | "nc";
  nonConformitaNumero: string;
  esito: string;
  dataProntaConsegna: string;
  dataRitiro: string;
  acconto: string;
  saldo: string;
};

function toEditForm(c: CommessaRecord): EditForm {
  return {
    verifica: c.verifica ?? "",
    nonConformitaNumero: c.nonConformitaNumero ?? "",
    esito: c.esito ?? "",
    dataProntaConsegna: c.dataProntaConsegna ?? "",
    dataRitiro: c.dataRitiro ?? "",
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

export function CommesseClient({ initialCommesse }: CommesseClientProps) {
  const [commesse, setCommesse] = useState(initialCommesse);
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<EditForm | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
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
      matchesQuery([c.numero, c.committente, c.telefono, c.cellulare].filter(Boolean).join(" ").toLowerCase(), q)
    );
  }, [commesse, query]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!form.committente.trim()) return;
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
          operatori: form.operatori || null,
          richiesteParticolari: form.richiesteParticolari || null,
          dataInizio: form.dataInizio || null,
          dataConsegnaPrevista: form.dataConsegnaPrevista || null,
          acconto: form.acconto ? Number(form.acconto.replace(",", ".")) : null,
          saldo: form.saldo ? Number(form.saldo.replace(",", ".")) : null,
          verifica: null,
          nonConformitaNumero: null,
          esito: null,
          dataProntaConsegna: null,
          dataRitiro: null,
        }),
      });
      const body = await readJson(res);
      if (!res.ok) throw new Error(body.error || "Creazione non riuscita");
      setCommesse(body.commesse);
      setForm(EMPTY_FORM);
      setCreating(false);
      showToast(`Commessa n. ${body.commessa.numero} creata`);
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

  async function handleSaveEdit(c: CommessaRecord) {
    if (!editForm) return;
    await patchCommessa(
      c.numero,
      {
        verifica: editForm.verifica || null,
        nonConformitaNumero: editForm.nonConformitaNumero || null,
        esito: editForm.esito || null,
        dataProntaConsegna: editForm.dataProntaConsegna || null,
        dataRitiro: editForm.dataRitiro || null,
        acconto: editForm.acconto ? Number(editForm.acconto.replace(",", ".")) : null,
        saldo: editForm.saldo ? Number(editForm.saldo.replace(",", ".")) : null,
      },
      `Commessa n. ${c.numero} aggiornata`
    );
  }

  return (
    <div className="wrap wide">
      <header className="page-header">
        <h1>Commesse</h1>
        <p className="sub">
          {commesse.length} commesse · scheda digitale (materiale/riparazione), stesso modulo di sempre
        </p>
      </header>

      <div className="panel">
        <div className="card-actions">
          <button className="btn primary" type="button" onClick={() => setCreating((v) => !v)}>
            {creating ? "Annulla" : "+ Nuova commessa"}
          </button>
        </div>

        {creating ? (
          <form onSubmit={handleCreate} style={{ marginTop: 16 }}>
            <div className="field">
              <label>Committente</label>
              <input
                value={form.committente}
                onChange={(e) => setForm({ ...form, committente: e.target.value })}
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
              <label>Tipologia di lavoro</label>
              <div className="chips">
                <button
                  type="button"
                  className={`chip ${form.tipoMateriale ? "active" : ""}`}
                  onClick={() => setForm({ ...form, tipoMateriale: !form.tipoMateriale })}
                >
                  Materiale
                </button>
                <button
                  type="button"
                  className={`chip ${form.tipoRiparazione ? "active" : ""}`}
                  onClick={() => setForm({ ...form, tipoRiparazione: !form.tipoRiparazione })}
                >
                  Riparazione
                </button>
              </div>
            </div>
            <div className="field">
              <label>Operatori</label>
              <input value={form.operatori} onChange={(e) => setForm({ ...form, operatori: e.target.value })} />
            </div>
            <div className="field">
              <label>Richieste particolari del cliente</label>
              <textarea
                rows={2}
                value={form.richiesteParticolari}
                onChange={(e) => setForm({ ...form, richiesteParticolari: e.target.value })}
              />
            </div>
            <div className="field-row">
              <div className="field">
                <label>Data di inizio dei lavori</label>
                <input
                  type="date"
                  value={form.dataInizio}
                  onChange={(e) => setForm({ ...form, dataInizio: e.target.value })}
                />
              </div>
              <div className="field">
                <label>Data di consegna del lavoro (prevista)</label>
                <input
                  type="date"
                  value={form.dataConsegnaPrevista}
                  onChange={(e) => setForm({ ...form, dataConsegnaPrevista: e.target.value })}
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
                <label>Saldo €</label>
                <input
                  inputMode="decimal"
                  value={form.saldo}
                  onChange={(e) => setForm({ ...form, saldo: e.target.value })}
                />
              </div>
            </div>
            <div className="field">
              <label>Altro</label>
              <div className="chips">
                {(
                  [
                    ["richiestaMedica", "Richiesta medica"],
                    ["documentazione", "Documentazione"],
                    ["documentazioneDiagnostica", "Documentazione diagnostica"],
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
                {saving ? "Creazione…" : "Crea commessa"}
              </button>
            </div>
          </form>
        ) : null}
      </div>

      <div className="panel">
        <input
          className="searchbox"
          style={{ marginBottom: 14 }}
          placeholder="Cerca per numero, committente, telefono…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {filtered.length === 0 ? (
          <p className="hint" style={{ margin: 0 }}>
            {commesse.length === 0 ? "Nessuna commessa ancora registrata." : "Nessuna commessa corrisponde alla ricerca."}
          </p>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th></th>
                  <th>N.</th>
                  <th>Committente</th>
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
                        <td>{c.committente}</td>
                        <td>
                          {[c.tipoMateriale && "Materiale", c.tipoRiparazione && "Riparazione"]
                            .filter(Boolean)
                            .join(" + ") || "—"}
                        </td>
                        <td>{fmtDate(c.dataConsegnaPrevista)}</td>
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
                                {c.operatori ? `Operatori: ${c.operatori} · ` : ""}
                                Iniziata il {fmtDate(c.dataInizio)}
                                {c.richiesteParticolari ? ` · Richieste: ${c.richiesteParticolari}` : ""}
                                {[
                                  c.richiestaMedica && "Richiesta medica",
                                  c.documentazione && "Documentazione",
                                  c.documentazioneDiagnostica && "Documentazione diagnostica",
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
                                    onClick={() => patchCommessa(c.numero, { stato: "pronta" }, `Commessa n. ${c.numero} pronta per la consegna`)}
                                  >
                                    Segna pronta
                                  </button>
                                ) : null}
                                {c.stato !== "ritirata" ? (
                                  <button
                                    className="btn"
                                    type="button"
                                    disabled={savingEdit}
                                    onClick={() => patchCommessa(c.numero, { stato: "ritirata", dataRitiro: editForm.dataRitiro || new Date().toISOString().slice(0, 10) }, `Commessa n. ${c.numero} ritirata`)}
                                  >
                                    Segna ritirata
                                  </button>
                                ) : null}
                                {c.stato !== "in_lavorazione" ? (
                                  <button
                                    className="btn"
                                    type="button"
                                    disabled={savingEdit}
                                    onClick={() => patchCommessa(c.numero, { stato: "in_lavorazione" }, `Commessa n. ${c.numero} riportata in lavorazione`)}
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
                                  <label>Saldo €</label>
                                  <input
                                    inputMode="decimal"
                                    value={editForm.saldo}
                                    onChange={(e) => setEditForm({ ...editForm, saldo: e.target.value })}
                                  />
                                </div>
                              </div>

                              <div className="field">
                                <label>Verifica</label>
                                <div className="chips">
                                  {(["ok", "c", "nc"] as const).map((v) => (
                                    <button
                                      key={v}
                                      type="button"
                                      className={`chip ${editForm.verifica === v ? "active" : ""}`}
                                      onClick={() => setEditForm({ ...editForm, verifica: editForm.verifica === v ? "" : v })}
                                    >
                                      {v.toUpperCase()}
                                    </button>
                                  ))}
                                </div>
                              </div>
                              {editForm.verifica === "nc" ? (
                                <div className="field">
                                  <label>N. non conformità</label>
                                  <input
                                    value={editForm.nonConformitaNumero}
                                    onChange={(e) => setEditForm({ ...editForm, nonConformitaNumero: e.target.value })}
                                  />
                                </div>
                              ) : null}
                              <div className="field">
                                <label>Esito</label>
                                <textarea
                                  rows={2}
                                  value={editForm.esito}
                                  onChange={(e) => setEditForm({ ...editForm, esito: e.target.value })}
                                />
                              </div>
                              <div className="field-row">
                                <div className="field">
                                  <label>Data pronta consegna</label>
                                  <input
                                    type="date"
                                    value={editForm.dataProntaConsegna}
                                    onChange={(e) => setEditForm({ ...editForm, dataProntaConsegna: e.target.value })}
                                  />
                                </div>
                                <div className="field">
                                  <label>Data ritiro</label>
                                  <input
                                    type="date"
                                    value={editForm.dataRitiro}
                                    onChange={(e) => setEditForm({ ...editForm, dataRitiro: e.target.value })}
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
