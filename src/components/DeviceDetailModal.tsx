"use client";

import { networkErrorMessage, readJson } from "@/lib/fetch-json";
import { addDaysIso, todayIso } from "@/lib/dates";
import { useEffect, useRef, useState } from "react";
import {
  ARCHIVE_LABEL,
  STATUS_LABEL,
  STATUS_OPTIONS,
  type Device,
  type DeviceStatus,
} from "@/lib/device-types";
import { DocumentPanel } from "./DocumentPanel";
import type { DocumentoTipo } from "@/lib/pdf/VerbaleDocument";
import type { DevicePhotoMeta } from "@/lib/photos";
import { calcolaTotale, findTariffa, fmtEuro, giorniTra, type Tariffa } from "@/lib/tariffe-types";
import { Toast } from "./Toast";

// Deve combaciare con MAX_PHOTOS_PER_DEVICE in src/lib/photos.ts (server-only,
// non importabile qui): solo per mostrare il conteggio, il limite reale è
// comunque imposto dal server.
const MAX_GALLERY_PHOTOS = 8;

interface HistoryEvent {
  data: string;
  codice: string;
  evento: "noleggio" | "restituzione" | "sanificazione";
  cliente: string | null;
  telefono: string | null;
  contratto: string | null;
  nota: string | null;
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

type ModalTab = "dati" | "galleria" | "storico";

const MODAL_TABS: { key: ModalTab; label: string }[] = [
  { key: "dati", label: "Dati" },
  { key: "galleria", label: "Galleria foto" },
  { key: "storico", label: "Storico" },
];

interface DeviceDetailModalProps {
  device: Device;
  isNew: boolean;
  autoRent?: boolean;
  categories: string[];
  sottocategorie: string[];
  marche: string[];
  tariffe: Tariffa[];
  existingCodici: string[];
  onClose: () => void;
  onSaved: (devices: Device[]) => void;
  onDeleted: (devices: Device[]) => void;
  onDuplicate: (seed: Device) => void;
}

// Vista unica per un dispositivo: informazioni, modifica, cambio stato,
// noleggio, storico e azioni (documento/duplica/elimina) in un solo posto,
// aperta con un click sulla riga della tabella in AdminDevicesClient.
//
// Su schermi larghi (!isNew) la scheda si divide in una sidebar fissa
// (codice/modello, pillola di stato, pulsante di ciclo vita, Genera
// documento, Duplica) e un'area principale con i tab; su schermi stretti
// torna una singola colonna (vedi .detail-layout in globals.css). Per un
// nuovo dispositivo (isNew) niente sidebar: non c'è ancora nulla da
// riepilogare.
export function DeviceDetailModal({
  device,
  isNew,
  autoRent,
  categories,
  sottocategorie,
  marche,
  tariffe,
  existingCodici,
  onClose,
  onSaved,
  onDeleted,
  onDuplicate,
}: DeviceDetailModalProps) {
  const [form, setForm] = useState<Device>(device);
  // Stato realmente persistito (non l'eventuale bozza non salvata in `form`):
  // pillola e pulsanti di ciclo vita si basano su questo, non su `form.stato`,
  // altrimenti cambiare la tendina "Stato" senza salvare farebbe comparire i
  // pulsanti sbagliati e attiverebbe noleggi/restituzioni su dati non reali.
  const [current, setCurrent] = useState<Device>(device);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [renting, setRenting] = useState(Boolean(autoRent));
  const [rentCliente, setRentCliente] = useState("");
  const [rentTelefono, setRentTelefono] = useState("");
  const [rentDal, setRentDal] = useState(todayIso());
  const [rentAlPrevisto, setRentAlPrevisto] = useState(addDaysIso(todayIso(), 30));
  // Prefillato dal tariffario, ma modificabile per questo singolo noleggio
  // (es. uno sconto concordato): vedi anche QuickRentModal, stessa idea.
  const [rentPrezzo, setRentPrezzo] = useState(() => {
    const t = findTariffa(tariffe, current.categoria, current.sottocategoria);
    return t ? String(t.importo).replace(".", ",") : "";
  });
  const [showDoc, setShowDoc] = useState(false);
  const [docForcedTipo, setDocForcedTipo] = useState<DocumentoTipo | undefined>(undefined);
  const [docDevice, setDocDevice] = useState<Device>(device);
  const [events, setEvents] = useState<HistoryEvent[] | null>(isNew ? [] : null);
  const [gallery, setGallery] = useState<DevicePhotoMeta[]>([]);
  const [galleryTipo, setGalleryTipo] = useState("");
  const [uploadingGallery, setUploadingGallery] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [tab, setTab] = useState<ModalTab>("dati");
  // Doppia conferma per "Elimina dispositivo": un solo click (con o senza
  // finestra nativa) è troppo facile da premere per sbaglio su un'azione
  // irreversibile. Il secondo passo è digitare il codice esatto, non un
  // semplice "OK" su cui si clicca per abitudine.
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [alPrevistoDraft, setAlPrevistoDraft] = useState(device.alPrevisto ?? "");
  const [savingAlPrevisto, setSavingAlPrevisto] = useState(false);
  // Sincronizzato con `current` (non con `form`, che può contenere una bozza
  // non salvata): dopo un noleggio/restituzione o un aggiornamento riuscito
  // qui sotto, il campo deve rispecchiare il dato realmente persistito.
  // Aggiustato durante il render (non in un effect) seguendo il pattern
  // ufficiale React per "adjusting state when a prop changes".
  const [alPrevistoSyncedWith, setAlPrevistoSyncedWith] = useState(current.alPrevisto);
  if (alPrevistoSyncedWith !== current.alPrevisto) {
    setAlPrevistoSyncedWith(current.alPrevisto);
    setAlPrevistoDraft(current.alPrevisto ?? "");
  }

  function showToast(message: string) {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2400);
  }

