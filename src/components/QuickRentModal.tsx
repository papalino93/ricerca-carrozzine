"use client";

import { useState } from "react";
import { networkErrorMessage, readJson } from "@/lib/fetch-json";
import { todayIso } from "@/lib/dates";
import { parseNumero } from "@/lib/importo";
import { useModalA11y } from "./useModalA11y";
import { AutocompleteInput } from "./AutocompleteInput";
import type { Device } from "@/lib/device-types";
import {
  calcolaTotale,
  findTariffa,
  fmtEuro,
  sottocategoriaSenzaTariffaSpecifica,
  type Tariffa,
} from "@/lib/tariffe-types";

interface QuickRentModalProps {
  device: Device;
  tariffe: Tariffa[];
  /** Anagrafica clienti, solo nome e telefono: suggerisce i nomi già noti nel
   * campo Cliente e precompila il telefono se corrisponde esattamente. */
  clienti: { nome: string; telefono: string | null }[];
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
export function QuickRentModal({ device, tariffe, clienti, onClose, onRented }: QuickRentModalProps) {
  const dialogRef = useModalA11y(onClose);
  const [cliente, setCliente] = useState("");
  const [telefono, setTelefono] = useState("");
  const [dal, setDal] = useState(todayIso());
  const tariffa = findTariffa(tariffe, device.categoria, device.sottocategoria);
  const mismatchSottocategoria = sottocategoriaSenzaTariffaSpecifica(
    tariffe,
    device.categoria,
    device.sottocategoria
  );
  // Prefillato dal tariffario, ma modificabile per questo singolo noleggio
  // (es. uno sconto concordato): l'unità (giorno/settimana) resta invece
  // quella della categoria, non ha senso cambiarla per un solo noleggio.
  const [prezzo, setPrezzo] = useState(tariffa ? String(tariffa.importo).replace(".", ",") : "");
  // Stessa idea del prezzo: prefillata dal tariffario di categoria, ma
  // modificabile per questo singolo noleggio (es. consegna gratuita per un
  // cliente abituale).
  const [costoConsegna, setCostoConsegna] = useState(
    tariffa?.costoConsegna != null ? String(tariffa.costoConsegna).replace(".", ",") : ""
  );
  const [nota, setNota] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // parseNumero, non Number(x.replace(",", ".")): un importo ≥ 1000€
  // scritto con il punto delle migliaia (es. "1.200,00") diventerebbe
  // altrimenti NaN, e il noleggio verrebbe confermato senza alcuna
  // tariffa registrata, senza che l'operatore se ne accorga.
  const prezzoNum = parseNumero(prezzo) ?? NaN;
  const costoConsegnaNum = parseNumero(costoConsegna);
  // Il rientro previsto non è più un campo del form (vedi devices.ts,
  // rentDevice lo calcola da sé): questa stima assume gli stessi 30 giorni
  // di default, solo per dare un'idea del totale senza promettere una data.
  const totaleStimato =
    tariffa && prezzoNum > 0 ? calcolaTotale(prezzoNum, tariffa.unita, 30) : null;

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
          alPrevisto: null,
          tariffaApplicata: tariffa && prezzoNum > 0 ? prezzoNum : null,
          tariffaUnita: tariffa && prezzoNum > 0 ? tariffa.unita : null,
          costoConsegna: costoConsegnaNum,
          notaTariffa: tariffa?.nota ?? null,
          notaNoleggio: nota.trim() || null,
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
    <div className="modal-overlay" role="presentation" onClick={onClose}>
      <div
        ref={dialogRef}
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="quick-rent-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-head">
          <h3 id="quick-rent-title">Noleggia {device.codice} — {device.marca} {device.modello}</h3>
          <button className="modal-close" onClick={onClose} aria-label="Chiudi" type="button">
            ×
          </button>
        </div>

        {error ? <div className="banner error">{error}</div> : null}

        {mismatchSottocategoria ? (
          <div className="banner" style={{ marginBottom: 12 }}>
            Nessuna tariffa specifica per la sottocategoria &quot;{device.sottocategoria}&quot;: sto
            applicando quella generale di &quot;{device.categoria}&quot;. Controlla che non sia un refuso
            (in Impostazioni → Tariffe).
          </div>
        ) : null}

        {tariffa ? (
          <div className="field-row" style={{ alignItems: "flex-end" }}>
            <div className="field">
              <label>Tariffa applicata (€ {tariffa.unita === "settimana" ? "a settimana" : "al giorno"})</label>
              <input value={prezzo} onChange={(e) => setPrezzo(e.target.value)} inputMode="decimal" />
            </div>
            <div className="field">
              <label>Costo consegna (€, facoltativo)</label>
              <input
                value={costoConsegna}
                onChange={(e) => setCostoConsegna(e.target.value)}
                inputMode="decimal"
                placeholder="es. 25"
              />
            </div>
            {tariffa.nota ? (
              <p className="hint" style={{ margin: "0 0 10px" }}>{tariffa.nota}</p>
            ) : null}
          </div>
        ) : null}
        {totaleStimato != null ? (
          <p className="hint" style={{ margin: "0 0 14px" }}>
            Totale stimato per 30 giorni: <b>{fmtEuro(totaleStimato)}</b>
          </p>
        ) : null}

        <form
          onSubmit={handleConfirm}
          onKeyDown={(e) => {
            const tag = (e.target as HTMLElement).tagName;
            if (e.key === "Enter" && tag !== "TEXTAREA" && tag !== "BUTTON") {
              e.preventDefault();
            }
          }}
        >
          <div className="field">
            <label>Cliente</label>
            <AutocompleteInput
              value={cliente}
              onChange={setCliente}
              options={clienti.map((c) => ({ value: c.nome, sublabel: c.telefono }))}
              onSelect={(o) => {
                if (!telefono) {
                  const match = clienti.find((c) => c.nome === o.value);
                  if (match?.telefono) setTelefono(match.telefono);
                }
              }}
              placeholder="Nome e cognome"
              autoFocus
            />
          </div>
          <div className="field">
            <label>Telefono</label>
            <input value={telefono} onChange={(e) => setTelefono(e.target.value)} />
          </div>
          <div className="field">
            <label>Dal</label>
            <input type="date" value={dal} onChange={(e) => setDal(e.target.value)} />
          </div>
          <div className="field">
            <label>Note (facoltative)</label>
            <textarea
              value={nota}
              onChange={(e) => setNota(e.target.value)}
              placeholder="Es. consegna al piano 3, ritiro concordato per venerdì…"
              rows={2}
            />
          </div>
          <div className="card-actions">
            <button className="btn ghost" type="button" onClick={onClose}>
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
