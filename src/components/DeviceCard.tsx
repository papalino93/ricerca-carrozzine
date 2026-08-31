"use client";

import { useState } from "react";
import { STATUS_LABEL, type Device } from "@/lib/device-types";
import { DocumentPanel } from "./DocumentPanel";
import { DevicePublicViewModal } from "./DevicePublicViewModal";
import { IconDocumento, IconNoleggio, IconRestituzione, IconSanificato } from "./ReceptionIcons";

function fmtDate(iso: string | null): string {
  if (!iso) return "";
  const [y, m, d] = (iso.includes("T") ? iso.slice(0, 10) : iso).split("-");
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

interface DeviceCardProps {
  device: Device;
  exactWidth?: boolean;
  statusColor: string;
  /**
   * Se passato, mostra "Noleggia" sulle card disponibili (solo dove ha
   * senso: ricerca pubblica). La modale di noleggio vive nel chiamante,
   * non qui: appena il noleggio va a buon fine questa card può sparire
   * dall'elenco filtrato (stato non più "disponibile"), e portandosi via
   * anche il verbale di consegna che dovrebbe apparire subito dopo.
   */
  onRent?: () => void;
  /** Come onRent: "Segna restituito" sulle card noleggiate, azione gestita
   * dal chiamante per lo stesso motivo (il verbale di restituzione non deve
   * sparire insieme alla card appena questa cambia stato). */
  onReturn?: () => void;
  /** Come onRent/onReturn: "Segna sanificato" sulle card da pulire. */
  onSanitize?: () => void;
  /** Disabilita le azioni di stato mentre una richiesta è in corso, per
   * evitare doppi click che duplicherebbero l'operazione. */
  busy?: boolean;
  /** Passato alla vista di dettaglio: risolvere un dispositivo "da
   * verificare" anche dalla ricerca pubblica, vedi DevicePublicViewModal. */
  onUpdated?: (devices: Device[]) => void;
}

// Riga compatta: l'intera riga apre "Visualizza" (stessa modale di prima,
// nessun pulsante di testo dedicato), mentre le azioni restano pulsanti a
// icona da 44px per non essere confusi col tocco sulla riga e restare
// comodi da telefono in magazzino.
export function DeviceCard({
  device: d,
  exactWidth,
  statusColor,
  onRent,
  onReturn,
  onSanitize,
  busy,
  onUpdated,
}: DeviceCardProps) {
  const [showDoc, setShowDoc] = useState(false);
  const [showView, setShowView] = useState(false);

  return (
    <div
      className="card compact"
      id={`device-${d.codice}`}
      onClick={() => setShowView(true)}
    >
      {/* Identifica sempre il dispositivo per codice, non per larghezza: con
          categorie diverse dalle carrozzine la larghezza non ha senso per
          tutti gli articoli. La larghezza, quando c'è, resta visibile come
          tag accanto al modello (vedi width-tag qui sotto). */}
      <div className="id-badge">
        {d.codice}
      </div>
      <div className="card-body">
        <div className="card-top">
          {d.foto ? (
            <img className="card-photo" src={d.foto} alt={`${d.marca} ${d.modello}`} />
          ) : null}
          <span className="model">
            {d.marca} {d.modello}
          </span>
          {d.larghezza != null ? (
            <span
              className="width-tag"
              style={exactWidth ? { borderColor: statusColor } : undefined}
            >
              {d.larghezza} cm
            </span>
          ) : null}
          <span className={`pill ${d.stato}`}>{STATUS_LABEL[d.stato]}</span>
        </div>
        <div className="meta">
          <strong className="meta-categoria">{d.categoria}</strong>
          {d.cliente ? ` · dal ${fmtDate(d.dal)} — ${d.cliente}` : ""}
          {d.stato === "disponibile" && d.sanificazione
            ? ` · sanificata il ${fmtDate(d.sanificazione)}`
            : ""}
        </div>
        {d.nota ? <div className="note">{d.nota}</div> : null}
      </div>
      <div className="card-actions" onClick={(e) => e.stopPropagation()}>
        {onRent && d.stato === "disponibile" ? (
          <button
            className="btn primary icon-only"
            type="button"
            title="Noleggia"
            aria-label="Noleggia"
            onClick={onRent}
          >
            <IconNoleggio />
          </button>
        ) : null}
        {onReturn && d.stato === "noleggiato" ? (
          <button
            className="btn primary icon-only"
            type="button"
            title="Segna restituito"
            aria-label="Segna restituito"
            onClick={onReturn}
            disabled={busy}
          >
            <IconRestituzione />
          </button>
        ) : null}
        {onSanitize && d.stato === "da_pulire" ? (
          <button
            className="btn primary icon-only"
            type="button"
            title="Segna sanificato"
            aria-label="Segna sanificato"
            onClick={onSanitize}
            disabled={busy}
          >
            <IconSanificato />
          </button>
        ) : null}
        <button
          className="btn icon-only"
          type="button"
          title="Genera documento"
          aria-label="Genera documento"
          onClick={() => setShowDoc(true)}
        >
          <IconDocumento />
        </button>
      </div>
      {showDoc ? <DocumentPanel device={d} onClose={() => setShowDoc(false)} /> : null}
      {showView ? (
        <DevicePublicViewModal device={d} onClose={() => setShowView(false)} onUpdated={onUpdated} />
      ) : null}
    </div>
  );
}