  function loadHistory() {
    if (isNew) return;
    let cancelled = false;
    fetch(`/api/dispositivi/${encodeURIComponent(device.codice)}/eventi`)
      .then(async (res) => {
        const body = await readJson(res);
        if (!res.ok) throw new Error(body.error || "Impossibile leggere lo storico");
        if (!cancelled) setEvents(body.events);
      })
      .catch(() => {
        if (!cancelled) setEvents([]);
      });
    return () => {
      cancelled = true;
    };
  }

  function loadGallery() {
    if (isNew) return;
    let cancelled = false;
    fetch(`/api/dispositivi/${encodeURIComponent(device.codice)}/galleria`)
      .then(async (res) => {
        const body = await readJson(res);
        if (!res.ok) throw new Error(body.error || "Impossibile leggere la galleria");
        if (!cancelled) setGallery(body.photos);
      })
      .catch(() => {
        if (!cancelled) setGallery([]);
      });
    return () => {
      cancelled = true;
    };
  }

  // Il componente è montato con una `key` diversa ogni volta che si apre un
  // dispositivo diverso (o si passa a "Duplica"): niente da sincronizzare
  // qui, lo stato iniziale sopra riflette già il device corretto.
  useEffect(() => {
    const cancelHistory = loadHistory();
    const cancelGallery = loadGallery();
    return () => {
      cancelHistory?.();
      cancelGallery?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [device.codice, isNew]);

  /**
   * Applica il risultato di un'operazione server-side. `fields`, se passato,
   * limita quali campi del form vengono sovrascritti (es. solo "stato" e i
   * dati del cliente per un noleggio): senza, un'azione come il caricamento
   * foto rischierebbe di far perdere una nota o una modifica non ancora
   * salvata nel resto del form.
   */
  function applyUpdate(devices: Device[], fields?: (keyof Device)[]) {
    onSaved(devices);
    const updated = devices.find((d) => d.codice === current.codice);
    if (!updated) return;
    setCurrent(updated);
    if (fields) {
      const patch = Object.fromEntries(fields.map((key) => [key, updated[key]])) as Partial<Device>;
      setForm((f) => ({ ...f, ...patch }));
    } else {
      setForm(updated);
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    const codice = form.codice.trim();
    if (!codice) {
      setError("Il codice è obbligatorio");
      return;
    }
    if (isNew && existingCodici.some((c) => c.toLowerCase() === codice.toLowerCase())) {
      setError(`Esiste già un dispositivo con codice "${codice}".`);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/dispositivi", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, codice }),
      });
      const body = await readJson(res);
      if (!res.ok) throw new Error(body.error || "Salvataggio non riuscito");
      onSaved(body.devices);
      const saved = body.devices.find((d: Device) => d.codice === codice);
      if (saved) setCurrent(saved);
      showToast(isNew ? "Dispositivo aggiunto" : "Modifiche salvate");
      // Chiude con un piccolo ritardo (invece che subito) per lasciare
      // visibile la conferma: il Toast vive dentro questo stesso componente,
      // quindi un onClose immediato lo smonterebbe prima che compaia.
      if (isNew) setTimeout(onClose, 900);
    } catch (err) {
      setError(networkErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/dispositivi?codice=${encodeURIComponent(form.codice)}`, {
        method: "DELETE",
      });
      const body = await readJson(res);
      if (!res.ok) throw new Error(body.error || "Eliminazione non riuscita");
      onDeleted(body.devices);
    } catch (err) {
      setError(networkErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  const tariffa = findTariffa(tariffe, current.categoria, current.sottocategoria);
  const rentPrezzoNum = Number(rentPrezzo.replace(",", "."));
  const rentTotaleStimato =
    tariffa && rentAlPrevisto && rentPrezzoNum > 0
      ? calcolaTotale(rentPrezzoNum, tariffa.unita, giorniTra(rentDal, rentAlPrevisto))
      : null;

  function resetRentForm() {
    setRentCliente("");
    setRentTelefono("");
    setRentDal(todayIso());
    setRentAlPrevisto(addDaysIso(todayIso(), 30));
    setRentPrezzo(tariffa ? String(tariffa.importo).replace(".", ",") : "");
  }

  function openRent() {
    resetRentForm();
    setRenting(true);
  }

  async function handleConfirmRent(e: React.FormEvent) {
    e.preventDefault();
    if (!rentCliente.trim()) {
      setError("Il nome del cliente è obbligatorio");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/dispositivi/${encodeURIComponent(current.codice)}/eventi`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tipo: "noleggio",
          cliente: rentCliente,
          telefono: rentTelefono,
          dal: rentDal,
          alPrevisto: rentAlPrevisto || null,
          tariffaApplicata: tariffa && rentPrezzoNum > 0 ? rentPrezzoNum : null,
          tariffaUnita: tariffa && rentPrezzoNum > 0 ? tariffa.unita : null,
        }),
      });
      const body = await readJson(res);
      if (!res.ok) throw new Error(body.error || "Operazione non riuscita");
      applyUpdate(body.devices, ["stato", "cliente", "telefono", "contratto", "dal", "alPrevisto"]);
      loadHistory();
      setRenting(false);
      resetRentForm();
      showToast("Noleggio confermato");
      setDocDevice(body.devices.find((d: Device) => d.codice === current.codice) ?? form);
      setDocForcedTipo("consegna");
      setShowDoc(true);
    } catch (err) {
      setError(networkErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleLifecycle(tipo: "restituzione" | "sanificazione") {
    if (tipo === "restituzione" && !confirm(`Segnare ${current.codice} come restituito?`)) return;
    // Il ritorno svuota cliente/telefono/contratto sul dispositivo: per il
    // verbale di restituzione servono i dati di PRIMA della restituzione.
    const preReturnDevice = current;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/dispositivi/${encodeURIComponent(current.codice)}/eventi`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tipo }),
      });
      const body = await readJson(res);
      if (!res.ok) throw new Error(body.error || "Operazione non riuscita");
      applyUpdate(
        body.devices,
        tipo === "restituzione"
          ? ["stato", "cliente", "telefono", "contratto", "dal", "alPrevisto"]
          : ["stato", "sanificazione"]
      );
      loadHistory();
      showToast(tipo === "restituzione" ? "Segnato come restituito" : "Segnato come sanificato");
      if (tipo === "restituzione") {
        setDocDevice(preReturnDevice);
        setDocForcedTipo("restituzione");
        setShowDoc(true);
      }
    } catch (err) {
      setError(networkErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleArchive(tipo: "venduto" | "rottamato") {
    if (!confirm(`Segnare ${current.codice} come ${tipo}? Resterà in archivio, con tutto lo storico, ma sparirà dalle viste normali.`))
      return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/dispositivi/${encodeURIComponent(current.codice)}/archivio`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tipo }),
      });
      const body = await readJson(res);
      if (!res.ok) throw new Error(body.error || "Operazione non riuscita");
      applyUpdate(body.devices, ["archiviato", "nota"]);
      showToast(tipo === "venduto" ? "Segnato come venduto" : "Segnato come rottamato");
    } catch (err) {
      setError(networkErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleUnarchive() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/dispositivi/${encodeURIComponent(current.codice)}/archivio`, {
        method: "DELETE",
      });
      const body = await readJson(res);
      if (!res.ok) throw new Error(body.error || "Operazione non riuscita");
      applyUpdate(body.devices, ["archiviato"]);
      showToast("Dispositivo ripristinato in magazzino");
    } catch (err) {
      setError(networkErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  /**
   * A differenza di cliente/telefono/contratto/dal, la data di rientro
   * prevista non segue il ciclo di vita: può cambiare più volte durante lo
   * stesso noleggio (es. dopo una visita di controllo che allunga la
   * prescrizione), quindi è modificabile qui senza passare da
   * restituzione+nuovo noleggio. Parte da `current` (non da `form`, che può
   * contenere una bozza non salvata) per non rischiare di sovrascrivere gli
   * altri dati del noleggio con valori non salvati.
   */
  async function handleUpdateAlPrevisto(value: string) {
    setSavingAlPrevisto(true);
    setError(null);
    try {
      const res = await fetch("/api/dispositivi", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...current, alPrevisto: value || null }),
      });
      const body = await readJson(res);
      if (!res.ok) throw new Error(body.error || "Aggiornamento non riuscito");
      applyUpdate(body.devices, ["alPrevisto"]);
      showToast("Data di rientro aggiornata");
    } catch (err) {
      setError(networkErrorMessage(err));
    } finally {
      setSavingAlPrevisto(false);
    }
  }

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploadingPhoto(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`/api/dispositivi/${encodeURIComponent(form.codice)}/foto`, {
        method: "POST",
        body: fd,
      });
      const body = await readJson(res);
      if (!res.ok) throw new Error(body.error || "Caricamento foto non riuscito");
      applyUpdate(body.devices, ["foto"]);
    } catch (err) {
      setError(networkErrorMessage(err));
    } finally {
      setUploadingPhoto(false);
    }
  }

  async function handlePhotoRemove() {
    setUploadingPhoto(true);
    setError(null);
    try {
      const res = await fetch(`/api/dispositivi/${encodeURIComponent(form.codice)}/foto`, {
        method: "DELETE",
      });
      const body = await readJson(res);
      if (!res.ok) throw new Error(body.error || "Rimozione foto non riuscita");
      applyUpdate(body.devices, ["foto"]);
    } catch (err) {
      setError(networkErrorMessage(err));
    } finally {
      setUploadingPhoto(false);
    }
  }

  async function handleGalleryUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploadingGallery(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("tipo", galleryTipo);
      const res = await fetch(`/api/dispositivi/${encodeURIComponent(current.codice)}/galleria`, {
        method: "POST",
        body: fd,
      });
      const body = await readJson(res);
      if (!res.ok) throw new Error(body.error || "Caricamento foto non riuscito");
      setGallery(body.photos);
      setGalleryTipo("");
    } catch (err) {
      setError(networkErrorMessage(err));
    } finally {
      setUploadingGallery(false);
    }
  }

  async function handleGalleryRemove(id: string) {
    if (!confirm("Rimuovere questa foto dalla galleria?")) return;
    setUploadingGallery(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/dispositivi/${encodeURIComponent(current.codice)}/galleria?id=${encodeURIComponent(id)}`,
        { method: "DELETE" }
      );
      const body = await readJson(res);
      if (!res.ok) throw new Error(body.error || "Rimozione foto non riuscita");
      setGallery(body.photos);
    } catch (err) {
      setError(networkErrorMessage(err));
    } finally {
      setUploadingGallery(false);
    }
  }

  // Pulsante di ciclo vita (Noleggia / Segna restituito / Segna sanificato):
  // un solo punto nel markup, riusato sia nella sidebar (schermi larghi) sia
  // in cima alla scheda (schermi stretti, dove non c'è sidebar) — non più
  // duplicato in due posti diversi della stessa scheda.
  const lifecycleButton = current.archiviato ? null : (
    current.stato === "disponibile" && !renting ? (
      <button className="btn primary" type="button" onClick={openRent}>
        Noleggia
      </button>
    ) : current.stato === "noleggiato" ? (
      <button className="btn primary" type="button" onClick={() => handleLifecycle("restituzione")} disabled={saving}>
        Segna restituito
      </button>
    ) : current.stato === "da_pulire" ? (
      <button className="btn primary" type="button" onClick={() => handleLifecycle("sanificazione")} disabled={saving}>
        Segna sanificato
      </button>
    ) : null
  );

  const sidebar = !isNew ? (
    <div className="detail-sidebar">
      <span className="code">{form.codice}</span>
      <span className="model">
        {form.marca} {form.modello}
      </span>
      <div style={{ margin: "8px 0 12px" }}>
        {current.archiviato ? (
          <span className="pill archiviato" style={{ marginLeft: 0 }}>
            {ARCHIVE_LABEL[current.archiviato]}
          </span>
        ) : (
          <span className={`pill ${current.stato}`} style={{ marginLeft: 0 }}>
            {STATUS_LABEL[current.stato]}
          </span>
        )}
      </div>
      <div className="card-actions">
        {lifecycleButton}
        <button
          className="btn"
          type="button"
          onClick={() => {
            setDocDevice(form);
            setDocForcedTipo(undefined);
            setShowDoc(true);
          }}
        >
          Genera documento
        </button>
        <button className="btn" type="button" onClick={() => onDuplicate(form)}>
          Duplica
        </button>
      </div>
    </div>
  ) : null;

  const mainContent = (
    <div className="detail-main">
      {renting ? (
        <form className="panel" onSubmit={handleConfirmRent} style={{ margin: "0 0 16px" }}>
          <h2>Assegna a un cliente</h2>
          {tariffa ? (
            <div className="field-row" style={{ alignItems: "flex-end" }}>
              <div className="field">
                <label>Tariffa applicata (€ {tariffa.unita === "settimana" ? "a settimana" : "al giorno"})</label>
                <input value={rentPrezzo} onChange={(e) => setRentPrezzo(e.target.value)} inputMode="decimal" />
              </div>
              <p className="hint" style={{ margin: "0 0 10px" }}>
                {tariffa.nota ? tariffa.nota : "Modificabile solo per questo noleggio"}
              </p>
            </div>
          ) : null}
          {rentTotaleStimato != null ? (
            <p className="hint" style={{ margin: "0 0 14px" }}>
              Totale stimato fino al rientro previsto: <b>{fmtEuro(rentTotaleStimato)}</b>
            </p>
          ) : null}
          <div className="field">
            <label>Cliente</label>
            <input
              value={rentCliente}
              onChange={(e) => setRentCliente(e.target.value)}
              placeholder="Nome e cognome"
              autoFocus
            />
          </div>
          <div className="field">
            <label>Telefono</label>
            <input value={rentTelefono} onChange={(e) => setRentTelefono(e.target.value)} />
          </div>
          <p className="hint" style={{ margin: "0 0 12px" }}>
            Il numero di noleggio viene assegnato automaticamente alla conferma.
          </p>
          <div className="field-row">
            <div className="field">
              <label>Dal</label>
              <input type="date" value={rentDal} onChange={(e) => setRentDal(e.target.value)} />
            </div>
            <div className="field">
              <label>Rientro previsto (facoltativo)</label>
              <input
                type="date"
                value={rentAlPrevisto}
                onChange={(e) => setRentAlPrevisto(e.target.value)}
              />
            </div>
          </div>
          <div className="chips" style={{ marginBottom: 14 }}>
            {[15, 30, 60, 90].map((days) => (
              <button
                key={days}
                type="button"
                className="chip"
                onClick={() => setRentAlPrevisto(addDaysIso(rentDal, days))}
              >
                +{days} giorni
              </button>
            ))}
            <button type="button" className="chip" onClick={() => setRentAlPrevisto("")}>
              Nessuna scadenza
            </button>
          </div>
          <div className="card-actions">
            <button
              className="btn"
              type="button"
              onClick={() => {
                setRenting(false);
                resetRentForm();
              }}
            >
              Annulla
            </button>
            <button className="btn primary" type="submit" disabled={saving}>
              {saving ? "Salvataggio…" : "Conferma noleggio"}
            </button>
          </div>
        </form>
      ) : null}

      {!isNew ? (
        <div className="chips" style={{ marginBottom: 16 }}>
          {MODAL_TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              className={`chip ${tab === t.key ? "active" : ""}`}
              onClick={() => setTab(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>
      ) : null}

      {isNew || tab === "dati" ? (
      <form onSubmit={handleSave}>
        <div className="field-row">
          <div className="field">
            <label>Codice</label>
            <input
              value={form.codice}
              disabled={!isNew}
              onChange={(e) => setForm({ ...form, codice: e.target.value })}
              required
            />
          </div>
          <div className="field">
            <label>Categoria</label>
            <select
              value={form.categoria}
              onChange={(e) => setForm({ ...form, categoria: e.target.value })}
              required
            >
              <option value="" disabled>
                — seleziona —
              </option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="field-row">
          <div className="field">
            <label>Sottocategoria (facoltativa)</label>
            <input
              list="detail-sottocategorie-list"
              value={form.sottocategoria ?? ""}
              onChange={(e) => setForm({ ...form, sottocategoria: e.target.value || null })}
              placeholder="es. Autospinta, Transito, Bimbi…"
            />
            <datalist id="detail-sottocategorie-list">
              {sottocategorie.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </div>
          <div className="field">
            <label>Stato</label>
            {current.stato === "noleggiato" || current.stato === "da_pulire" ? (
              <>
                <select value={form.stato} disabled>
                  <option value={current.stato}>{STATUS_LABEL[current.stato]}</option>
                </select>
                <p className="hint" style={{ margin: "4px 0 0" }}>
                  Usa il pulsante nella scheda ({current.stato === "noleggiato" ? "Segna restituito" : "Segna sanificato"})
                  per cambiarlo: cambia anche i dati del cliente e lo storico.
                </p>
              </>
            ) : (
              <select
                value={form.stato}
                onChange={(e) => setForm({ ...form, stato: e.target.value as DeviceStatus })}
              >
                {/* "Noleggiato" e "Da pulire" si raggiungono solo con il
                    pulsante di ciclo vita nella scheda: portano con sé dati
                    del cliente e una riga di storico che questo form da
                    solo non scrive. */}
                {STATUS_OPTIONS.filter((o) => o.key !== "noleggiato" && o.key !== "da_pulire").map((o) => (
                  <option key={o.key} value={o.key}>
                    {o.label}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>
        <div className="field-row">
          <div className="field">
            <label>Marca</label>
            <input
              list="detail-marche-list"
              value={form.marca}
              onChange={(e) => setForm({ ...form, marca: e.target.value })}
            />
            <datalist id="detail-marche-list">
              {marche.map((m) => (
                <option key={m} value={m} />
              ))}
            </datalist>
          </div>
          <div className="field">
            <label>Modello</label>
            <input value={form.modello} onChange={(e) => setForm({ ...form, modello: e.target.value })} />
          </div>
        </div>
        <div className="field-row">
          <div className="field">
            <label>Larghezza seduta (cm, se applicabile)</label>
            <input
              type="number"
              value={form.larghezza ?? ""}
              onChange={(e) =>
                setForm({ ...form, larghezza: e.target.value ? Number(e.target.value) : null })
              }
            />
          </div>
          <div className="field">
            <label>Sanificazione (ultima)</label>
            <input
              type="date"
              value={form.sanificazione ?? ""}
              onChange={(e) => setForm({ ...form, sanificazione: e.target.value || null })}
            />
          </div>
        </div>
        <div className="field-row">
          <div className="field">
            <label>Data primo noleggio (ausilio nuovo)</label>
            <input
              type="date"
              value={form.dataPrimoNoleggio ?? ""}
              onChange={(e) => setForm({ ...form, dataPrimoNoleggio: e.target.value || null })}
            />
            <p className="hint" style={{ margin: "4px 0 0" }}>
              Quando l&apos;ausilio è stato noleggiato per la prima volta in assoluto. Diversa
              dalla data del noleggio in corso (quella si vede più sotto, tra i dati del cliente
              attuale, e si aggiorna a ogni nuovo noleggio).
            </p>
          </div>
        </div>
        <div className="field-row">
          <div className="field">
            <label>Prezzo di acquisto (€)</label>
            <input
              type="number"
              step="0.01"
              value={form.prezzoAcquisto ?? ""}
              onChange={(e) =>
                setForm({ ...form, prezzoAcquisto: e.target.value ? Number(e.target.value) : null })
              }
            />
          </div>
          <div className="field">
            <label>Prezzo di vendita stimato (€)</label>
            <input
              type="number"
              step="0.01"
              value={form.prezzoVendita ?? ""}
              onChange={(e) =>
                setForm({ ...form, prezzoVendita: e.target.value ? Number(e.target.value) : null })
              }
            />
          </div>
        </div>
        {current.stato === "noleggiato" ? (
          // Sola lettura di proposito: questi dati si scrivono con
          // "Noleggia"/"Segna restituito", che registrano anche lo
          // storico e l'anagrafica clienti. Modificarli qui li
          // cambierebbe sulla scheda senza lasciarne traccia da nessuna
          // parte, disallineando magazzino e storico. La data di rientro
          // prevista fa eccezione: vedi handleUpdateAlPrevisto.
          <div className="rental-readonly">
            <b>Noleggio in corso</b>
            <div>
              {form.cliente || "—"}
              {form.telefono ? ` · ${form.telefono}` : ""}
              {form.contratto ? ` · n. noleggio ${form.contratto}` : ""}
              {form.dal ? ` · dal ${fmtDate(form.dal)} (noleggio attuale)` : ""}
            </div>
            <p className="hint" style={{ margin: "6px 0 0" }}>
              Per correggere questi dati, usa &quot;Segna restituito&quot; e poi
              &quot;Noleggia&quot; di nuovo con i dati giusti.
            </p>
            <div className="field-row" style={{ marginTop: 10, alignItems: "flex-end" }}>
              <div className="field">
                <label>Rientro previsto</label>
                <input
                  type="date"
                  value={alPrevistoDraft}
                  onChange={(e) => setAlPrevistoDraft(e.target.value)}
                />
              </div>
              <div className="card-actions" style={{ marginTop: 0 }}>
                <button
                  className="btn"
                  type="button"
                  disabled={savingAlPrevisto || alPrevistoDraft === (current.alPrevisto ?? "")}
                  onClick={() => handleUpdateAlPrevisto(alPrevistoDraft)}
                >
                  {savingAlPrevisto ? "Salvataggio…" : "Aggiorna data"}
                </button>
                {current.alPrevisto ? (
                  <button
                    className="btn"
                    type="button"
                    disabled={savingAlPrevisto}
                    onClick={() => handleUpdateAlPrevisto("")}
                  >
                    Rimuovi scadenza
                  </button>
                ) : null}
              </div>
            </div>
            <p className="hint" style={{ margin: "6px 0 0" }}>
              A differenza degli altri dati, questa data si può correggere in qualsiasi
              momento (es. dopo una visita di controllo che allunga la prescrizione).
            </p>
          </div>
        ) : null}
        <div className="field">
          <label>Nota</label>
          <textarea
            rows={2}
            value={form.nota ?? ""}
            onChange={(e) => setForm({ ...form, nota: e.target.value || null })}
          />
        </div>

        <div className="field">
          <label>Foto</label>
          {!isNew ? (
            <div className="photo-field">
              {form.foto ? (
                <img className="photo-preview" src={form.foto} alt={`Foto ${form.codice}`} />
              ) : null}
              <div className="card-actions" style={{ marginTop: 0 }}>
                <label className="btn">
                  {uploadingPhoto ? "Caricamento…" : form.foto ? "Cambia foto" : "Carica foto"}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoUpload}
                    disabled={uploadingPhoto}
                    style={{ display: "none" }}
                  />
                </label>
                {form.foto ? (
                  <button
                    className="btn danger"
                    type="button"
                    onClick={handlePhotoRemove}
                    disabled={uploadingPhoto}
                  >
                    Rimuovi foto
                  </button>
                ) : null}
              </div>
            </div>
          ) : (
            <p className="hint">Salva il dispositivo per poter caricare una foto.</p>
          )}
        </div>

        <div className="card-actions">
          <button className="btn primary" type="submit" disabled={saving}>
            {saving ? "Salvataggio…" : isNew ? "Aggiungi dispositivo" : "Salva modifiche"}
          </button>
        </div>
      </form>
      ) : null}

      {!isNew && tab === "galleria" ? (
        <div className="detail-section">
          <h2>Galleria foto ({gallery.length}/{MAX_GALLERY_PHOTOS})</h2>
          <p className="hint" style={{ marginBottom: 10 }}>
            Foto aggiuntive oltre a quella principale (es. laterale, etichetta, un difetto
            da documentare). Ogni foto ha un&apos;etichetta libera facoltativa.
          </p>
          {gallery.length > 0 ? (
            <div className="gallery-grid">
              {gallery.map((p) => (
                <div key={p.id} className="gallery-item">
                  {/* L'elenco non porta più l'immagine (vedi photos.ts):
                      questa richiesta separata scarica solo questa foto,
                      non tutta la galleria di tutti i dispositivi. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`/api/dispositivi/${encodeURIComponent(current.codice)}/galleria/${p.id}`}
                    alt={p.tipo || "Foto"}
                    className="gallery-thumb"
                    loading="lazy"
                  />
                  <div className="gallery-caption">{p.tipo || "—"}</div>
                  <button
                    className="btn danger"
                    type="button"
                    onClick={() => handleGalleryRemove(p.id)}
                    disabled={uploadingGallery}
                  >
                    Rimuovi
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="hint">Nessuna foto aggiuntiva.</p>
          )}
          {gallery.length < MAX_GALLERY_PHOTOS ? (
            <div className="card-actions" style={{ marginTop: 12 }}>
              <input
                value={galleryTipo}
                onChange={(e) => setGalleryTipo(e.target.value)}
                placeholder="Etichetta (facoltativa): es. Laterale, Etichetta, Difetto…"
                style={{ maxWidth: 280 }}
              />
              <label className="btn">
                {uploadingGallery ? "Caricamento…" : "Aggiungi foto"}
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleGalleryUpload}
                  disabled={uploadingGallery}
                  style={{ display: "none" }}
                />
              </label>
            </div>
          ) : (
            <p className="hint">
              Limite di {MAX_GALLERY_PHOTOS} foto raggiunto: rimuovine una per aggiungerne altre.
            </p>
          )}
        </div>
      ) : null}

      {!isNew && tab === "storico" ? (
        <div className="detail-section">
          <h2>Storico</h2>
          {events === null ? <p className="hint">Caricamento…</p> : null}
          {events && events.length === 0 ? (
            <p className="hint">Nessun evento registrato per questo dispositivo.</p>
          ) : null}
          {events && events.length > 0 ? (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Data</th>
                    <th>Evento</th>
                    <th>Cliente</th>
                    <th>Telefono</th>
                    <th>N. Noleggio</th>
                  </tr>
                </thead>
                <tbody>
                  {events.map((e, i) => (
                    <tr key={i}>
                      <td>{fmtDate(e.data)}</td>
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
                      <td>{e.cliente ?? "—"}</td>
                      <td>{e.telefono ?? "—"}</td>
                      <td>{e.contratto ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      ) : null}

      {!isNew ? (
        <div className="archive-zone">
          {current.archiviato ? (
            <>
              <p className="hint" style={{ margin: "0 0 8px" }}>
                Dispositivo archiviato come <b>{ARCHIVE_LABEL[current.archiviato]}</b>: nascosto
                dalle viste normali, ma lo storico noleggi resta consultabile qui sopra.
              </p>
              <button className="btn" type="button" onClick={handleUnarchive} disabled={saving}>
                Ripristina in magazzino
              </button>
            </>
          ) : current.stato === "noleggiato" ? (
            <p className="hint" style={{ margin: 0 }}>
              Non puoi archiviare un dispositivo attualmente noleggiato: segna prima il rientro.
            </p>
          ) : (
            <>
              <p className="hint" style={{ margin: "0 0 8px" }}>
                Segna questo dispositivo come venduto o rottamato: esce dal magazzino attivo, ma
                resta consultabile con tutto il suo storico.
              </p>
              <div className="card-actions" style={{ marginTop: 0 }}>
                <button className="btn" type="button" onClick={() => handleArchive("venduto")} disabled={saving}>
                  Segna come venduto
                </button>
                <button className="btn" type="button" onClick={() => handleArchive("rottamato")} disabled={saving}>
                  Segna come rottamato
                </button>
              </div>
            </>
          )}
        </div>
      ) : null}

      {!isNew ? (
        // Isolata dalle azioni non distruttive (ora nella sidebar): un click
        // qui non si annulla, resta a un dito di distanza dal resto.
        <div className="danger-zone">
          {!confirmingDelete ? (
            <button
              className="btn danger"
              type="button"
              onClick={() => {
                setDeleteConfirmText("");
                setConfirmingDelete(true);
              }}
              disabled={saving}
            >
              Elimina dispositivo
            </button>
          ) : (
            <div className="delete-confirm">
              <p className="hint" style={{ margin: "0 0 8px" }}>
                Azione irreversibile. Per confermare, scrivi il codice{" "}
                <b>{form.codice}</b> qui sotto.
              </p>
              <div className="card-actions">
                <input
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  placeholder={form.codice}
                  autoFocus
                  style={{ maxWidth: 200 }}
                />
                <button
                  className="btn"
                  type="button"
                  onClick={() => setConfirmingDelete(false)}
                  disabled={saving}
                >
                  Annulla
                </button>
                <button
                  className="btn danger"
                  type="button"
                  onClick={handleDelete}
                  disabled={saving || deleteConfirmText.trim() !== form.codice}
                >
                  {saving ? "Eliminazione…" : "Conferma eliminazione definitiva"}
                </button>
              </div>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );

  return (
    <>
      <div className="modal-overlay" onClick={onClose}>
        <div className={`modal wide ${!isNew ? "has-sidebar" : ""}`} onClick={(e) => e.stopPropagation()}>
          <div className="modal-head">
            <h3>{isNew ? "Nuovo dispositivo" : `${form.codice} — ${form.marca} ${form.modello}`}</h3>
            <button className="modal-close" onClick={onClose} aria-label="Chiudi" type="button">
              ×
            </button>
          </div>

          {error ? <div className="banner error">{error}</div> : null}

          {isNew ? (
            mainContent
          ) : (
            <div className="detail-layout">
              {sidebar}
              {mainContent}
            </div>
          )}
        </div>
      </div>

      {showDoc ? (
        <DocumentPanel device={docDevice} forcedTipo={docForcedTipo} onClose={() => setShowDoc(false)} />
      ) : null}
      <Toast message={toast} />
    </>
  );
}
