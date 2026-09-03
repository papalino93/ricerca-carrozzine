"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { ClientRecord } from "@/lib/clients";
import {
  calcolaCompletamento,
  FASCICOLO_STATO_LABEL,
  FASCICOLO_STATO_OPTIONS,
  MAX_ALLEGATI_PER_FASCICOLO,
  SEZIONI_FASCICOLO,
  type EsamePiedeLato,
  type FascicoloContenuto,
  type FascicoloRecord,
  type FascicoloStato,
  type FaseProduzione,
  type SezioneFascicolo,
  type VisitaControllo,
} from "@/lib/fascicoli-types";
import { CODICE_FISCALE_LUNGHEZZA, codiceFiscaleAvviso } from "@/lib/codice-fiscale";
import type { FascicoloAllegatoMeta } from "@/lib/fascicoli-allegati";
import { networkErrorMessage, readJson } from "@/lib/fetch-json";
import { IconAnteprima, IconSalva, IconScarica, IconStampa } from "./ReceptionIcons";
import { Toast } from "./Toast";

interface FascicoloEditorClientProps {
  initialFascicolo: FascicoloRecord;
  initialCliente: ClientRecord;
  /** Numeri commessa già aperti in Amministrazione → Commesse, per
   * l'autocompletamento: il fascicolo può comunque restare abbinato a un
   * testo libero se la commessa non è (ancora) stata aperta lì. */
  commesse: { numero: string; cliente: string }[];
}

type SaveState = "idle" | "saving" | "saved" | "error";

const AUTOSAVE_DELAY_MS = 1500;

// ---------- piccoli campi di modulo condivisi tra le sezioni ----------

function Field({ label, obbligatorio, children }: { label: string; obbligatorio?: boolean; children: React.ReactNode }) {
  return (
    <div className="field">
      <label>
        {label}
        {obbligatorio ? " *" : ""}
      </label>
      {children}
    </div>
  );
}

