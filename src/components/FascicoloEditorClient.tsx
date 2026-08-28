"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { ClientRecord } from "@/lib/clients";
import {
  calcolaCompletamento,
  FASCICOLO_STATO_LABEL,
  FASCICOLO_STATO_OPTIONS,
  SEZIONI_FASCICOLO,
  type EsamePiedeLato,
  type FascicoloContenuto,
  type FascicoloRecord,
  type FascicoloStato,
  type SezioneFascicolo,
} from "@/lib/fascicoli-types";
import { networkErrorMessage, readJson } from "@/lib/fetch-json";
import { Toast } from "./Toast";

interface FascicoloEditorClientProps {
  initialFascicolo: FascicoloRecord;
  initialCliente: ClientRecord;
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

export function FascicoloEditorClient({ initialFascicolo, initialCliente }: FascicoloEditorClientProps) {
  const router = useRouter();
  const [fascicolo, setFascicolo] = useState(initialFascicolo);
  const [cliente, setCliente] = useState(initialCliente);
  const [tab, setTab] = useState<SezioneFascicolo>("anagrafica");
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [dirty, setDirty] = useState(false);
  const [clienteDirty, setClienteDirty] = useState(false);
  const [clienteSaving, setClienteSaving] = useState(false);
  // Doppia conferma per l'eliminazione (stesso pattern di DeviceDetailModal):
  // azione irreversibile, un solo click è troppo facile da premere per sbaglio.
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fascicoloRef = useRef(fascicolo);

  useEffect(() => {
    fascicoloRef.current = fascicolo;
  }, [fascicolo]);

  function showToast(msg: string) {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2400);
  }

  const completamento = useMemo(() => calcolaCompletamento(fascicolo), [fascicolo]);

  const persist = useCallback(
    async (opts?: { incrementaVersione?: boolean; silent?: boolean }) => {
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
          }),
        });
        const body = await readJson(res);
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
    },
    []
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

  async function handleSalva() {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    await persist();
  }

  async function assicuraSalvato(): Promise<boolean> {
    if (!dirty) return true;
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    return persist({ silent: true });
  }

  async function handleAnteprima() {
    const ok = await assicuraSalvato();
    if (!ok) return;
    window.open(`/api/fascicoli/${fascicolo.numero}/documento?inline=1`, "_blank");
  }

  async function handleGenera() {
    const ok = await assicuraSalvato();
    if (!ok) return;
    window.open(`/api/fascicoli/${fascicolo.numero}/documento?finalizza=1&inline=1`, "_blank");
    showToast("PDF generato");
  }

  async function handleScarica() {
    const ok = await assicuraSalvato();
    if (!ok) return;
    window.open(`/api/fascicoli/${fascicolo.numero}/documento?finalizza=1`, "_blank");
    showToast("PDF generato");
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

  const c = fascicolo.contenuto;
  const saveLabel: Record<SaveState, { text: string; className: string }> = {
    idle: { text: "", className: "" },
    saving: { text: "⏳ Salvataggio…", className: "saving" },
    saved: { text: "🟢 Salvato", className: "saved" },
    error: { text: "🔴 Errore salvataggio", className: "error" },
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
            <span className={`fascicolo-savestate ${saveLabel[saveState].className}`}>{saveLabel[saveState].text}</span>
          ) : null}
        </div>
      </header>

      <div className="fascicolo-savebar">
        <div className="card-actions" style={{ margin: 0 }}>
          <button type="button" className="btn" onClick={handleSalva}>
            💾 Salva
          </button>
          <button type="button" className="btn" onClick={handleAnteprima}>
            👁️ Anteprima / Stampa
          </button>
          <button type="button" className="btn primary" onClick={handleGenera}>
            📄 Genera fascicolo
          </button>
          <button type="button" className="btn" onClick={handleScarica}>
            📥 Scarica PDF
          </button>
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
            <h2>{cliente.nome}</h2>
            <p className="hint">
              Questi dati sono quelli dell&apos;anagrafica clienti: modificarli qui li aggiorna ovunque, non solo su
              questo fascicolo.
            </p>
            <div className="form-grid">
              <Field label="Codice fiscale">
                <input
                  value={cliente.codiceFiscale ?? ""}
                  onChange={(e) => {
                    setCliente({ ...cliente, codiceFiscale: e.target.value.toUpperCase() || null });
                    setClienteDirty(true);
                  }}
                />
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
                <input value={fascicolo.commessa ?? ""} onChange={(e) => updateTop({ commessa: e.target.value || null })} />
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
              onChange={(v) =>
                updateContenuto("consensi", {
                  consensoTrattamentoDati: v,
                  dataConsenso: v && !c.consensi.dataConsenso ? new Date().toISOString().slice(0, 10) : c.consensi.dataConsenso,
                })
              }
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
                onChange={(e) => updateContenuto("consensi", { dataConsenso: e.target.value || null })}
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
                  value={c.anamnesi.altezzaCm ?? ""}
                  onChange={(e) => updateContenuto("anamnesi", { altezzaCm: e.target.value ? Number(e.target.value) : null })}
                />
              </Field>
              <Field label="Peso (kg)">
                <input
                  type="number"
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
                    value={c.prescrizione.importo ?? ""}
                    onChange={(e) => updateContenuto("prescrizione", { importo: e.target.value ? Number(e.target.value) : null })}
                  />
                </div>
              </Field>
              <Field label="Data ordine">
                <input
                  type="date"
                  value={c.prescrizione.dataOrdine ?? ""}
                  onChange={(e) => updateContenuto("prescrizione", { dataOrdine: e.target.value || null })}
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
                  onChange={(e) => updateContenuto("produzione", { dataInizioLavori: e.target.value || null })}
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
                🖨️ Stampa Allegato A a parte
              </a>
            </div>
            <p className="hint">
              Procedura aziendale fissa (uguale per ogni commessa): puoi allegarla al fascicolo con la casella qui
              sopra, oppure stamparla da sola senza toccare il fascicolo.
            </p>
          </>
        ) : null}

        {tab === "conformita" ? (
          <>
            <h2>Dichiarazione di conformità</h2>
            <p className="hint">
              Generata automaticamente da Medical Center in base ai dati di questo fascicolo (dispositivo, codice,
              matricola, responsabile di progetto): una sola volta nel PDF finale, come nel modello definitivo del
              fascicolo.
            </p>
            <div className="admin-table-wrap">
              <table className="admin-table">
                <tbody>
                  <tr>
                    <td>Nome dispositivo</td>
                    <td>{fascicolo.tipoDispositivo}</td>
                  </tr>
                  <tr>
                    <td>Codice</td>
                    <td>{c.produzione.codice || "—"}</td>
                  </tr>
                  <tr>
                    <td>Matricola</td>
                    <td>{c.produzione.matricola || "—"}</td>
                  </tr>
                  <tr>
                    <td>Commessa</td>
                    <td>{fascicolo.commessa || fascicolo.numero}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="hint" style={{ marginTop: 12 }}>
              Firma della direzione: predisposta per la firma digitale sullo schermo in una fase futura — per ora il
              PDF esce con la riga vuota, da firmare a penna dopo la stampa.
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
                  onChange={(e) => updateContenuto("consegna", { dataPrimoAppuntamento: e.target.value || null })}
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
      </div>

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
