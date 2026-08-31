"use client";

import { useMemo, useRef, useState } from "react";
import { COMMESSA_STATUS_LABEL, type CommessaRecord } from "@/lib/commesse-types";
import { matchesQuery } from "@/lib/search-match";
import { networkErrorMessage, readJson } from "@/lib/fetch-json";
import { todayIso } from "@/lib/dates";
import { Toast } from "./Toast";

interface CommesseBancoProps {
  initialCommesse: CommessaRecord[];
  /** Numero di scheda arrivato nell'indirizzo (es. da "Da tenere d'occhio"
   * nella home): precompila la ricerca. */
  initialQuery?: string;
}

const STATUS_PILL: Record<CommessaRecord["stato"], string> = {
  in_lavorazione: "noleggiato",
  pronta: "disponibile",
  ritirata: "archiviato",
};

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  const [y, m, d] = (iso.includes("T") ? iso.slice(0, 10) : iso).split("-");
  // Stringa non interpretabile come data (es. un valore sporco lasciato da
  // un test): meglio vuota che stampata così com'è.
  if (!y || !m || !d) return "—";
  return `${d}/${m}/${y}`;
}

function fmtEuro(n: number | null): string {
  if (n == null) return "—";
  return `${n.toFixed(2).replace(".", ",")} €`;
}

