"use client";

import { useState } from "react";
import type { Device } from "@/lib/devices";
import type { DocumentoTipo } from "@/lib/pdf/VerbaleDocument";
import { calcolaTotale, fmtEuro, giorniTra } from "@/lib/tariffe-types";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sul verbale di restituzione, "data" è il rientro reale: il totale è
  // quello effettivo. Su quello di consegna ha senso solo se c'è un rientro
  // previsto (altrimenti non si sa quanti giorni contare): è una stima.
  const dataFine = tipo === "restituzione" ? data : device.alPrevisto;
  const totale =
    device.tariffaApplicata != null && device.tariffaUnita && device.dal && dataFine
      ? calcolaTotale(device.tariffaApplicata, device.tariffaUnita, giorniTra(device.dal, dataFine))
      : null;
  const totaleStimato = tipo === "consegna";

  async function handleDownload() {
    setLoading(true);
    setError(null);
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
            includiTariffa && totale != null && device.tariffaApplicata != null && device.tariffaUnita
              ? {
                  importo: device.tariffaApplicata,
                  unita: device.tariffaUnita,
                  totale,
                  stimato: totaleStimato,
                }
              : null,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Generazione del PDF non riuscita");
      }
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
      setError((err as Error).message);
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

        {totale != null ? (
          <div className="internal-note">
            <b>{totaleStimato ? "Totale stimato" : "Totale"}</b> ({fmtEuro(device.tariffaApplicata!)} al{" "}
            {device.tariffaUnita === "settimana" ? "settimana" : "giorno"}
            {totaleStimato ? ", fino al rientro previsto" : ""}): <b>{fmtEuro(totale)}</b>
            <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
              <input
                type="checkbox"
                checked={includiTariffa}
                onChange={(e) => setIncludiTariffa(e.target.checked)}
              />
              Includi tariffa e totale sul documento
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
            {loading ? "Generazione…" : "Scarica PDF"}
          </button>
        </div>
      </div>
    </div>
  );
}
