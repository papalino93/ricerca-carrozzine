"use client";

import { useState } from "react";
import { networkErrorMessage, readJson } from "@/lib/fetch-json";
import { addDaysIso, todayIso } from "@/lib/dates";
import type { Device } from "@/lib/device-types";
import { calcolaTotale, findTariffa, fmtEuro, giorniTra, type Tariffa } from "@/lib/tariffe-types";

interface QuickRentModalProps {
  device: Device;
  tariffe: Tariffa[];
  onClose: () => void;
  /**
   * L'elenco aggiornato dopo il noleggio. Il chiamante decide cosa fare
   * dopo (es. mostrare il verbale di consegna) e possiede quello stato: se
   * lo facesse questa modale, e il chiamante è una card che il nuovo stato
   * "noleggiato" fa sparire dai risultati filtrati, il verbale sparirebbe
   * con lei prima che l'operatore lo veda.
   */
  onRented: (devices: Device[]) => void;
}

// Noleggio diretto dalla ricerca: prima bisognava annotarsi il codice,
// andare in amministrazione, ri-cercarlo e noleggiarlo da lì. Stessa
// operazione della scheda dispositivo in admin, ma richiamabile subito
// dalla card di un ausilio disponibile — nessun dato nuovo, nessun
// permesso nuovo: chi arriva qui è già autenticato come chiunque acceda
// all'amministrazione (un solo livello di accesso in questo sito).
export function QuickRentModal({ device, tariffe, onClose, onRented }: QuickRentModalProps) {
  const [cliente, setCliente] = useState("");
  const [telefono, setTelefono] = useState("");
  const [dal, setDal] = useState(todayIso());
  const tariffa = findTariffa(tariffe, device.categoria, device.sottocategoria);
  // Prefillato dal tariffario, ma modificabile per questo singolo noleggio
  // (es. uno sconto concordato): l'unità (giorno/settimana) resta invece
  // quella della categoria, non ha senso cambiarla per un solo noleggio.
  const [prezzo, setPrezzo] = useState(tariffa ? String(tariffa.importo).replace(".", ",") : "");
  const [alPrevisto, setAlPrevisto] = useState(addDaysIso(todayIso(), 30));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const prezzoNum = Number(prezzo.replace(",", "."));
  const totaleStimato =
    tariffa && alPrevisto && prezzoNum > 0
      ? calcolaTotale(prezzoNum, tariffa.unita, giorniTra(dal, alPrevisto))
      : null;

  async function handleConfirm(e: React.FormEvent) {
    e.preventDefault();
    if (!cliente.trim()) {
      setError("Il nome del cliente è obbligatorio");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/dispositivi/${encodeURIComponent(device.codice)}/eventi`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tipo: "noleggio",
          cliente,
          telefono,
          dal,
          alPrevisto: alPrevisto || null,
          tariffaApplicata: tariffa && prezzoNum > 0 ? prezzoNum : null,
          tariffaUnita: tariffa && prezzoNum > 0 ? tariffa.unita : null,
        }),
      });
      const body = await readJson(res);
      if (!res.ok) throw new Error(body.error || "Operazione non riuscita");
      onRented(body.devices);
    } catch (err) {
      setError(networkErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>Noleggia {device.codice} — {device.marca} {device.modello}</h3>
          <button className="modal-close" onClick={onClose} aria-label="Chiudi" type="button">
            ×
          </button>
        </div>

        {error ? <div className="banner error">{error}</div> : null}

        {tariffa ? (
          <div className="field-row" style={{ alignItems: "flex-end" }}>
            <div className="field">
              <label>Tariffa applicata (€ {tariffa.unita === "settimana" ? "a settimana" : "al giorno"})</label>
              <input value={prezzo} onChange={(e) => setPrezzo(e.target.value)} inputMode="decimal" />
            </div>
            <p className="hint" style={{ margin: "0 0 10px" }}>
              {tariffa.nota ? tariffa.nota : "Modificabile solo per questo noleggio"}
            </p>
          </div>
        ) : null}
        {totaleStimato != null ? (
          <p className="hint" style={{ margin: "0 0 14px" }}>
            Totale stimato fino al rientro previsto: <b>{fmtEuro(totaleStimato)}</b>
          </p>
        ) : null}

        <form onSubmit={handleConfirm}>
          <div className="field">
            <label>Cliente</label>
            <input
              value={cliente}
              onChange={(e) => setCliente(e.target.value)}
              placeholder="Nome e cognome"
              autoFocus
            />
          </div>
          <div className="field">
            <label>Telefono</label>
            <input value={telefono} onChange={(e) => setTelefono(e.target.value)} />
          </div>
          <div className="field-row">
            <div className="field">
              <label>Dal</label>
              <input type="date" value={dal} onChange={(e) => setDal(e.target.value)} />
            </div>
            <div className="field">
              <label>Rientro previsto (facoltativo)</label>
              <input type="date" value={alPrevisto} onChange={(e) => setAlPrevisto(e.target.value)} />
            </div>
          </div>
          <div className="chips" style={{ marginBottom: 14 }}>
            {[15, 30, 60, 90].map((days) => (
              <button
                key={days}
                type="button"
                className="chip"
                onClick={() => setAlPrevisto(addDaysIso(dal, days))}
              >
                +{days} giorni
              </button>
            ))}
            <button type="button" className="chip" onClick={() => setAlPrevisto("")}>
              Nessuna scadenza
            </button>
          </div>
          <div className="card-actions">
            <button className="btn" type="button" onClick={onClose}>
              Annulla
            </button>
            <button className="btn primary" type="submit" disabled={saving}>
              {saving ? "Salvataggio…" : "Conferma noleggio"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