function RadioToggle<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T | null;
  options: { key: T; label: string }[];
  onChange: (v: T | null) => void;
}) {
  return (
    <div className="chips">
      {options.map((o) => (
        <button
          key={o.key}
          type="button"
          className={`chip ${value === o.key ? "active" : ""}`}
          onClick={() => onChange(value === o.key ? null : o.key)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function MultiToggle({ value, options, onChange }: { value: number[]; options: number[]; onChange: (v: number[]) => void }) {
  return (
    <div className="chips">
      {options.map((n) => (
        <button
          key={n}
          type="button"
          className={`chip ${value.includes(n) ? "active" : ""}`}
          onClick={() => onChange(value.includes(n) ? value.filter((v) => v !== n) : [...value, n].sort())}
        >
          {n}°
        </button>
      ))}
    </div>
  );
}

function CheckLine({ checked, label, onChange }: { checked: boolean; label: string; onChange: (v: boolean) => void }) {
  return (
    <label className="fascicolo-checkline">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}

const DITA_OPTIONS = [1, 2, 3, 4, 5];

export function FascicoloEditorClient({ initialFascicolo, initialCliente, commesse }: FascicoloEditorClientProps) {
  const router = useRouter();
  const [fascicolo, setFascicolo] = useState(initialFascicolo);
  const [cliente, setCliente] = useState(initialCliente);
  const [tab, setTab] = useState<SezioneFascicolo>("anagrafica");
  const [saveState, setSaveState] = useState<SaveState>("idle");
  // Disabilita i pulsanti della savebar mentre una di queste azioni è in
  // corso: senza, un doppio click (o doppio tap su tablet) su "Genera
  // fascicolo e scarica PDF" incrementava la versione due volte e caricava
  // due PDF distinti su Drive per una singola azione dell'operatore.
  const [azioneInCorso, setAzioneInCorso] = useState<null | "salva" | "anteprima" | "genera">(null);
  const [dirty, setDirty] = useState(false);
  const [clienteDirty, setClienteDirty] = useState(false);
  const [clienteSaving, setClienteSaving] = useState(false);
  // Doppia conferma per l'eliminazione (stesso pattern di DeviceDetailModal):
  // azione irreversibile, un solo click è troppo facile da premere per sbaglio.
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [allegati, setAllegati] = useState<FascicoloAllegatoMeta[]>([]);
  const [allegatoEtichetta, setAllegatoEtichetta] = useState("");
  const [uploadingAllegato, setUploadingAllegato] = useState(false);
  const [allegatoError, setAllegatoError] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fascicoloRef = useRef(fascicolo);

  useEffect(() => {
    fascicoloRef.current = fascicolo;
  }, [fascicolo]);

  useEffect(() => {
    fetch(`/api/fascicoli/${initialFascicolo.numero}/allegati`)
      .then((res) => readJson(res))
      .then((body) => setAllegati(body.allegati ?? []))
      .catch(() => {});
  }, [initialFascicolo.numero]);

  async function handleAllegatoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploadingAllegato(true);
    setAllegatoError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("etichetta", allegatoEtichetta);
      const res = await fetch(`/api/fascicoli/${fascicolo.numero}/allegati`, { method: "POST", body: fd });
      const body = await readJson(res);
      if (!res.ok) throw new Error(body.error || "Caricamento allegato non riuscito");
      setAllegati(body.allegati);
      setAllegatoEtichetta("");
    } catch (err) {
      setAllegatoError(networkErrorMessage(err));
    } finally {
      setUploadingAllegato(false);
    }
  }

  async function handleAllegatoRemove(id: string) {
    setUploadingAllegato(true);
    setAllegatoError(null);
    try {
      const res = await fetch(
        `/api/fascicoli/${fascicolo.numero}/allegati?id=${encodeURIComponent(id)}`,
        { method: "DELETE" }
      );
      const body = await readJson(res);
      if (!res.ok) throw new Error(body.error || "Rimozione allegato non riuscita");
      setAllegati(body.allegati);
    } catch (err) {
      setAllegatoError(networkErrorMessage(err));
    } finally {
      setUploadingAllegato(false);
    }
  }

  function showToast(msg: string) {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2400);
  }

  const completamento = useMemo(() => calcolaCompletamento(fascicolo), [fascicolo]);
  // Percentuale complessiva accanto ai pallini per-tab già esistenti: quelli
  // dicono QUALI sezioni mancano, questa dice A CHE PUNTO si è in generale,
  // leggibile senza dover scorrere l'intera barra delle tab. Nessuna sezione
  // diventa obbligatoria: resta solo un indicatore, non un blocco.
  const sezioniCompletate = SEZIONI_FASCICOLO.filter((s) => completamento[s.key]).length;
  const percentualeCompletamento = Math.round((sezioniCompletate / SEZIONI_FASCICOLO.length) * 100);

  // Due richieste PATCH sovrapposte sullo stesso fascicolo (l'autosave che
  // parte mentre "Salva" è ancora in corso, o due tab sullo stesso
  // fascicolo) leggono lato server lo stesso stato di partenza: l'ultima a
  // scrivere cancella in silenzio i campi salvati dall'altra, perché
  // updateFascicolo riscrive l'intero foglio a ogni chiamata. Due difese:
  // "ifUltimaModifica" fa rifiutare al server una scrittura basata su uno
  // stato ormai superato (vedi FascicoloConflictError in fascicoli.ts);
  // inFlightRef impedisce che QUESTA scheda ne generi comunque due in
  // parallelo, mettendo in coda la richiesta successiva invece di
  // accavallarla — così una battitura durante l'autosave non genera mai
  // il conflitto con se stessa.
  const inFlightRef = useRef<Promise<boolean> | null>(null);
  const queuedOptsRef = useRef<{ incrementaVersione?: boolean; silent?: boolean } | null>(null);

  const doPersist = useCallback(async (opts?: { incrementaVersione?: boolean; silent?: boolean }) => {
    const current = fascicoloRef.current;
    setSaveState("saving");
    try {
      const res = await fetch(`/api/fascicoli/${current.numero}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stato: current.stato,
          commessa: current.commessa,
          tipoDispositivo: current.tipoDispositivo,
          operatore: current.operatore,
          contenuto: current.contenuto,
          incrementaVersione: Boolean(opts?.incrementaVersione),
          ifUltimaModifica: current.ultimaModifica,
        }),
      });
      const body = await readJson(res);
      if (res.status === 409) {
        // Non riprovare da solo: il nostro stato locale è basato su una
        // versione ormai superata, riscrivere sopra rischierebbe di
        // cancellare a nostra volta il salvataggio dell'altra scheda.
        setSaveState("error");
        showToast(body.error || "Fascicolo modificato altrove: ricarica la pagina prima di continuare.");
        return false;
      }
      if (!res.ok) throw new Error(body.error || "Salvataggio non riuscito");
      setFascicolo(body.fascicolo);
      setSaveState("saved");
      setDirty(false);
      if (!opts?.silent) showToast("Fascicolo salvato");
      return true;
    } catch (err) {
      setSaveState("error");
      showToast(networkErrorMessage(err));
      return false;
    }
  }, []);

  const persist = useCallback(
    (opts?: { incrementaVersione?: boolean; silent?: boolean }): Promise<boolean> => {
      if (inFlightRef.current) {
        queuedOptsRef.current = opts ?? {};
        return inFlightRef.current;
      }
      const run = async () => {
        let result = await doPersist(opts);
        while (queuedOptsRef.current) {
          const nextOpts = queuedOptsRef.current;
          queuedOptsRef.current = null;
          result = await doPersist(nextOpts);
        }
        inFlightRef.current = null;
        return result;
      };
      const running = run();
      inFlightRef.current = running;
      return running;
    },
    [doPersist]
  );

  const scheduleAutosave = useCallback(() => {
    setDirty(true);
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      persist({ silent: true });
    }, AUTOSAVE_DELAY_MS);
  }, [persist]);

  // Avviso se si prova ad abbandonare la pagina con modifiche non ancora
  // salvate (l'autosave con debounce lascia una piccola finestra scoperta).
  useEffect(() => {
    function onBeforeUnload(e: BeforeUnloadEvent) {
      if (dirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  useEffect(() => {
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, []);

  function updateTop(patch: Partial<Pick<FascicoloRecord, "stato" | "commessa" | "tipoDispositivo" | "operatore">>) {
    setFascicolo((prev) => ({ ...prev, ...patch }));
    scheduleAutosave();
  }

  function updateContenuto<K extends keyof FascicoloContenuto>(section: K, patch: Partial<FascicoloContenuto[K]>) {
    setFascicolo((prev) => ({
      ...prev,
      contenuto: { ...prev.contenuto, [section]: { ...prev.contenuto[section], ...patch } },
    }));
    scheduleAutosave();
  }

  function updateLato(lato: "sinistro" | "destro", patch: Partial<EsamePiedeLato>) {
    updateContenuto("esamePiede", {
      [lato]: { ...fascicolo.contenuto.esamePiede[lato], ...patch },
    } as Partial<FascicoloContenuto["esamePiede"]>);
  }

  // Data ordine, data privacy, data inizio lavori e data 1° appuntamento
  // coincidono quasi sempre nella pratica reale: la prima che viene
  // compilata si ripropone automaticamente in quelle ancora vuote, così non
  // va reinserita a mano su ogni tab. Restano indipendenti la data di
  // prescrizione medica (arriva spesso in un giorno diverso dall'ordine) e
  // le date rivolte in avanti (consegna prevista/effettiva, follow-up,
  // visite di controllo).
  function updateDataSincronizzata(
    value: string | null,
    campo: "dataOrdine" | "dataConsenso" | "dataInizioLavori" | "dataPrimoAppuntamento"
  ) {
    setFascicolo((prev) => {
      const cc = prev.contenuto;
      const valori = {
        dataOrdine: cc.prescrizione.dataOrdine,
        dataConsenso: cc.consensi.dataConsenso,
        dataInizioLavori: cc.produzione.dataInizioLavori,
        dataPrimoAppuntamento: cc.consegna.dataPrimoAppuntamento,
      };
      valori[campo] = value;
      if (value) {
        for (const k of Object.keys(valori) as (keyof typeof valori)[]) {
          if (k !== campo && !valori[k]) valori[k] = value;
        }
      }
      return {
        ...prev,
        contenuto: {
          ...cc,
          prescrizione: { ...cc.prescrizione, dataOrdine: valori.dataOrdine },
          consensi: { ...cc.consensi, dataConsenso: valori.dataConsenso },
          produzione: { ...cc.produzione, dataInizioLavori: valori.dataInizioLavori },
          consegna: { ...cc.consegna, dataPrimoAppuntamento: valori.dataPrimoAppuntamento },
        },
      };
    });
    scheduleAutosave();
  }

  // Aggiorna una singola fase leggendo lo stato PIÙ RECENTE (funzione di
  // aggiornamento, non la "c" catturata dalla chiusura del render): due
  // checkbox diverse spuntate a distanza ravvicinata (doppio tap, tastiera)
  // partivano altrimenti dalla stessa "fasi" di partenza, e l'ultima a
  // scrivere sovrascriveva silenziosamente la modifica dell'altra.
  function updateFase(numero: number, patch: Partial<FaseProduzione>) {
    setFascicolo((prev) => ({
      ...prev,
      contenuto: {
        ...prev.contenuto,
        produzione: {
          ...prev.contenuto.produzione,
          fasi: prev.contenuto.produzione.fasi.map((f) => (f.numero === numero ? { ...f, ...patch } : f)),
        },
      },
    }));
    scheduleAutosave();
  }

  async function handleSalva() {
    if (azioneInCorso) return;
    setAzioneInCorso("salva");
    try {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      await persist();
    } finally {
      setAzioneInCorso(null);
    }
  }

  async function assicuraSalvato(): Promise<boolean> {
    if (!dirty) return true;
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    return persist({ silent: true });
  }

  async function handleAnteprima() {
    if (azioneInCorso) return;
    setAzioneInCorso("anteprima");
    try {
      const ok = await assicuraSalvato();
      if (!ok) return;
      window.open(`/api/fascicoli/${fascicolo.numero}/documento?inline=1`, "_blank");
    } finally {
      setAzioneInCorso(null);
    }
  }

  // Finalizza (incrementa la versione, archivia su Drive se configurato) e
  // scarica: prima erano due pulsanti separati ("Genera fascicolo" apriva
  // inline, "Scarica PDF" scaricava) che facevano esattamente la stessa
  // cosa lato dati — unificati per non lasciar credere che siano due azioni
  // diverse.
  async function handleGeneraEScarica() {
    if (azioneInCorso) return;
    setAzioneInCorso("genera");
    try {
      const ok = await assicuraSalvato();
      if (!ok) return;
      window.open(`/api/fascicoli/${fascicolo.numero}/documento?finalizza=1`, "_blank");
      showToast("PDF generato");
    } finally {
      setAzioneInCorso(null);
    }
  }

  async function handleSalvaAnagrafica() {
    setClienteSaving(true);
    try {
      const res = await fetch("/api/clienti", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome: initialCliente.nome,
          azione: "anagrafica",
          patch: {
            codiceFiscale: cliente.codiceFiscale,
            dataNascita: cliente.dataNascita,
            luogoNascita: cliente.luogoNascita,
            indirizzo: cliente.indirizzo,
            cap: cliente.cap,
            localita: cliente.localita,
            provincia: cliente.provincia,
            telefono: cliente.telefono,
            cellulare: cliente.cellulare,
            email: cliente.email,
          },
        }),
      });
      const body = await readJson(res);
      if (!res.ok) throw new Error(body.error || "Salvataggio anagrafica non riuscito");
      setCliente(body.client);
      // Il CF può essere cambiato: teniamo la copia sul fascicolo allineata,
      // usata dall'Archivio per filtrare senza dover incrociare Clienti.
      if (body.client.codiceFiscale !== fascicolo.clienteCF) {
        setFascicolo((prev) => ({ ...prev, clienteCF: body.client.codiceFiscale }));
        persist({ silent: true });
      }
      setClienteDirty(false);
      showToast("Anagrafica aggiornata");
    } catch (err) {
      showToast(networkErrorMessage(err));
    } finally {
      setClienteSaving(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      const res = await fetch(`/api/fascicoli/${fascicolo.numero}`, { method: "DELETE" });
      const body = await readJson(res);
      if (!res.ok) throw new Error(body.error || "Eliminazione non riuscita");
      router.push("/admin/fascicoli/archivio");
    } catch (err) {
      showToast(networkErrorMessage(err));
      setDeleting(false);
    }
  }

  // Visite di controllo: numero libero (1ª, 2ª, 3ª...), aggiunte quando
  // servono davvero, non un numero fisso deciso in partenza.
  function addVisita() {
    setFascicolo((prev) => {
      const visite = prev.contenuto.consegna.visiteControllo;
      const numero = visite.length > 0 ? Math.max(...visite.map((v) => v.numero)) + 1 : 1;
      const nuova: VisitaControllo = { numero, data: new Date().toISOString().slice(0, 10), nota: null };
      return {
        ...prev,
        contenuto: {
          ...prev.contenuto,
          consegna: { ...prev.contenuto.consegna, visiteControllo: [...visite, nuova] },
        },
      };
    });
    scheduleAutosave();
  }

  function updateVisita(numero: number, patch: Partial<VisitaControllo>) {
    setFascicolo((prev) => ({
      ...prev,
      contenuto: {
        ...prev.contenuto,
        consegna: {
          ...prev.contenuto.consegna,
          visiteControllo: prev.contenuto.consegna.visiteControllo.map((v) => (v.numero === numero ? { ...v, ...patch } : v)),
        },
      },
    }));
    scheduleAutosave();
  }

  function removeVisita(numero: number) {
    setFascicolo((prev) => ({
      ...prev,
      contenuto: {
        ...prev.contenuto,
        consegna: {
          ...prev.contenuto.consegna,
          visiteControllo: prev.contenuto.consegna.visiteControllo.filter((v) => v.numero !== numero),
        },
      },
    }));
    scheduleAutosave();
  }

  const c = fascicolo.contenuto;
  // "Sezione successiva": la scheda ha 8 tab e alcune (Esame del piede,
  // Produzione) sono lunghe da scorrere. Senza questo, passare alla
  // prossima sezione significa risalire fino alla barra delle tab in cima.
  const tabIndex = SEZIONI_FASCICOLO.findIndex((s) => s.key === tab);
  const nextSezione = tabIndex >= 0 && tabIndex < SEZIONI_FASCICOLO.length - 1 ? SEZIONI_FASCICOLO[tabIndex + 1] : null;
  const saveLabel: Record<SaveState, { text: string; className: string }> = {
    idle: { text: "", className: "" },
    saving: { text: "Salvataggio…", className: "saving" },
    saved: { text: "Salvato", className: "saved" },
    error: { text: "Errore salvataggio", className: "error" },
  };

  return (
    <div className="wrap wide">
      <header className="page-header with-action">
        <div className="page-header-text">
          <div className="page-title-row">
            <h1>{fascicolo.numero}</h1>
            <select
              value={fascicolo.stato}
              onChange={(e) => updateTop({ stato: e.target.value as FascicoloStato })}
              style={{ maxWidth: 220 }}
            >
              {FASCICOLO_STATO_OPTIONS.map((o) => (
                <option key={o.key} value={o.key}>
                  {FASCICOLO_STATO_LABEL[o.key]}
                </option>
              ))}
            </select>
          </div>
          <p className="sub">{fascicolo.clienteNome}</p>
        </div>
        <div className="fascicolo-savestate-wrap">
          {saveLabel[saveState].text ? (
            <span className={`fascicolo-savestate ${saveLabel[saveState].className}`}>
              <span className="status-dot" />
              {saveLabel[saveState].text}
            </span>
          ) : null}
        </div>
      </header>

      <div className="fascicolo-savebar">
        <div className="card-actions" style={{ margin: 0 }}>
          <button type="button" className="btn" onClick={handleSalva} disabled={Boolean(azioneInCorso)}>
            <span className="btn-icon"><IconSalva /></span> Salva
          </button>
          <button type="button" className="btn" onClick={handleAnteprima} disabled={Boolean(azioneInCorso)}>
            <span className="btn-icon"><IconAnteprima /></span> Anteprima / Stampa
          </button>
          <button
            type="button"
            className="btn primary"
            onClick={handleGeneraEScarica}
            disabled={Boolean(azioneInCorso)}
          >
            {azioneInCorso === "genera" ? (
              "Generazione…"
            ) : (
              <>
                <span className="btn-icon"><IconScarica /></span> Genera fascicolo e scarica PDF
              </>
            )}
          </button>
        </div>
      </div>
      <p className="hint" style={{ marginTop: -6, marginBottom: 14 }}>
        &quot;Anteprima / Stampa&quot; è libera, non lascia traccia. &quot;Genera fascicolo e scarica PDF&quot;
        invece finalizza: incrementa la versione del fascicolo (oggi alla {fascicolo.versione}ª) e, se configurato,
        lo archivia su Drive.
      </p>

      <div className="fascicolo-progress">
        <div className="fascicolo-progress-track">
          <div className="fascicolo-progress-fill" style={{ width: `${percentualeCompletamento}%` }} />
        </div>
        <div className="fascicolo-progress-label">
          {sezioniCompletate} di {SEZIONI_FASCICOLO.length} sezioni completate ({percentualeCompletamento}%)
        </div>
      </div>

      <div className="fascicolo-tabs">
        {SEZIONI_FASCICOLO.map((s) => (
          <button
            key={s.key}
            type="button"
            className={`fascicolo-tab ${tab === s.key ? "active" : ""}`}
            onClick={() => setTab(s.key)}
          >
            <span className={`dot ${completamento[s.key] ? "done" : ""}`} />
            {s.label}
          </button>
        ))}
      </div>

      <div className="panel">
        {tab === "anagrafica" ? (
          <>
            <div className="page-title-row" style={{ marginBottom: 4 }}>
              <h2 style={{ margin: 0 }}>{cliente.nome}</h2>
              <Link href={`/clienti/${encodeURIComponent(cliente.nome)}`} className="btn-link">
                Vedi scheda cliente completa →
              </Link>
            </div>
            <p className="hint">
              Questi dati sono quelli dell&apos;anagrafica clienti: modificarli qui li aggiorna ovunque, non solo su
              questo fascicolo. Nella scheda cliente trovi anche lo storico noleggi e gli altri eventuali fascicoli.
            </p>
            <div className="form-grid">
              <Field label="Codice fiscale">
                <input
                  value={cliente.codiceFiscale ?? ""}
                  maxLength={CODICE_FISCALE_LUNGHEZZA}
                  onChange={(e) => {
                    setCliente({ ...cliente, codiceFiscale: e.target.value.toUpperCase() || null });
                    setClienteDirty(true);
                  }}
                />
                {codiceFiscaleAvviso(cliente.codiceFiscale) ? (
                  <p className="hint">{codiceFiscaleAvviso(cliente.codiceFiscale)}</p>
                ) : null}
              </Field>
              <Field label="Data di nascita">
                <input
                  type="date"
                  value={cliente.dataNascita ?? ""}
                  onChange={(e) => {
                    setCliente({ ...cliente, dataNascita: e.target.value || null });
                    setClienteDirty(true);
                  }}
                />
              </Field>
              <Field label="Luogo di nascita">
                <input
                  value={cliente.luogoNascita ?? ""}
                  onChange={(e) => {
                    setCliente({ ...cliente, luogoNascita: e.target.value || null });
                    setClienteDirty(true);
                  }}
                />
              </Field>
              <Field label="Indirizzo">
                <input
                  value={cliente.indirizzo ?? ""}
                  onChange={(e) => {
                    setCliente({ ...cliente, indirizzo: e.target.value || null });
                    setClienteDirty(true);
                  }}
                />
              </Field>
              <Field label="CAP">
                <input
                  value={cliente.cap ?? ""}
                  onChange={(e) => {
                    setCliente({ ...cliente, cap: e.target.value || null });
                    setClienteDirty(true);
                  }}
                />
              </Field>
              <Field label="Comune">
                <input
                  value={cliente.localita ?? ""}
                  onChange={(e) => {
                    setCliente({ ...cliente, localita: e.target.value || null });
                    setClienteDirty(true);
                  }}
                />
              </Field>
              <Field label="Provincia">
                <input
                  value={cliente.provincia ?? ""}
                  onChange={(e) => {
                    setCliente({ ...cliente, provincia: e.target.value || null });
                    setClienteDirty(true);
                  }}
                />
              </Field>
              <Field label="Telefono">
                <input
                  value={cliente.telefono ?? ""}
                  onChange={(e) => {
                    setCliente({ ...cliente, telefono: e.target.value || null });
                    setClienteDirty(true);
                  }}
                />
              </Field>
              <Field label="Cellulare">
                <input
                  value={cliente.cellulare ?? ""}
                  onChange={(e) => {
                    setCliente({ ...cliente, cellulare: e.target.value || null });
                    setClienteDirty(true);
                  }}
                />
              </Field>
              <Field label="Email">
                <input
                  type="email"
                  value={cliente.email ?? ""}
                  onChange={(e) => {
                    setCliente({ ...cliente, email: e.target.value || null });
                    setClienteDirty(true);
                  }}
                />
              </Field>
            </div>
            <div className="card-actions">
              <button type="button" className="btn primary" disabled={!clienteDirty || clienteSaving} onClick={handleSalvaAnagrafica}>
                {clienteSaving ? "Salvataggio…" : "Salva anagrafica"}
              </button>
            </div>

            <h2 style={{ marginTop: 22 }}>Dati fascicolo</h2>
            <div className="form-grid">
              <Field label="Tipo dispositivo">
                <input value={fascicolo.tipoDispositivo} onChange={(e) => updateTop({ tipoDispositivo: e.target.value })} />
              </Field>
              <Field label="Operatore">
                <input value={fascicolo.operatore ?? ""} onChange={(e) => updateTop({ operatore: e.target.value || null })} />
              </Field>
              <Field label="Commessa collegata">
                <input
                  list="fascicolo-commesse-list"
                  value={fascicolo.commessa ?? ""}
                  onChange={(e) => updateTop({ commessa: e.target.value || null })}
                  placeholder="Numero commessa, se già aperta in Amministrazione"
                />
                <datalist id="fascicolo-commesse-list">
                  {commesse.map((cm) => (
                    <option key={cm.numero} value={cm.numero}>
                      {cm.cliente}
                    </option>
                  ))}
                </datalist>
                <p className="hint">
                  Digitando compaiono i numeri delle commesse già aperte in Amministrazione → Commesse (con il
                  relativo cliente): è solo un testo di collegamento, non un vincolo, quindi puoi anche scriverne uno
                  non ancora aperto lì.
                </p>
              </Field>
            </div>
          </>
        ) : null}

        {tab === "privacy" ? (
          <>
            <h2>Privacy e consensi</h2>
            <CheckLine
              checked={c.consensi.consensoTrattamentoDati}
              label="Consenso al trattamento dei dati personali e particolari"
              onChange={(v) => {
                updateContenuto("consensi", { consensoTrattamentoDati: v });
                if (v && !c.consensi.dataConsenso) {
                  updateDataSincronizzata(new Date().toISOString().slice(0, 10), "dataConsenso");
                }
              }}
            />
            <CheckLine
              checked={c.consensi.presaVisioneInformativa}
              label="Presa visione dell'informativa privacy"
              onChange={(v) => updateContenuto("consensi", { presaVisioneInformativa: v })}
            />
            <CheckLine
              checked={c.consensi.consensoDocumentazione}
              label="Consenso relativo alla documentazione tecnica del dispositivo"
              onChange={(v) => updateContenuto("consensi", { consensoDocumentazione: v })}
            />
            <Field label="Data consenso">
              <input
                type="date"
                value={c.consensi.dataConsenso ?? ""}
                onChange={(e) => updateDataSincronizzata(e.target.value || null, "dataConsenso")}
              />
            </Field>
            <p className="hint" style={{ marginTop: 10 }}>
              La firma resta su carta dopo la stampa del fascicolo: la firma digitale sullo schermo è predisposta nel
              sistema ma non ancora attiva.
            </p>
          </>
        ) : null}

        {tab === "anamnesi" ? (
          <>
            <h2>Anamnesi</h2>
            <div className="form-grid">
              <Field label="Altezza (cm)">
                <input
                  type="number"
                  min={30}
                  max={260}
                  value={c.anamnesi.altezzaCm ?? ""}
                  onChange={(e) => updateContenuto("anamnesi", { altezzaCm: e.target.value ? Number(e.target.value) : null })}
                />
              </Field>
              <Field label="Peso (kg)">
                <input
                  type="number"
                  min={1}
                  max={350}
                  value={c.anamnesi.pesoKg ?? ""}
                  onChange={(e) => updateContenuto("anamnesi", { pesoKg: e.target.value ? Number(e.target.value) : null })}
                />
              </Field>
            </div>
            <Field label="Patologia correlata al dispositivo">
              <textarea
                value={c.anamnesi.patologiaCorrelata ?? ""}
                onChange={(e) => updateContenuto("anamnesi", { patologiaCorrelata: e.target.value || null })}
              />
            </Field>
            <Field label="Altre patologie">
              <textarea
                value={c.anamnesi.altrePatologie ?? ""}
                onChange={(e) => updateContenuto("anamnesi", { altrePatologie: e.target.value || null })}
              />
            </Field>
            <CheckLine
              checked={c.anamnesi.nessunaAllergia}
              label="Dichiara di non avere allergie"
              onChange={(v) => updateContenuto("anamnesi", { nessunaAllergia: v, allergie: v ? null : c.anamnesi.allergie })}
            />
            {!c.anamnesi.nessunaAllergia ? (
              <Field label="Allergie">
                <textarea
                  value={c.anamnesi.allergie ?? ""}
                  onChange={(e) => updateContenuto("anamnesi", { allergie: e.target.value || null })}
                />
              </Field>
            ) : null}
            <Field label="Capacità psicofisica al corretto utilizzo">
              <RadioToggle
                value={c.anamnesi.capacitaPsicofisica}
                options={[
                  { key: "totale", label: "Totale" },
                  { key: "parziale", label: "Parziale" },
                  { key: "assistenza", label: "Necessità di assistente" },
                ]}
                onChange={(v) => updateContenuto("anamnesi", { capacitaPsicofisica: v })}
              />
            </Field>
          </>
        ) : null}

        {tab === "esamePiede" ? (
          <>
            <h2>Esame del piede</h2>
            <Field label="Motivo della visita">
              <textarea
                value={c.esamePiede.motivoVisita ?? ""}
                onChange={(e) => updateContenuto("esamePiede", { motivoVisita: e.target.value || null })}
              />
            </Field>
            <div className="fascicolo-piede-grid">
              {(["sinistro", "destro"] as const).map((lato) => {
                const l = c.esamePiede[lato];
                return (
                  <div key={lato}>
                    <h3 className="fascicolo-lato-title">Piede {lato}</h3>
                    <Field label="Piede piatto">
                      <RadioToggle
                        value={l.piedePiatto}
                        options={[
                          { key: "riducibile", label: "Riducibile" },
                          { key: "irriducibile", label: "Irriducibile" },
                        ]}
                        onChange={(v) => updateLato(lato, { piedePiatto: v })}
                      />
                    </Field>
                    <Field label="Piede cavo">
                      <RadioToggle
                        value={l.piedeCavo}
                        options={[
                          { key: "anteriore", label: "Anteriore" },
                          { key: "posteriore", label: "Posteriore" },
                        ]}
                        onChange={(v) => updateLato(lato, { piedeCavo: v })}
                      />
                    </Field>
                    <Field label="Pronazione">
                      <RadioToggle
                        value={l.pronazione}
                        options={[
                          { key: "avampiede", label: "Avampiede" },
                          { key: "retropiede", label: "Retropiede" },
                        ]}
                        onChange={(v) => updateLato(lato, { pronazione: v })}
                      />
                    </Field>
                    <Field label="Alluce">
                      <RadioToggle
                        value={l.alluce}
                        options={[
                          { key: "valgo", label: "Valgo" },
                          { key: "varo", label: "Varo" },
                        ]}
                        onChange={(v) => updateLato(lato, { alluce: v })}
                      />
                    </Field>
                    <Field label="Dita a griffe">
                      <MultiToggle value={l.ditaAGriffe} options={DITA_OPTIONS} onChange={(v) => updateLato(lato, { ditaAGriffe: v })} />
                    </Field>
                    <Field label="Tallone">
                      <CheckLine
                        checked={l.tallone.talalgie}
                        label="Talalgie"
                        onChange={(v) => updateLato(lato, { tallone: { ...l.tallone, talalgie: v } })}
                      />
                      <CheckLine
                        checked={l.tallone.spinaCalcaneare}
                        label="Spina calcaneare"
                        onChange={(v) => updateLato(lato, { tallone: { ...l.tallone, spinaCalcaneare: v } })}
                      />
                    </Field>
                    <Field label="Ginocchio">
                      <RadioToggle
                        value={l.ginocchio}
                        options={[
                          { key: "valgo", label: "Valgo" },
                          { key: "varo", label: "Varo" },
                        ]}
                        onChange={(v) => updateLato(lato, { ginocchio: v })}
                      />
                    </Field>
                    <CheckLine checked={l.tibiaVara} label="Tibia vara" onChange={(v) => updateLato(lato, { tibiaVara: v })} />
                    <Field label="Sovraccarico teste metatarsali">
                      <MultiToggle
                        value={l.sovraccaricoMetatarsali}
                        options={DITA_OPTIONS}
                        onChange={(v) => updateLato(lato, { sovraccaricoMetatarsali: v })}
                      />
                    </Field>
                    <Field label="Ulcerazioni">
                      <CheckLine
                        checked={l.ulcerazioni.dorsali}
                        label="Dorsali"
                        onChange={(v) => updateLato(lato, { ulcerazioni: { ...l.ulcerazioni, dorsali: v } })}
                      />
                      <CheckLine
                        checked={l.ulcerazioni.plantari}
                        label="Plantari"
                        onChange={(v) => updateLato(lato, { ulcerazioni: { ...l.ulcerazioni, plantari: v } })}
                      />
                      <CheckLine
                        checked={l.ulcerazioni.calcaneari}
                        label="Calcaneari"
                        onChange={(v) => updateLato(lato, { ulcerazioni: { ...l.ulcerazioni, calcaneari: v } })}
                      />
                    </Field>
                    <Field label="Traumi">
                      <input value={l.traumi ?? ""} onChange={(e) => updateLato(lato, { traumi: e.target.value || null })} />
                    </Field>
                  </div>
                );
              })}
            </div>

            <h3 className="fascicolo-lato-title" style={{ marginTop: 18 }}>
              Destinazione d&apos;uso del dispositivo
            </h3>
            <div className="form-grid">
              <Field label="Attività lavorativa">
                <input
                  value={c.esamePiede.destinazioneUso.attivitaLavorativa ?? ""}
                  onChange={(e) =>
                    updateContenuto("esamePiede", {
                      destinazioneUso: { ...c.esamePiede.destinazioneUso, attivitaLavorativa: e.target.value || null },
                    })
                  }
                />
              </Field>
              <Field label="Attività sportiva">
                <input
                  value={c.esamePiede.destinazioneUso.attivitaSportiva ?? ""}
                  onChange={(e) =>
                    updateContenuto("esamePiede", {
                      destinazioneUso: { ...c.esamePiede.destinazioneUso, attivitaSportiva: e.target.value || null },
                    })
                  }
                />
              </Field>
              <Field label="Attività tempo libero">
                <input
                  value={c.esamePiede.destinazioneUso.attivitaTempoLibero ?? ""}
                  onChange={(e) =>
                    updateContenuto("esamePiede", {
                      destinazioneUso: { ...c.esamePiede.destinazioneUso, attivitaTempoLibero: e.target.value || null },
                    })
                  }
                />
              </Field>
            </div>
            <Field label="Calzatura di collegamento">
              <CheckLine
                checked={c.esamePiede.calzaturaCollegamento.ciabattaPredisposta}
                label="Ciabatta predisposta"
                onChange={(v) =>
                  updateContenuto("esamePiede", { calzaturaCollegamento: { ...c.esamePiede.calzaturaCollegamento, ciabattaPredisposta: v } })
                }
              />
              <CheckLine
                checked={c.esamePiede.calzaturaCollegamento.scarpaPredisposta}
                label="Scarpa predisposta"
                onChange={(v) =>
                  updateContenuto("esamePiede", { calzaturaCollegamento: { ...c.esamePiede.calzaturaCollegamento, scarpaPredisposta: v } })
                }
              />
              <CheckLine
                checked={c.esamePiede.calzaturaCollegamento.antinfortunistica}
                label="Antinfortunistica"
                onChange={(v) =>
                  updateContenuto("esamePiede", { calzaturaCollegamento: { ...c.esamePiede.calzaturaCollegamento, antinfortunistica: v } })
                }
              />
              <CheckLine
                checked={c.esamePiede.calzaturaCollegamento.scarpaGinnastica}
                label="Scarpa da ginnastica"
                onChange={(v) =>
                  updateContenuto("esamePiede", { calzaturaCollegamento: { ...c.esamePiede.calzaturaCollegamento, scarpaGinnastica: v } })
                }
              />
            </Field>
          </>
        ) : null}

        {tab === "prescrizione" ? (
          <>
            <h2>Prescrizione</h2>
            <div className="form-grid">
              <Field label="Descrizione materiale" obbligatorio>
                <input
                  value={c.prescrizione.descrizioneMateriale}
                  onChange={(e) => updateContenuto("prescrizione", { descrizioneMateriale: e.target.value })}
                />
              </Field>
              <Field label="Quantità">
                <input value={c.prescrizione.quantita} onChange={(e) => updateContenuto("prescrizione", { quantita: e.target.value })} />
              </Field>
              <Field label="Importo (IVA inclusa)" obbligatorio>
                <div className="field-euro">
                  <span className="field-euro-sign">€</span>
                  <input
                    type="number"
                    step="0.01"
                    min={0}
                    value={c.prescrizione.importo ?? ""}
                    onChange={(e) => updateContenuto("prescrizione", { importo: e.target.value ? Number(e.target.value) : null })}
                  />
                </div>
              </Field>
              <Field label="Data ordine">
                <input
                  type="date"
                  value={c.prescrizione.dataOrdine ?? ""}
                  onChange={(e) => updateDataSincronizzata(e.target.value || null, "dataOrdine")}
                />
              </Field>
            </div>
            <CheckLine
              checked={c.prescrizione.dispositivoDetraibile}
              label="Dispositivo medico detraibile"
              onChange={(v) => updateContenuto("prescrizione", { dispositivoDetraibile: v })}
            />
            <CheckLine
              checked={c.prescrizione.richiestaMedica}
              label="Richiesta medica presentata"
              onChange={(v) => updateContenuto("prescrizione", { richiestaMedica: v })}
            />
            {c.prescrizione.richiestaMedica ? (
              <div className="form-grid">
                <Field label="Medico prescrittore">
                  <input
                    value={c.prescrizione.medicoPrescrittore ?? ""}
                    onChange={(e) => updateContenuto("prescrizione", { medicoPrescrittore: e.target.value || null })}
                  />
                </Field>
                <Field label="Data prescrizione">
                  <input
                    type="date"
                    value={c.prescrizione.dataPrescrizione ?? ""}
                    onChange={(e) => updateContenuto("prescrizione", { dataPrescrizione: e.target.value || null })}
                  />
                </Field>
              </div>
            ) : null}
            <CheckLine
              checked={c.prescrizione.documentazioneDiagnostica}
              label="Documentazione diagnostica presentata"
              onChange={(v) => updateContenuto("prescrizione", { documentazioneDiagnostica: v })}
            />
            <CheckLine
              checked={c.prescrizione.praticaAsl}
              label="Pratica autorizzata da ASL/SSN"
              onChange={(v) => updateContenuto("prescrizione", { praticaAsl: v })}
            />
            {c.prescrizione.praticaAsl ? (
              <Field label="Numero autorizzazione ASL">
                <input
                  value={c.prescrizione.autorizzazioneAslNumero ?? ""}
                  onChange={(e) => updateContenuto("prescrizione", { autorizzazioneAslNumero: e.target.value || null })}
                />
              </Field>
            ) : null}
            <Field label="Note">
              <textarea value={c.prescrizione.note ?? ""} onChange={(e) => updateContenuto("prescrizione", { note: e.target.value || null })} />
            </Field>

            <h3 className="fascicolo-lato-title" style={{ marginTop: 18 }}>
              Allegati ({allegati.length}/{MAX_ALLEGATI_PER_FASCICOLO})
            </h3>
            <p className="hint" style={{ marginBottom: 10 }}>
              Prescrizione medica, autorizzazione ASL o altra documentazione: immagini o PDF. Finiscono nella stampa
              interna completa del fascicolo, non negli altri tipi di stampa.
            </p>
            {allegatoError ? <div className="banner error">{allegatoError}</div> : null}
            {allegati.length > 0 ? (
              <div className="gallery-grid" style={{ marginBottom: 12 }}>
                {allegati.map((a) => (
                  <div key={a.id} className="gallery-item">
                    {a.formato === "immagine" ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={`/api/fascicoli/${fascicolo.numero}/allegati/${a.id}`}
                        alt={a.etichetta || a.nome || "Allegato"}
                        className="gallery-thumb"
                        loading="lazy"
                      />
                    ) : (
                      <a
                        href={a.driveUrl ?? "#"}
                        target="_blank"
                        rel="noreferrer"
                        className="gallery-thumb"
                        style={{ display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12 }}
                      >
                        Apri PDF ↗
                      </a>
                    )}
                    <div className="gallery-caption">{a.etichetta || a.nome || "—"}</div>
                    <button
                      className="btn danger"
                      type="button"
                      onClick={() => handleAllegatoRemove(a.id)}
                      disabled={uploadingAllegato}
                    >
                      Rimuovi
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="hint">Nessun allegato caricato.</p>
            )}
            {allegati.length < MAX_ALLEGATI_PER_FASCICOLO ? (
              <div className="card-actions">
                <input
                  value={allegatoEtichetta}
                  onChange={(e) => setAllegatoEtichetta(e.target.value)}
                  placeholder="Etichetta (facoltativa): es. Prescrizione medica, Autorizzazione ASL…"
                  style={{ maxWidth: 320 }}
                />
                <label className="btn">
                  {uploadingAllegato ? "Caricamento…" : "Aggiungi allegato"}
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    onChange={handleAllegatoUpload}
                    disabled={uploadingAllegato}
                    style={{ display: "none" }}
                  />
                </label>
              </div>
            ) : (
              <p className="hint">
                Limite di {MAX_ALLEGATI_PER_FASCICOLO} allegati raggiunto: rimuovine uno per aggiungerne altri.
              </p>
            )}
          </>
        ) : null}

        {tab === "produzione" ? (
          <>
            <h2>Produzione</h2>
            <div className="form-grid">
              <Field label="Matricola">
                <input value={c.produzione.matricola ?? ""} onChange={(e) => updateContenuto("produzione", { matricola: e.target.value || null })} />
              </Field>
              <Field label="Codice">
                <input value={c.produzione.codice ?? ""} onChange={(e) => updateContenuto("produzione", { codice: e.target.value || null })} />
              </Field>
              <Field label="Responsabile di progetto">
                <input
                  value={c.produzione.responsabileProgetto ?? ""}
                  onChange={(e) => updateContenuto("produzione", { responsabileProgetto: e.target.value || null })}
                />
              </Field>
              <Field label="Data inizio lavori">
                <input
                  type="date"
                  value={c.produzione.dataInizioLavori ?? ""}
                  onChange={(e) => updateDataSincronizzata(e.target.value || null, "dataInizioLavori")}
                />
              </Field>
              <Field label="Data pronta consegna">
                <input
                  type="date"
                  value={c.produzione.dataProntaConsegna ?? ""}
                  onChange={(e) => updateContenuto("produzione", { dataProntaConsegna: e.target.value || null })}
                />
              </Field>
            </div>
            <Field label="Note per riesame">
              <textarea value={c.produzione.noteRiesame ?? ""} onChange={(e) => updateContenuto("produzione", { noteRiesame: e.target.value || null })} />
            </Field>

            <h3 className="fascicolo-lato-title" style={{ marginTop: 16 }}>
              Fasi di lavorazione
            </h3>
            {c.produzione.fasi.map((fase, i) => (
              <div key={fase.numero} className="fascicolo-fase-row">
                <input
                  type="checkbox"
                  checked={fase.completata}
                  onChange={(e) => {
                    const fasi = [...c.produzione.fasi];
                    fasi[i] = { ...fase, completata: e.target.checked };
                    updateContenuto("produzione", { fasi });
                  }}
                />
                <div>
                  <strong>
                    {fase.numero}. {fase.nome}
                  </strong>
                  <div className="meta">{fase.controlli}</div>
                </div>
                <input
                  type="date"
                  value={fase.data ?? ""}
                  onChange={(e) => {
                    const fasi = [...c.produzione.fasi];
                    fasi[i] = { ...fase, data: e.target.value || null };
                    updateContenuto("produzione", { fasi });
                  }}
                />
                <input
                  placeholder="Operatore"
                  value={fase.operatore ?? ""}
                  onChange={(e) => {
                    const fasi = [...c.produzione.fasi];
                    fasi[i] = { ...fase, operatore: e.target.value || null };
                    updateContenuto("produzione", { fasi });
                  }}
                />
              </div>
            ))}

            <Field label="Controllo finale">
              <RadioToggle
                value={c.produzione.controlloFinale}
                options={[
                  { key: "conforme", label: "Conforme" },
                  { key: "non_conforme", label: "Non conforme" },
                ]}
                onChange={(v) => updateContenuto("produzione", { controlloFinale: v })}
              />
            </Field>
            {c.produzione.controlloFinale === "non_conforme" ? (
              <Field label="Numero non conformità">
                <input
                  value={c.produzione.nonConformitaNumero ?? ""}
                  onChange={(e) => updateContenuto("produzione", { nonConformitaNumero: e.target.value || null })}
                />
              </Field>
            ) : null}

            <h3 className="fascicolo-lato-title" style={{ marginTop: 16 }}>
              Allegato A · Flussogramma di progettazione
            </h3>
            <CheckLine
              checked={c.produzione.includiAllegatoA}
              label="Includi l'Allegato A come ultima pagina del fascicolo"
              onChange={(v) => updateContenuto("produzione", { includiAllegatoA: v })}
            />
            <div className="card-actions">
              <a className="btn" href={`/api/fascicoli/${fascicolo.numero}/processo-produttivo`} target="_blank" rel="noreferrer">
                <span className="btn-icon"><IconStampa /></span> Stampa Allegato A a parte
              </a>
            </div>
            <p className="hint">
              Procedura aziendale fissa (uguale per ogni commessa): puoi allegarla al fascicolo con la casella qui
              sopra, oppure stamparla da sola senza toccare il fascicolo.
            </p>
          </>
        ) : null}

        {tab === "consegna" ? (
          <>
            <h2>Consegna</h2>
            <div className="form-grid">
              <Field label="Data 1° appuntamento">
                <input
                  type="date"
                  value={c.consegna.dataPrimoAppuntamento ?? ""}
                  onChange={(e) => updateDataSincronizzata(e.target.value || null, "dataPrimoAppuntamento")}
                />
              </Field>
              <Field label="Data prova/consegna prevista">
                <input
                  type="date"
                  value={c.consegna.dataConsegnaPrevista ?? ""}
                  onChange={(e) => updateContenuto("consegna", { dataConsegnaPrevista: e.target.value || null })}
                />
              </Field>
              <Field label="Luogo">
                <input
                  value={c.consegna.luogoConsegna ?? ""}
                  onChange={(e) => updateContenuto("consegna", { luogoConsegna: e.target.value || null })}
                  placeholder="Es. presso il negozio"
                />
              </Field>
              <Field label="Ora">
                <input
                  type="time"
                  value={c.consegna.oraConsegna ?? ""}
                  onChange={(e) => updateContenuto("consegna", { oraConsegna: e.target.value || null })}
                />
              </Field>
              <Field label="Data consegna effettiva">
                <input
                  type="date"
                  value={c.consegna.dataConsegnaEffettiva ?? ""}
                  onChange={(e) => updateContenuto("consegna", { dataConsegnaEffettiva: e.target.value || null })}
                />
              </Field>
              <Field label="Data follow-up (controllo a 2 mesi)">
                <input
                  type="date"
                  value={c.consegna.dataFollowUp ?? ""}
                  onChange={(e) => updateContenuto("consegna", { dataFollowUp: e.target.value || null })}
                />
              </Field>
            </div>

            {c.prescrizione.praticaAsl ? (
              <>
                <h3 className="fascicolo-lato-title" style={{ marginTop: 16 }}>
                  Comunicazione avvenuta consegna (pratica ASL/SSN)
                </h3>
                <div className="form-grid">
                  <Field label="Destinatario (Spett.le)">
                    <input
                      value={c.consegna.comunicazioneAslDestinatario ?? ""}
                      onChange={(e) => updateContenuto("consegna", { comunicazioneAslDestinatario: e.target.value || null })}
                    />
                  </Field>
                  <Field label="Numero pratica">
                    <input
                      value={c.consegna.comunicazioneAslPraticaNumero ?? ""}
                      onChange={(e) => updateContenuto("consegna", { comunicazioneAslPraticaNumero: e.target.value || null })}
                    />
                  </Field>
                </div>
              </>
            ) : null}

            <p className="hint" style={{ marginTop: 12 }}>
              Le note informative, le istruzioni per l&apos;uso e la garanzia sono un testo standard, uguale per ogni
              fascicolo: compaiono automaticamente nel PDF, non c&apos;è nulla da scrivere qui.
            </p>
          </>
        ) : null}

        {tab === "controlli" ? (
          <>
            <h2>Visite di controllo</h2>
            <p className="hint">
              Una riga per ogni visita successiva alla consegna (1ª, 2ª, 3ª…): aggiungine quante servono davvero, non
              c&apos;è un numero previsto in partenza.
            </p>
            {c.consegna.visiteControllo.length === 0 ? (
              <p className="empty">
                <b>Nessuna visita registrata</b>
                Aggiungi la prima visita di controllo con il pulsante qui sotto.
              </p>
            ) : (
              [...c.consegna.visiteControllo]
                .sort((a, b) => a.numero - b.numero)
                .map((v) => (
                  <div key={v.numero} className="fascicolo-visita-row">
                    <strong>{v.numero}ª</strong>
                    <input type="date" value={v.data ?? ""} onChange={(e) => updateVisita(v.numero, { data: e.target.value || null })} />
                    <input
                      placeholder="Nota del tecnico"
                      value={v.nota ?? ""}
                      onChange={(e) => updateVisita(v.numero, { nota: e.target.value || null })}
                    />
                    <button type="button" className="btn-link" onClick={() => removeVisita(v.numero)}>
                      Rimuovi
                    </button>
                  </div>
                ))
            )}
            <div className="card-actions" style={{ marginTop: 14 }}>
              <button type="button" className="btn" onClick={addVisita}>
                + Aggiungi visita
              </button>
              {c.consegna.visiteControllo.length > 0 ? (
                <a
                  className="btn"
                  href={`/api/fascicoli/${fascicolo.numero}/visite-controllo`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <span className="btn-icon">
                    <IconStampa />
                  </span>{" "}
                  Stampa visite di controllo
                </a>
              ) : null}
            </div>
          </>
        ) : null}

        {nextSezione ? (
          <div className="fascicolo-next-section">
            <button type="button" className="btn" onClick={() => setTab(nextSezione.key)}>
              Sezione successiva: {nextSezione.label} →
            </button>
          </div>
        ) : null}
      </div>

      {/* Ha senso solo dopo che il fascicolo è stato generato almeno una
          volta: "versione" cresce solo alla finalizzazione (documento/route
          con ?finalizza=1), mai col semplice "Salva" — prima di allora non
          c'è ancora nulla da ristampare. Raggiungibile scorrendo fino in
          fondo a qualunque sezione, non solo dalla savebar in cima: per
          riprendere in mano un fascicolo già completo (es. il cliente torna
          e chiede un'altra copia) senza dover risalire. Non finalizza a sua
          volta — stesso comportamento libero di "Anteprima / Stampa". */}
      {fascicolo.versione > 1 ? (
        <div className="card-actions" style={{ justifyContent: "flex-end", marginTop: 20 }}>
          <button type="button" className="btn" onClick={handleAnteprima} disabled={Boolean(azioneInCorso)}>
            <span className="btn-icon"><IconStampa /></span> Ristampa PDF
          </button>
        </div>
      ) : null}

      {/* Isolata dal resto, stesso pattern di DeviceDetailModal: un click qui
          non si annulla, resta a un dito di distanza dalle azioni normali. */}
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
            Elimina fascicolo
          </button>
        ) : (
          <div className="delete-confirm">
            <p className="hint" style={{ margin: "0 0 8px" }}>
              Azione irreversibile. Per confermare, scrivi il numero <b>{fascicolo.numero}</b> qui sotto.
            </p>
            <div className="card-actions">
              <input
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder={fascicolo.numero}
                autoFocus
                style={{ maxWidth: 200 }}
              />
              <button className="btn" type="button" onClick={() => setConfirmingDelete(false)} disabled={deleting}>
                Annulla
              </button>
              <button
                className="btn danger"
                type="button"
                onClick={handleDelete}
                disabled={deleting || deleteConfirmText.trim() !== fascicolo.numero}
              >
                {deleting ? "Eliminazione…" : "Conferma eliminazione definitiva"}
              </button>
            </div>
          </div>
        )}
      </div>

      <Toast message={toast} />
    </div>
  );
}
