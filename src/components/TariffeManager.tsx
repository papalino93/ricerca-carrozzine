"use client";

import { readJson } from "@/lib/fetch-json";
import { useState } from "react";
import { fmtTariffa, type Tariffa, type TariffaUnita } from "@/lib/tariffe-types";

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
};

export function TariffeManager({ initialTariffe, categories }: TariffeManagerProps) {
  const [tariffe, setTariffe] = useState(initialTariffe);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        }),
      });
      const body = await readJson(res);
      if (!res.ok) throw new Error(body.error || "Impossibile salvare la tariffa");
      setTariffe(body.tariffe);
      setForm(EMPTY_FORM);
    } catch (err) {
      setError((err as Error).message);
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
    } catch (err) {
      setError((err as Error).message);
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
        generale). Compare come promemoria nel form di noleggio: le spese di consegna e
        ritiro restano a inserimento manuale dell&apos;operatore, non calcolate qui.
      </p>

      {error ? <div className="banner error">{error}</div> : null}

      {tariffe.length === 0 ? (
        <p className="hint">Nessuna tariffa configurata.</p>
      ) : (
        <table className="admin-table" style={{ marginBottom: 16 }}>
          <thead>
            <tr>
              <th>Categoria</th>
              <th>Sottocategoria</th>
              <th>Tariffa</th>
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
                <td>{t.nota ?? "—"}</td>
                <td>
                  <div className="card-actions" style={{ marginTop: 0 }}>
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
      )}

      <form onSubmit={handleAdd}>
        <div className="field-row">
          <div className="field">
            <label>Categoria</label>
            <input
              list="tariffe-categorie-list"
              value={form.categoria}
              onChange={(e) => setForm({ ...form, categoria: e.target.value })}
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
        <div className="field">
          <label>Note (facoltative)</label>
          <input
            value={form.nota}
            onChange={(e) => setForm({ ...form, nota: e.target.value })}
            placeholder="es. + ritiro e consegna 20/30€"
          />
        </div>
        <div className="card-actions">
          <button className="btn primary" type="submit" disabled={saving}>
            {saving ? "Salvataggio…" : "Salva tariffa"}
          </button>
        </div>
      </form>
    </div>
  );
}
