"use client";

import { networkErrorMessage, readJson } from "@/lib/fetch-json";
import { useState } from "react";
import { fmtEuro, fmtTariffa, type Tariffa, type TariffaUnita } from "@/lib/tariffe-types";

interface TariffeManagerProps {
  initialTariffe: Tariffa[];
  categories: string[];
}

const EMPTY_FORM = {
  categoria: "",
  sottocategoria: "",
  importo: "",
  unita: "giorno" as TariffaUnita,
  nota: "",
  costoConsegna: "",
};

export function TariffeManager({ initialTariffe, categories }: TariffeManagerProps) {
  const [tariffe, setTariffe] = useState(initialTariffe);
  const [form, setForm] = useState(EMPTY_FORM);
  // Non null mentre si modifica una tariffa esistente (invece di
  // aggiungerne una nuova): categoria/sottocategoria restano bloccate,
  // perché sono la chiave che il server usa per capire quale riga
  // sostituire — cambiarle qui creerebbe una riga in più invece di
  // aggiornare quella giusta.
  const [editing, setEditing] = useState<{ categoria: string; sottocategoria: string | null } | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function startEdit(t: Tariffa) {
    setEditing({ categoria: t.categoria, sottocategoria: t.sottocategoria });
    setForm({
      categoria: t.categoria,
      sottocategoria: t.sottocategoria ?? "",
      importo: String(t.importo).replace(".", ","),
      unita: t.unita,
      nota: t.nota ?? "",
      costoConsegna: t.costoConsegna != null ? String(t.costoConsegna).replace(".", ",") : "",
    });
  }

  function cancelEdit() {
    setEditing(null);
    setForm(EMPTY_FORM);
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/tariffe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          categoria: form.categoria,
          sottocategoria: form.sottocategoria || null,
          importo: Number(form.importo.replace(",", ".")),
          unita: form.unita,
          nota: form.nota || null,
          costoConsegna: form.costoConsegna ? Number(form.costoConsegna.replace(",", ".")) : null,
        }),
      });
      const body = await readJson(res);
      if (!res.ok) throw new Error(body.error || "Impossibile salvare la tariffa");
      setTariffe(body.tariffe);
      setForm(EMPTY_FORM);
      setEditing(null);
    } catch (err) {
      setError(networkErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove(t: Tariffa) {
    const label = t.sottocategoria ? `${t.categoria} · ${t.sottocategoria}` : t.categoria;
    if (!confirm(`Eliminare la tariffa "${label}"?`)) return;
    setSaving(true);
    setError(null);
    try {
      const params = new URLSearchParams({ categoria: t.categoria });
      if (t.sottocategoria) params.set("sottocategoria", t.sottocategoria);
      const res = await fetch(`/api/tariffe?${params.toString()}`, { method: "DELETE" });
      const body = await readJson(res);
      if (!res.ok) throw new Error(body.error || "Impossibile eliminare la tariffa");
      setTariffe(body.tariffe);
      if (editing && editing.categoria === t.categoria && editing.sottocategoria === t.sottocategoria) {
        cancelEdit();
      }
    } catch (err) {
      setError(networkErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="panel">
      <h2>Tariffe di noleggio</h2>
      <p className="hint" style={{ marginBottom: 12 }}>
        Una tariffa per categoria, con un&apos;eventuale sottocategoria più specifica (es.
        &quot;Carrozzine · Elettrica&quot; a un prezzo diverso da &quot;Carrozzine&quot; in
        generale). Compare come promemoria nel form di noleggio, con l&apos;eventuale
        tariffa di consegna e ritiro: entrambe modificabili per il singolo noleggio e
        stampate sul contratto.
      </p>

      {error ? <div className="banner error">{error}</div> : null}

      {tariffe.length === 0 ? (
        <p className="hint">Nessuna tariffa configurata.</p>
      ) : (
        <div className="admin-table-wrap" style={{ marginBottom: 16 }}>
        <table className="admin-table">
          <thead>
            <tr>
              <th>Categoria</th>
              <th>Sottocategoria</th>
              <th>Tariffa</th>
              <th>Consegna/ritiro</th>
              <th>Note</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {tariffe.map((t) => (
              <tr key={`${t.categoria}::${t.sottocategoria ?? ""}`}>
                <td>{t.categoria}</td>
                <td>{t.sottocategoria ?? "—"}</td>
                <td>{fmtTariffa(t)}</td>
                <td>{t.costoConsegna != null ? fmtEuro(t.costoConsegna) : "—"}</td>
                <td>{t.nota ?? "—"}</td>
                <td>
                  <div className="card-actions" style={{ marginTop: 0 }}>
                    <button className="btn" type="button" onClick={() => startEdit(t)} disabled={saving}>
                      Modifica
                    </button>
                    <button
                      className="btn danger"
                      type="button"
                      onClick={() => handleRemove(t)}
                      disabled={saving}
                    >
                      Elimina
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      )}

      <form onSubmit={handleAdd}>
        <h3 style={{ margin: "0 0 10px" }}>{editing ? "Modifica tariffa" : "Nuova tariffa"}</h3>
        <div className="field-row">
          <div className="field">
            <label>Categoria</label>
            <input
              list="tariffe-categorie-list"
              value={form.categoria}
              onChange={(e) => setForm({ ...form, categoria: e.target.value })}
              disabled={Boolean(editing)}
              required
            />
            <datalist id="tariffe-categorie-list">
              {categories.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </div>
          <div className="field">
            <label>Sottocategoria (facoltativa)</label>
            <input
              value={form.sottocategoria}
              onChange={(e) => setForm({ ...form, sottocategoria: e.target.value })}
              placeholder="es. Elettrica — vuoto per l'intera categoria"
              disabled={Boolean(editing)}
            />
          </div>
        </div>
        <div className="field-row">
          <div className="field">
            <label>Importo (€)</label>
            <input
              value={form.importo}
              onChange={(e) => setForm({ ...form, importo: e.target.value })}
              inputMode="decimal"
              placeholder="es. 3,50"
              required
            />
          </div>
          <div className="field">
            <label>Unità</label>
            <select
              value={form.unita}
              onChange={(e) => setForm({ ...form, unita: e.target.value as TariffaUnita })}
            >
              <option value="giorno">Al giorno</option>
              <option value="settimana">Alla settimana</option>
            </select>
          </div>
        </div>
        <div className="field-row">
          <div className="field">
            <label>Costo consegna (€, facoltativo)</label>
            <input
              value={form.costoConsegna}
              onChange={(e) => setForm({ ...form, costoConsegna: e.target.value })}
              inputMode="decimal"
              placeholder="es. 25 — vuoto se non si applica"
            />
          </div>
          <div className="field">
            <label>Note (facoltative)</label>
            <input
              value={form.nota}
              onChange={(e) => setForm({ ...form, nota: e.target.value })}
              placeholder="es. + 35€ materassino"
            />
          </div>
        </div>
        <div className="card-actions">
          <button className="btn primary" type="submit" disabled={saving}>
            {saving ? "Salvataggio…" : editing ? "Salva modifiche" : "Aggiungi tariffa"}
          </button>
          {editing ? (
            <button className="btn" type="button" onClick={cancelEdit} disabled={saving}>
              Annulla
            </button>
          ) : null}
        </div>
      </form>
    </div>
  );
}
