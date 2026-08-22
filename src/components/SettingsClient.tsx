"use client";

import { readJson } from "@/lib/fetch-json";
import { useRef, useState } from "react";
import type { CompanySettings } from "@/lib/settings";
import type { AdminUser } from "@/lib/users";
import { UsersManager } from "./UsersManager";
import { CategoriesManager } from "./CategoriesManager";
import { Toast } from "./Toast";

interface SettingsClientProps {
  initialSettings: CompanySettings;
  initialUsers: AdminUser[];
  initialCategories: string[];
}

type SettingsTab = "azienda" | "categorie" | "utenti";

const TABS: { key: SettingsTab; label: string }[] = [
  { key: "azienda", label: "Azienda" },
  { key: "categorie", label: "Categorie" },
  { key: "utenti", label: "Utenti" },
];

export function SettingsClient({
  initialSettings,
  initialUsers,
  initialCategories,
}: SettingsClientProps) {
  const [tab, setTab] = useState<SettingsTab>("azienda");
  const [settings, setSettings] = useState(initialSettings);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function showToast(message: string) {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2400);
  }

  async function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/upload-logo", { method: "POST", body: form });
      const body = await readJson(res);
      if (!res.ok) throw new Error(body.error || "Caricamento del logo non riuscito");
      setSettings((s) => ({ ...s, logoUrl: body.url }));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/impostazioni", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      const body = await readJson(res);
      if (!res.ok) throw new Error(body.error || "Salvataggio non riuscito");
      showToast("Impostazioni salvate");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="wrap">
      <header className="page-header">
        <h1>Impostazioni</h1>
        <p className="sub">Dati aziendali, categorie ausili e utenti autorizzati.</p>
      </header>

      <div className="chips" style={{ marginBottom: 20 }}>
        {TABS.map((t) => (
          <button
            key={t.key}
            className={`chip ${tab === t.key ? "active" : ""}`}
            type="button"
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error ? <div className="banner error">{error}</div> : null}

      {/* I tre pannelli restano tutti montati (nascosti con CSS, non
          smontati): CategoriesManager e UsersManager gestiscono la propria
          lista internamente, e smontarli ad ogni cambio tab la faceva
          ripartire dai dati iniziali della pagina, perdendo aggiunte o
          rimozioni fatte poco prima. */}
      <div style={{ display: tab === "azienda" ? "block" : "none" }}>
        <form className="panel" onSubmit={handleSubmit}>
          <h2>Dati aziendali</h2>
          <p className="hint" style={{ marginBottom: 14 }}>
            Questi dati compaiono nell&apos;intestazione dei documenti di noleggio generati in PDF.
          </p>
          <div className="field">
            <label>Ragione sociale</label>
            <input
              value={settings.ragioneSociale}
              onChange={(e) => setSettings({ ...settings, ragioneSociale: e.target.value })}
            />
          </div>
          <div className="field">
            <label>Indirizzo sede</label>
            <input
              value={settings.indirizzo}
              onChange={(e) => setSettings({ ...settings, indirizzo: e.target.value })}
            />
          </div>
          <div className="field-row">
            <div className="field">
              <label>Partita IVA</label>
              <input
                value={settings.partitaIva}
                onChange={(e) => setSettings({ ...settings, partitaIva: e.target.value })}
              />
            </div>
            <div className="field">
              <label>Telefono</label>
              <input
                value={settings.telefono}
                onChange={(e) => setSettings({ ...settings, telefono: e.target.value })}
              />
            </div>
          </div>

          <div className="field">
            <label>Logo aziendale</label>
            {settings.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={settings.logoUrl} alt="Logo aziendale" className="logo-preview" />
            ) : (
              <p className="hint">Nessun logo caricato: sui documenti verrà mostrata solo la ragione sociale in testo.</p>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleLogoChange}
              disabled={uploading}
              style={{ marginTop: 8 }}
            />
            {uploading ? <p className="hint">Caricamento…</p> : null}
          </div>

          <div className="field">
            <label>Condizioni generali (testo in corpo piccolo sui documenti)</label>
            <textarea
              rows={4}
              value={settings.condizioniGenerali}
              onChange={(e) => setSettings({ ...settings, condizioniGenerali: e.target.value })}
            />
            <p className="hint">
              Segnaposto: fai rivedere questo testo da un commercialista o consulente prima di
              usarlo con i clienti — non è una clausola legale già verificata.
            </p>
          </div>

          <div className="card-actions">
            <button className="btn primary" type="submit" disabled={saving}>
              {saving ? "Salvataggio…" : "Salva impostazioni"}
            </button>
          </div>
        </form>
      </div>

      <div style={{ display: tab === "categorie" ? "block" : "none" }}>
        <CategoriesManager initialCategories={initialCategories} />
      </div>

      <div style={{ display: tab === "utenti" ? "block" : "none" }}>
        <UsersManager initialUsers={initialUsers} />
      </div>

      <Toast message={toast} />
    </div>
  );
}
