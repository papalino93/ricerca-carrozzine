"use client";

import { useEffect, useState } from "react";
import type { Device } from "@/lib/devices";
import type { DocumentoTipo } from "@/lib/pdf/VerbaleDocument";
import { calcolaTotale, fmtEuro, giorniTra } from "@/lib/tariffe-types";
import { SignaturePad } from "./SignaturePad";
import { networkErrorMessage } from "@/lib/fetch-json";
import { todayIso } from "@/lib/dates";

interface DocumentPanelProps {
  device: Device;
  onClose: () => void;
  /** Forza il tipo iniziale (es. subito dopo un noleggio/restituzione,
   * quando lo stato del dispositivo è già cambiato e non riflette più
   * l'operazione appena fatta). Senza, si deduce dallo stato attuale. */
  forcedTipo?: DocumentoTipo;
}

export function DocumentPanel({ device, onClose, forcedTipo }: DocumentPanelProps) {
  const [tipo, setTipo] = useState<DocumentoTipo>(
    forcedTipo ?? (device.stato === "noleggiato" ? "restituzione" : "consegna")
  );
  const [numeroContratto, setNumeroContratto] = useState(device.contratto ?? "");
  // Se il dispositivo ha già una data di inizio noleggio (es. subito dopo
  // "Conferma noleggio", con una data passata inserita dall'operatore),
  // il verbale di consegna deve partire da quella e non da oggi.
  const [data, setData] = useState(
    tipo === "consegna" && device.dal ? device.dal : todayIso()
  );
  const [clienteNome, setClienteNome] = useState(device.cliente ?? "");
  const [clienteTelefono, setClienteTelefono] = useState(device.telefono ?? "");
  const [alPrevisto, setAlPrevisto] = useState(device.alPrevisto ?? "");
  // Parte VUOTO di proposito. La nota della scheda è un'annotazione interna
  // di magazzino ("ruota da sostituire", "cliente moroso"): pre-riempirla
  // qui la faceva finire stampata sul verbale che il cliente firma e porta
  // via. La nota resta consultabile qui sotto, ma va copiata a mano.
  const [note, setNote] = useState("");
  // Il totale, quando c'è una tariffa applicata al noleggio, è solo un
  // promemoria per l'operatore: di default NON finisce sul documento
  // stampato, va deciso ogni volta con questo interruttore.
  const [includiTariffa, setIncludiTariffa] = useState(false);
  // Sezione firma digitale nascosta finché non sappiamo se c'è una cartella
  // Drive dove archiviare il PDF firmato (vedi drive.ts): senza, mostrare i
  // riquadri di firma sarebbe una funzione che sembra esserci ma non salva
  // da nessuna parte oltre al download del momento.
  const [driveConfigured, setDriveConfigured] = useState(false);
  const [firmaCliente, setFirmaCliente] = useState<string | null>(null);
  const [firmaOperatore, setFirmaOperatore] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [driveUrl, setDriveUrl] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/drive-status")
      .then((res) => res.json())
      .then((body) => setDriveConfigured(Boolean(body.configurato)))
      .catch(() => setDriveConfigured(false));
  }, []);

  const hasTariffa = device.tariffaApplicata != null && device.tariffaUnita != null;
  // Sul verbale di restituzione, "data" è il rientro reale: il totale è
  // quello effettivo. Su quello di consegna serve un rientro previsto
  // (quello nel form qui sotto, non quello — eventualmente diverso — già
  // salvato sul dispositivo) per sapere quanti giorni contare: è una stima,
  // e senza resta solo la tariffa giornaliera, senza nessun totale.
  const dataFine = tipo === "restituzione" ? data : alPrevisto || null;
  const totale =
    hasTariffa && device.dal && dataFine
      ? calcolaTotale(device.tariffaApplicata!, device.tariffaUnita!, giorniTra(device.dal, dataFine))
      : null;
  const totaleStimato = tipo === "consegna";

  async function handleDownload() {
    setLoading(true);
    setError(null);
    setDriveUrl(null);
    try {
      const res = await fetch("/api/documento", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tipo,
          numeroContratto,
          data,
          note,
          dispositivo: {
            codice: device.codice,
            categoria: device.categoria,
            marca: device.marca,
            modello: device.modello,
            larghezza: device.larghezza,
          },
          cliente: { nome: clienteNome, telefono: clienteTelefono },
          alPrevisto: tipo === "consegna" ? alPrevisto || null : null,
          tariffa:
            includiTariffa && hasTariffa
              ? {
                  importo: device.tariffaApplicata,
                  unita: device.tariffaUnita,
                  totale: totale ?? undefined,
                  stimato: totaleStimato,
                }
              : null,
          firmaCliente: driveConfigured ? firmaCliente : null,
          firmaOperatore: driveConfigured ? firmaOperatore : null,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Generazione del PDF non riuscita");
      }
      const uploadedUrl = res.headers.get("X-Drive-Url");
      if (uploadedUrl) setDriveUrl(uploadedUrl);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `verbale-${tipo}-${device.codice}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(networkErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>Genera documento — {device.codice}</h3>
          <button className="modal-close" onClick={onClose} aria-label="Chiudi">
            ×
          </button>
        </div>

        <div className="doc-type-tabs">
          <button
            className={`chip ${tipo === "consegna" ? "active" : ""}`}
            onClick={() => setTipo("consegna")}
            type="button"
          >
            Verbale di consegna
          </button>
          <button
            className={`chip ${tipo === "restituzione" ? "active" : ""}`}
            onClick={() => setTipo("restituzione")}
            type="button"
          >
            Verbale di restituzione
          </button>
        </div>

        {error ? <div className="banner error">{error}</div> : null}

        <div className="field-row">
          <div className="field">
            <label>N. Noleggio</label>
            <input value={numeroContratto} onChange={(e) => setNumeroContratto(e.target.value)} />
          </div>
          <div className="field">
            <label>{tipo === "consegna" ? "Data di consegna" : "Data di restituzione"}</label>
            <input type="date" value={data} onChange={(e) => setData(e.target.value)} />
          </div>
        </div>

        <div className="field-row">
          <div className="field">
            <label>Cliente</label>
            <input value={clienteNome} onChange={(e) => setClienteNome(e.target.value)} placeholder="Nome e cognome" />
          </div>
          <div className="field">
            <label>Telefono cliente</label>
            <input value={clienteTelefono} onChange={(e) => setClienteTelefono(e.target.value)} placeholder="Telefono" />
          </div>
        </div>

        {tipo === "consegna" ? (
          <div className="field">
            <label>Rientro previsto (facoltativo)</label>
            <input type="date" value={alPrevisto} onChange={(e) => setAlPrevisto(e.target.value)} />
            <p className="hint" style={{ margin: "4px 0 0" }}>
              Se compilato, compare sul verbale; se lasciato vuoto non viene stampato.
            </p>
          </div>
        ) : null}

        {hasTariffa ? (
          <div className="internal-note">
            <b>Tariffa applicata</b>: {fmtEuro(device.tariffaApplicata!)} al{" "}
            {device.tariffaUnita === "settimana" ? "settimana" : "giorno"}
            {totale != null ? (
              <>
                <br />
                <b>{totaleStimato ? "Totale stimato" : "Totale"}</b>
                {totaleStimato ? " (fino al rientro previsto)" : ""}: <b>{fmtEuro(totale)}</b>
              </>
            ) : (
              <>
                <br />
                <span className="hint">
                  {totaleStimato
                    ? "Imposta un rientro previsto qui sopra per vedere anche una stima del totale."
                    : ""}
                </span>
              </>
            )}
            <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
              <input
                type="checkbox"
                checked={includiTariffa}
                onChange={(e) => setIncludiTariffa(e.target.checked)}
              />
              Includi {totale != null ? "tariffa e totale" : "la tariffa"} sul documento
            </label>
          </div>
        ) : null}

        {device.nota ? (
          <div className="internal-note">
            <b>Nota interna</b> — resta in magazzino, NON viene stampata sul documento:
            <div>{device.nota}</div>
            <button
              type="button"
              className="btn"
              onClick={() => setNote((n) => (n ? `${n}\n${device.nota}` : device.nota ?? ""))}
            >
              Copia nelle note del documento
            </button>
          </div>
        ) : null}

        <div className="field">
          <label>Note da stampare sul documento</label>
          <textarea
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Facoltative: verranno lette e firmate dal cliente"
          />
        </div>

        {driveConfigured ? (
          <div className="panel" style={{ margin: "0 0 16px" }}>
            <h2>Firma digitale (facoltativa)</h2>
            <p className="hint" style={{ marginBottom: 10 }}>
              Se firmate qui sotto, il verbale viene generato con le firme incluse e salvato
              automaticamente su Drive. Senza firme, funziona come sempre: un PDF da stampare.
            </p>
            <SignaturePad label="Firma cliente" onChange={setFirmaCliente} />
            <SignaturePad label="Firma operatore" onChange={setFirmaOperatore} />
          </div>
        ) : null}

        {driveUrl ? (
          <div className="banner" style={{ borderColor: "var(--ok-line)", color: "var(--ok-fg)" }}>
            Verbale firmato salvato su Drive.{" "}
            <a href={driveUrl} target="_blank" rel="noreferrer">
              Apri il documento ↗
            </a>
          </div>
        ) : null}

        <div className="doc-preview">
          <div>
            <b>{device.marca} {device.modello}</b> · {device.categoria}
            {device.larghezza ? ` · ${device.larghezza} cm seduta` : ""}
          </div>
          <div>Codice: {device.codice}</div>
        </div>

        <div className="card-actions" style={{ marginTop: 16 }}>
          <button className="btn" onClick={onClose} type="button">
            Annulla
          </button>
          <button className="btn primary" onClick={handleDownload} disabled={loading} type="button">
            {loading
              ? "Generazione…"
              : driveConfigured && (firmaCliente || firmaOperatore)
                ? "Genera, firma e salva"
                : "Scarica PDF"}
          </button>
        </div>
      </div>
    </div>
  );
}
