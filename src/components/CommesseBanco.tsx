"use client";

import { useMemo, useRef, useState } from "react";
import { COMMESSA_STATUS_LABEL, type CommessaRecord } from "@/lib/commesse-types";
import { matchesQuery } from "@/lib/search-match";
import { networkErrorMessage, readJson } from "@/lib/fetch-json";
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

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
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
          richiesteParticolari: form.richiesteParticolari.trim() || null,
          dataOrdine: todayIso(),
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

  function avviaConsegna(c: CommessaRecord) {
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
                  className={`chip ${form[key] ? "active" : ""}`}
                  onClick={() => setForm({ ...form, [key]: !form[key] })}
                >
                  {label}
                </button>
              ))}
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
                  </div>

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