/** Legge un importo scritto dall'operatore accettando la virgola. */
function parseImporto(v: string): number | null | "errore" {
  const t = v.trim();
  if (t === "") return null;
  const n = Number(t.replace(/[€\s]/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : "errore";
}

function emptyForm() {
  return {
    cliente: "",
    telefono: "",
    vendita: false,
    riparazione: false,
    fornitore: "",
    dataOrdine: todayIso(),
    consegnaPrevista: "",
    acconto: "",
    saldo: "",
    richiesteParticolari: "",
  };
}

/**
 * Le commesse come servono al banco: l'elenco di quelle aperte, il pulsante
 * per aprirne una nuova e i due passaggi che scandiscono la vita di una
 * scheda — la merce arriva, il cliente la ritira.
 *
 * È volutamente una vista diversa da quella dell'amministrazione, non la
 * stessa con qualche pezzo nascosto: al banco si lavora in piedi con un
 * cliente davanti, e la tabella completa — tutti i campi, le note di
 * chiusura, l'esito del controllo finale, l'eliminazione — è roba da
 * scrivania, che qui non serve e rallenta. Chi ha bisogno di correggere
 * tutto trova ogni campo in Amministrazione → Commesse, sugli stessi dati.
 */
export function CommesseBanco({ initialCommesse, initialQuery }: CommesseBancoProps) {
  const [commesse, setCommesse] = useState(initialCommesse);
  const [query, setQuery] = useState(initialQuery ?? "");
  const [vista, setVista] = useState<"aperte" | "archivio">("aperte");
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  /** Numero della scheda in fase di consegna: mostra il campo del saldo. */
  const [consegna, setConsegna] = useState<string | null>(null);
  const [saldoConsegna, setSaldoConsegna] = useState("");
  /** Numero della scheda in modifica: mostra il form con i dati inseriti
   * alla creazione, per poterli correggere senza passare da Amministrazione. */
  const [editing, setEditing] = useState<string | null>(null);
  const [editForm, setEditForm] = useState(emptyForm);
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function showToast(message: string) {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2600);
  }

  // La ricerca si applica prima della divisione fra aperte e archivio, così
  // i contatori dicono dove sono finiti i risultati invece di lasciare un
  // elenco vuoto a chi cerca una scheda già chiusa.
  const cercate = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commesse;
    // Il fornitore si cerca solo da Amministrazione → Commesse: qui al banco
    // resta la ricerca di sempre (numero, cliente, telefono/cellulare).
    return commesse.filter((c) =>
      matchesQuery([c.numero, c.cliente, c.telefono, c.cellulare].filter(Boolean).join(" ").toLowerCase(), q)
    );
  }, [commesse, query]);

  const aperte = useMemo(() => cercate.filter((c) => c.stato !== "ritirata"), [cercate]);
  const archivio = useMemo(() => cercate.filter((c) => c.stato === "ritirata"), [cercate]);
  const elenco = vista === "archivio" ? archivio : aperte;

  async function patch(numero: string, campi: Record<string, unknown>, message: string) {
    setBusy(numero);
    try {
      const res = await fetch("/api/commesse", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ numero, ...campi }),
      });
      const body = await readJson(res);
      if (!res.ok) throw new Error(body.error || "Modifica non riuscita");
      setCommesse(body.commesse);
      showToast(message);
    } catch (err) {
      showToast(networkErrorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!form.cliente.trim()) return;
    const acconto = parseImporto(form.acconto);
    const saldo = parseImporto(form.saldo);
    if (acconto === "errore" || saldo === "errore") {
      showToast("Importo non valido in Acconto o Saldo: correggilo prima di continuare");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/commesse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cliente: form.cliente.trim(),
          indirizzo: null,
          telefono: form.telefono.trim() || null,
          cellulare: null,
          vendita: form.vendita,
          riparazione: form.riparazione,
          operatore: null,
          fornitore: form.fornitore.trim() || null,
          numeroOrdineCliente: null,
          richiesteParticolari: form.richiesteParticolari.trim() || null,
          dataOrdine: form.dataOrdine || todayIso(),
          consegnaPrevista: form.consegnaPrevista || null,
          acconto,
          saldo,
          richiestaMedica: false,
          documentazione: false,
          documentazioneDiagnostica: false,
          altro: false,
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
      setVista("aperte");
      showToast(`Commessa n. ${body.commessa.numero} creata`);
    } catch (err) {
      showToast(networkErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  function startEdit(c: CommessaRecord) {
    setConsegna(null);
    setEditing(c.numero);
    setEditForm({
      cliente: c.cliente,
      telefono: c.telefono ?? "",
      vendita: c.vendita,
      riparazione: c.riparazione,
      fornitore: c.fornitore ?? "",
      dataOrdine: c.dataOrdine ?? "",
      consegnaPrevista: c.consegnaPrevista ?? "",
      acconto: c.acconto != null ? String(c.acconto).replace(".", ",") : "",
      saldo: c.saldo != null ? String(c.saldo).replace(".", ",") : "",
      richiesteParticolari: c.richiesteParticolari ?? "",
    });
  }

  async function saveEdit(c: CommessaRecord) {
    if (!editForm.cliente.trim()) {
      showToast("Il cliente è obbligatorio");
      return;
    }
    const acconto = parseImporto(editForm.acconto);
    const saldo = parseImporto(editForm.saldo);
    if (acconto === "errore" || saldo === "errore") {
      showToast("Importo non valido in Acconto o Saldo: correggilo prima di continuare");
      return;
    }
    await patch(
      c.numero,
      {
        cliente: editForm.cliente.trim(),
        telefono: editForm.telefono.trim() || null,
        vendita: editForm.vendita,
        riparazione: editForm.riparazione,
        fornitore: editForm.fornitore.trim() || null,
        dataOrdine: editForm.dataOrdine || null,
        consegnaPrevista: editForm.consegnaPrevista || null,
        acconto,
        saldo,
        richiesteParticolari: editForm.richiesteParticolari.trim() || null,
      },
      `Scheda n. ${c.numero} aggiornata`
    );
    setEditing(null);
  }

  async function handleDelete(c: CommessaRecord) {
    if (!confirm(`Eliminare la scheda n. ${c.numero} (${c.cliente})? L'operazione non si può annullare.`)) return;
    setBusy(c.numero);
    try {
      const res = await fetch(`/api/commesse?numero=${encodeURIComponent(c.numero)}`, { method: "DELETE" });
      const body = await readJson(res);
      if (!res.ok) throw new Error(body.error || "Eliminazione non riuscita");
      setCommesse(body.commesse);
      if (editing === c.numero) setEditing(null);
      showToast(`Scheda n. ${c.numero} eliminata`);
    } catch (err) {
      showToast(networkErrorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  function avviaConsegna(c: CommessaRecord) {
    setEditing(null);
    setConsegna(c.numero);
    setSaldoConsegna(c.saldo != null ? String(c.saldo).replace(".", ",") : "");
  }

  async function confermaConsegna(c: CommessaRecord) {
    const saldo = parseImporto(saldoConsegna);
    if (saldo === "errore") {
      showToast("Importo del saldo non valido");
      return;
    }
    setConsegna(null);
    await patch(
      c.numero,
      { stato: "ritirata", ritirataIl: c.ritirataIl ?? todayIso(), saldo },
      `Scheda n. ${c.numero} consegnata — spostata in archivio`
    );
  }

  return (
    <div className="wrap">
      <div className="page-header with-action">
        <div className="page-header-text">
          <h1>Commesse</h1>
          <p className="sub">Ordini e riparazioni: cosa aspetta, cosa è arrivato, cosa è stato ritirato.</p>
        </div>
        <button className="btn primary" type="button" onClick={() => setCreating((v) => !v)}>
          {creating ? "Annulla" : "+ Nuova commessa"}
        </button>
      </div>

      {creating ? (
        <div className="panel" style={{ marginBottom: 16 }}>
          <h2>Nuova commessa</h2>
          <form onSubmit={handleCreate}>
            <div className="chips" style={{ marginBottom: 12 }}>
              {(
                [
                  ["vendita", "Vendita"],
                  ["riparazione", "Riparazione"],
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
            <div className="form-grid">
              <div className="field">
                <label htmlFor="banco-cliente">Cliente</label>
                <input
                  id="banco-cliente"
                  value={form.cliente}
                  onChange={(e) => setForm({ ...form, cliente: e.target.value })}
                  autoFocus
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="banco-telefono">Telefono</label>
                <input
                  id="banco-telefono"
                  inputMode="tel"
                  value={form.telefono}
                  onChange={(e) => setForm({ ...form, telefono: e.target.value })}
                />
              </div>
              {/* La cosa più importante della scheda: senza, resta una
                  commessa che non dice cosa è stato ordinato. Occupa due
                  colonne e sta in alto perché è la prima cosa che si
                  scrive prendendo l'ordine al banco. */}
              <div className="field banco-field-wide">
                <label htmlFor="banco-articolo">Cosa ordina il cliente</label>
                <textarea
                  id="banco-articolo"
                  rows={2}
                  placeholder="Modello, misura, colore, quantità…"
                  value={form.richiesteParticolari}
                  onChange={(e) => setForm({ ...form, richiesteParticolari: e.target.value })}
                />
              </div>
              <div className="field">
                <label htmlFor="banco-fornitore">Fornitore</label>
                <input
                  id="banco-fornitore"
                  value={form.fornitore}
                  onChange={(e) => setForm({ ...form, fornitore: e.target.value })}
                  placeholder="Da chi si ordina"
                />
              </div>
              <div className="field">
                <label htmlFor="banco-data-ordine">Data ordine</label>
                <input
                  id="banco-data-ordine"
                  type="date"
                  value={form.dataOrdine}
                  onChange={(e) => setForm({ ...form, dataOrdine: e.target.value })}
                />
              </div>
              <div className="field">
                <label htmlFor="banco-consegna">Consegna prevista</label>
                <input
                  id="banco-consegna"
                  type="date"
                  value={form.consegnaPrevista}
                  onChange={(e) => setForm({ ...form, consegnaPrevista: e.target.value })}
                />
              </div>
              <div className="field">
                <label htmlFor="banco-acconto">Acconto</label>
                <input
                  id="banco-acconto"
                  inputMode="decimal"
                  placeholder="0,00"
                  value={form.acconto}
                  onChange={(e) => setForm({ ...form, acconto: e.target.value })}
                />
              </div>
              <div className="field">
                <label htmlFor="banco-saldo">Saldo</label>
                <input
                  id="banco-saldo"
                  inputMode="decimal"
                  placeholder="0,00"
                  value={form.saldo}
                  onChange={(e) => setForm({ ...form, saldo: e.target.value })}
                />
              </div>
            </div>
            <div className="card-actions" style={{ marginTop: 16 }}>
              <button className="btn primary" type="submit" disabled={saving}>
                {saving ? "Creazione…" : "Crea commessa"}
              </button>
            </div>
          </form>
        </div>
      ) : null}

      <div className="panel">
        <input
          className="searchbox"
          placeholder="Cerca per numero, cliente, telefono…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="chips" style={{ margin: "12px 0 16px" }}>
          <button
            type="button"
            className={`chip ${vista === "aperte" ? "active" : ""}`}
            onClick={() => setVista("aperte")}
          >
            Da lavorare ({aperte.length})
          </button>
          <button
            type="button"
            className={`chip ${vista === "archivio" ? "active" : ""}`}
            onClick={() => setVista("archivio")}
          >
            Archivio ({archivio.length})
          </button>
        </div>

        {elenco.length === 0 ? (
          <p className="hint" style={{ margin: 0 }}>
            {commesse.length === 0
              ? "Nessuna commessa ancora registrata."
              : query.trim()
                ? vista === "aperte" && archivio.length > 0
                  ? `Nessuna commessa aperta corrisponde alla ricerca, ma ${archivio.length === 1 ? "ce n'è una" : `ce ne sono ${archivio.length}`} in archivio.`
                  : "Nessuna commessa corrisponde alla ricerca."
                : vista === "archivio"
                  ? "Nessuna commessa ritirata: l'archivio è vuoto."
                  : "Nessuna commessa da lavorare."}
          </p>
        ) : (
          <ul className="banco-list">
            {elenco.map((c) => {
              const tipo =
                [c.vendita && "Vendita", c.riparazione && "Riparazione"].filter(Boolean).join(" + ") || "Commessa";
              const inCorso = busy === c.numero;
              return (
                <li key={c.numero} className="banco-item">
                  <div className="banco-item-main">
                    <span className="banco-item-top">
                      <span className="banco-num">n. {c.numero}</span>
                      <span className={`pill ${STATUS_PILL[c.stato]}`}>{COMMESSA_STATUS_LABEL[c.stato]}</span>
                    </span>
                    <span className="banco-cliente">{c.cliente}</span>
                    <span className="banco-meta">
                      {tipo}
                      {c.telefono ? ` · ${c.telefono}` : ""}
                      {c.fornitore ? ` · da ${c.fornitore}` : ""}
                      {c.stato === "ritirata"
                        ? ` · ritirata il ${fmtDate(c.ritirataIl)}`
                        : c.consegnaPrevista
                          ? ` · consegna ${fmtDate(c.consegnaPrevista)}`
                          : ""}
                      {c.saldo != null ? ` · saldo ${fmtEuro(c.saldo)}` : ""}
                    </span>
                  </div>

                  <div className="banco-item-actions">
                    {c.stato === "in_lavorazione" ? (
                      <button
                        className="btn"
                        type="button"
                        disabled={inCorso}
                        onClick={() =>
                          patch(
                            c.numero,
                            { stato: "pronta", prontaIl: c.prontaIl ?? todayIso() },
                            `Scheda n. ${c.numero}: merce ricevuta`
                          )
                        }
                      >
                        Merce ricevuta
                      </button>
                    ) : null}

                    {c.stato === "pronta" ? (
                      <button className="btn primary" type="button" disabled={inCorso} onClick={() => avviaConsegna(c)}>
                        Consegna al cliente
                      </button>
                    ) : null}

                    <a className="btn" href={`/api/documento-commessa?numero=${encodeURIComponent(c.numero)}`}>
                      Stampa
                    </a>

                    <button
                      className="btn"
                      type="button"
                      disabled={inCorso}
                      onClick={() => (editing === c.numero ? setEditing(null) : startEdit(c))}
                    >
                      {editing === c.numero ? "Annulla modifica" : "Modifica"}
                    </button>

                    <button className="btn danger" type="button" disabled={inCorso} onClick={() => handleDelete(c)}>
                      {inCorso ? "…" : "Elimina"}
                    </button>
                  </div>

                  {editing === c.numero ? (
                    <div className="panel" style={{ marginTop: 10 }}>
                      <div className="form-grid">
                        <div className="field">
                          <label htmlFor={`edit-cliente-${c.numero}`}>Cliente</label>
                          <input
                            id={`edit-cliente-${c.numero}`}
                            value={editForm.cliente}
                            onChange={(e) => setEditForm({ ...editForm, cliente: e.target.value })}
                          />
                        </div>
                        <div className="field">
                          <label htmlFor={`edit-telefono-${c.numero}`}>Telefono</label>
                          <input
                            id={`edit-telefono-${c.numero}`}
                            inputMode="tel"
                            value={editForm.telefono}
                            onChange={(e) => setEditForm({ ...editForm, telefono: e.target.value })}
                          />
                        </div>
                        <div className="field banco-field-wide">
                          <label htmlFor={`edit-articolo-${c.numero}`}>Cosa ordina il cliente</label>
                          <textarea
                            id={`edit-articolo-${c.numero}`}
                            rows={2}
                            value={editForm.richiesteParticolari}
                            onChange={(e) => setEditForm({ ...editForm, richiesteParticolari: e.target.value })}
                          />
                        </div>
                        <div className="field">
                          <label htmlFor={`edit-fornitore-${c.numero}`}>Fornitore</label>
                          <input
                            id={`edit-fornitore-${c.numero}`}
                            value={editForm.fornitore}
                            onChange={(e) => setEditForm({ ...editForm, fornitore: e.target.value })}
                          />
                        </div>
                        <div className="field">
                          <label htmlFor={`edit-data-ordine-${c.numero}`}>Data ordine</label>
                          <input
                            id={`edit-data-ordine-${c.numero}`}
                            type="date"
                            value={editForm.dataOrdine}
                            onChange={(e) => setEditForm({ ...editForm, dataOrdine: e.target.value })}
                          />
                        </div>
                        <div className="field">
                          <label htmlFor={`edit-consegna-${c.numero}`}>Consegna prevista</label>
                          <input
                            id={`edit-consegna-${c.numero}`}
                            type="date"
                            value={editForm.consegnaPrevista}
                            onChange={(e) => setEditForm({ ...editForm, consegnaPrevista: e.target.value })}
                          />
                        </div>
                        <div className="field">
                          <label htmlFor={`edit-acconto-${c.numero}`}>Acconto</label>
                          <input
                            id={`edit-acconto-${c.numero}`}
                            inputMode="decimal"
                            value={editForm.acconto}
                            onChange={(e) => setEditForm({ ...editForm, acconto: e.target.value })}
                          />
                        </div>
                        <div className="field">
                          <label htmlFor={`edit-saldo-${c.numero}`}>Saldo</label>
                          <input
                            id={`edit-saldo-${c.numero}`}
                            inputMode="decimal"
                            value={editForm.saldo}
                            onChange={(e) => setEditForm({ ...editForm, saldo: e.target.value })}
                          />
                        </div>
                      </div>
                      <div className="chips" style={{ marginTop: 12 }}>
                        {(
                          [
                            ["vendita", "Vendita"],
                            ["riparazione", "Riparazione"],
                          ] as const
                        ).map(([key, label]) => (
                          <button
                            key={key}
                            type="button"
                            className={`chip ${editForm[key] ? "active" : ""}`}
                            onClick={() => setEditForm({ ...editForm, [key]: !editForm[key] })}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                      <div className="card-actions" style={{ marginTop: 16 }}>
                        <button className="btn primary" type="button" disabled={inCorso} onClick={() => saveEdit(c)}>
                          {inCorso ? "Salvataggio…" : "Salva modifiche"}
                        </button>
                        <button className="btn" type="button" onClick={() => setEditing(null)}>
                          Annulla
                        </button>
                      </div>
                    </div>
                  ) : null}

                  {consegna === c.numero ? (
                    <div className="banco-consegna">
                      <label htmlFor={`saldo-${c.numero}`}>Saldo incassato</label>
                      <input
                        id={`saldo-${c.numero}`}
                        inputMode="decimal"
                        placeholder="0,00"
                        value={saldoConsegna}
                        onChange={(e) => setSaldoConsegna(e.target.value)}
                        autoFocus
                      />
                      <button className="btn primary" type="button" disabled={inCorso} onClick={() => confermaConsegna(c)}>
                        {inCorso ? "Salvataggio…" : "Conferma consegna"}
                      </button>
                      <button className="btn" type="button" onClick={() => setConsegna(null)}>
                        Annulla
                      </button>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <Toast message={toast} />
    </div>
  );
}
