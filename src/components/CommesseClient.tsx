"use client";

import { Fragment, useMemo, useRef, useState } from "react";
import { COMMESSA_STATUS_LABEL, type CommessaRecord } from "@/lib/commesse-types";
import { matchesQuery } from "@/lib/search-match";
import { networkErrorMessage, readJson } from "@/lib/fetch-json";
import { todayIso } from "@/lib/dates";
import { Toast } from "./Toast";

interface CommesseClientProps {
  initialCommesse: CommessaRecord[];
  puntiPerEuro: number;
  /** Numero di scheda arrivato come parametro nell'indirizzo (es. da una
   * riga di "Da tenere d'occhio" nella home): precompila la ricerca, così
   * il clic porta davvero sulla scheda invece che su un elenco intero. */
  initialQuery?: string;
}

const STATUS_PILL: Record<CommessaRecord["stato"], string> = {
  in_lavorazione: "noleggiato",
  pronta: "disponibile",
  ritirata: "archiviato",
};

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

export function CommesseClient({ initialCommesse, puntiPerEuro, initialQuery }: CommesseClientProps) {
  const [commesse, setCommesse] = useState(initialCommesse);
  const [query, setQuery] = useState(initialQuery ?? "");
  // Una scheda ritirata è chiusa: il cliente ha portato via la merce e non
  // c'è più niente da fare. Resta consultabile in archivio, ma sparisce
  // dall'elenco di lavoro, che altrimenti cresce all'infinito e nasconde
  // le schede ancora aperte fra decine di pratiche concluse.
  //
  // Se però si arriva qui da un link con una ricerca che corrisponde solo
  // a schede archiviate — dalla home o da un altro punto del gestionale —
  // si parte già dall'archivio, invece di mostrare un elenco vuoto per una
  // scheda che esiste.
  const [vista, setVista] = useState<"aperte" | "archivio">(() => {
    const q = (initialQuery ?? "").trim().toLowerCase();
    if (!q) return "aperte";
    // Il numero esatto vince sulla ricerca sfumata: un link diretto da "Da
    // tenere d'occhio" passa il numero di scheda, e la tolleranza ai
    // refusi altrimenti mescolava anche schede con un numero vicino.
    const esatte = initialCommesse.filter((c) => c.numero.toLowerCase() === q);
    const trovate = esatte.length
      ? esatte
      : initialCommesse.filter((c) =>
          matchesQuery([c.numero, c.cliente, c.telefono, c.cellulare].filter(Boolean).join(" ").toLowerCase(), q)
        );
    return trovate.length > 0 && trovate.every((c) => c.stato === "ritirata") ? "archivio" : "aperte";
  });
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  // Copia sempre aggiornata di "open", leggibile dentro una richiesta già
  // partita: la variabile di stato lì dentro resta ferma al valore che
  // aveva al momento del clic.
  const openRef = useRef<string | null>(null);
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

  // La ricerca si applica prima della divisione fra aperte e archivio, così
  // i due contatori dicono dove sono finiti i risultati: chi cerca una
  // scheda già chiusa vede "Archivio (1)" invece di un elenco vuoto.
  const cercate = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commesse;
    // Stessa priorità della vista iniziale qui sopra: un numero di scheda
    // esatto non deve mai mescolarsi con quelli solo vicini per un refuso.
    const esatte = commesse.filter((c) => c.numero.toLowerCase() === q);
    if (esatte.length) return esatte;
    return commesse.filter((c) =>
      matchesQuery([c.numero, c.cliente, c.telefono, c.cellulare].filter(Boolean).join(" ").toLowerCase(), q)
    );
  }, [commesse, query]);

  const aperteCount = useMemo(() => cercate.filter((c) => c.stato !== "ritirata").length, [cercate]);
  const archivioCount = cercate.length - aperteCount;

  const filtered = useMemo(
    () =>
      cercate.filter((c) => (vista === "archivio" ? c.stato === "ritirata" : c.stato !== "ritirata")),
    [cercate, vista]
  );

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!form.cliente.trim()) return;
    // Stesso controllo del riquadro di modifica: un importo digitato male
    // diventerebbe altrimenti un campo vuoto, e al ritiro la scheda non
    // genererebbe punti fedeltà senza che nessuno se ne accorga.
    const acconto = form.acconto ? Number(form.acconto.replace(",", ".")) : null;
    const saldo = form.saldo ? Number(form.saldo.replace(",", ".")) : null;
    if ((acconto != null && !Number.isFinite(acconto)) || (saldo != null && !Number.isFinite(saldo))) {
      showToast("Importo non valido in Acconto o Saldo: correggilo prima di continuare");
      return;
    }
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
          acconto,
          saldo,
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
      showToast(networkErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  function toggleOpen(c: CommessaRecord) {
    // Mentre un salvataggio è in corso la riga non si apre né si chiude:
    // cambiare scheda a metà scrittura porterebbe la risposta del server ad
    // arrivare su un riquadro che mostra ormai un'altra commessa.
    if (savingEdit) return;
    if (open === c.numero) {
      openRef.current = null;
      setOpen(null);
      setEditForm(null);
    } else {
      openRef.current = c.numero;
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
      // Riallinea le sole date che imposta il server ("Segna pronta" e
      // "Segna ritirata" le scrivono da sé): senza questo il form
      // continuerebbe a mostrarle vuote e il salvataggio successivo le
      // rimanderebbe a null, cancellandole dalla scheda.
      //
      // Solo quelle, e tramite il valore corrente del form: il salvataggio
      // dura un paio di secondi, durante i quali l'operatore può aver
      // corretto un importo o aperto un'altra scheda — riscrivere l'intero
      // form con la risposta del server cancellerebbe quanto digitato, o
      // peggio riverserebbe i dati di questa scheda su quella nel frattempo
      // aperta.
      const updated = (body.commesse as CommessaRecord[]).find((x) => x.numero === numero);
      if (updated) {
        setEditForm((f) =>
          openRef.current === numero && f
            ? { ...f, prontaIl: updated.prontaIl ?? "", ritirataIl: updated.ritirataIl ?? "" }
            : f
        );
      }
      showToast(message);
    } catch (err) {
      showToast(networkErrorMessage(err));
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
      if (openRef.current === c.numero) {
        openRef.current = null;
        setOpen(null);
        setEditForm(null);
      }
      showToast(`Scheda n. ${c.numero} eliminata`);
    } catch (err) {
      showToast(networkErrorMessage(err));
    } finally {
      setDeleting(null);
    }
  }

  // Converte i campi modificabili nel riquadro dettaglio nel formato del
  // PATCH. Usata sia dal salvataggio esplicito che dai cambi di stato: se
  // l'operatore ha digitato acconto/saldo o le note prima di premere "Segna
  // pronta"/"Segna ritirata" (invece di premere prima "Salva modifiche"),
  // quei valori non vanno persi né saltare l'accredito punti fedeltà.
  // Restituisce null (mostrando un avviso) se acconto/saldo non sono numeri
  // validi, invece di farli sparire silenziosamente come null.
  function editFormPatch(): Partial<CommessaRecord> | null {
    if (!editForm) return {};
    const acconto = editForm.acconto ? Number(editForm.acconto.replace(",", ".")) : null;
    const saldo = editForm.saldo ? Number(editForm.saldo.replace(",", ".")) : null;
    if ((acconto != null && !Number.isFinite(acconto)) || (saldo != null && !Number.isFinite(saldo))) {
      showToast("Importo non valido in Acconto o Saldo: correggilo prima di continuare");
      return null;
    }
    return {
      controlloFinale: editForm.controlloFinale || null,
      noteChiusura: editForm.noteChiusura || null,
      prontaIl: editForm.prontaIl || null,
      ritirataIl: editForm.ritirataIl || null,
      acconto,
      saldo,
    };
  }

  async function handleSaveEdit(c: CommessaRecord) {
    if (!editForm) return;
    const patch = editFormPatch();
    if (!patch) return;
    await patchCommessa(c.numero, patch, `Scheda n. ${c.numero} aggiornata`);
  }

  async function changeStatus(
    c: CommessaRecord,
    stato: CommessaRecord["stato"],
    extra: Partial<CommessaRecord>,
    message: string
  ) {
    const patch = editFormPatch();
    if (!patch) return;
    await patchCommessa(c.numero, { ...patch, ...extra, stato }, message);
  }

  return (
    <div className="wrap wide">
      <header className="page-header with-action">
        <div className="page-header-text">
          <h1>Commesse</h1>
          <p className="sub">
            {commesse.length} schede lavoro · vendite e riparazioni, stesso modulo di sempre ma digitale
          </p>
        </div>
        <button className="btn primary" type="button" onClick={() => setCreating((v) => !v)}>
          {creating ? "Annulla" : "+ Nuova scheda"}
        </button>
      </header>

      {creating ? (
        <div className="panel">
          <form onSubmit={handleCreate}>
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
        </div>
      ) : null}

      <div className="panel">
        <input
          className="searchbox"
          placeholder="Cerca per numero, cliente, telefono…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="chips" style={{ margin: "12px 0 14px" }}>
          <button
            type="button"
            className={`chip ${vista === "aperte" ? "active" : ""}`}
            onClick={() => setVista("aperte")}
          >
            Da lavorare ({aperteCount})
          </button>
          <button
            type="button"
            className={`chip ${vista === "archivio" ? "active" : ""}`}
            onClick={() => setVista("archivio")}
          >
            Archivio ({archivioCount})
          </button>
        </div>
        {filtered.length === 0 ? (
          <p className="hint" style={{ margin: 0 }}>
            {commesse.length === 0
              ? "Nessuna scheda ancora registrata."
              : query.trim()
                ? vista === "aperte" && archivioCount > 0
                  ? `Nessuna scheda aperta corrisponde alla ricerca, ma ${archivioCount === 1 ? "ce n'è una" : `ce ne sono ${archivioCount}`} in archivio.`
                  : "Nessuna scheda corrisponde alla ricerca."
                : vista === "archivio"
                  ? "Nessuna scheda ritirata: l'archivio è vuoto."
                  : "Nessuna scheda da lavorare: sono state tutte ritirate."}
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
                                    onClick={() =>
                                      changeStatus(
                                        c,
                                        "pronta",
                                        { prontaIl: editForm?.prontaIl || todayIso() },
                                        `Scheda n. ${c.numero} pronta per la consegna`
                                      )
                                    }
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
                                      changeStatus(
                                        c,
                                        "ritirata",
                                        { ritirataIl: editForm?.ritirataIl || todayIso() },
                                        `Scheda n. ${c.numero} ritirata — spostata in archivio`
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
                                    onClick={() =>
                                      changeStatus(c, "in_lavorazione", {}, `Scheda n. ${c.numero} riportata in lavorazione`)
                                    }
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
                                    disabled={savingEdit}
                                  />
                                </div>
                                <div className="field">
                                  <label>Saldo da pagare €</label>
                                  <input
                                    inputMode="decimal"
                                    value={editForm.saldo}
                                    onChange={(e) => setEditForm({ ...editForm, saldo: e.target.value })}
                                    disabled={savingEdit}
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
                                  disabled={savingEdit}
                                />
                              </div>
                              <div className="field-row">
                                <div className="field">
                                  <label>Pronto il</label>
                                  <input
                                    type="date"
                                    value={editForm.prontaIl}
                                    onChange={(e) => setEditForm({ ...editForm, prontaIl: e.target.value })}
                                    disabled={savingEdit}
                                  />
                                </div>
                                <div className="field">
                                  <label>Ritirato il</label>
                                  <input
                                    type="date"
                                    value={editForm.ritirataIl}
                                    onChange={(e) => setEditForm({ ...editForm, ritirataIl: e.target.value })}
                                    disabled={savingEdit}
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
