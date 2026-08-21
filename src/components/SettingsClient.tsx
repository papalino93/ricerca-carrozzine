"use client";

import { useRef, useState } from "react";
import type { CompanySettings } from "@/lib/settings";
import type { AdminUser } from "@/lib/users";
import { BrandHeader } from "./BrandHeader";
import { UsersManager } from "./UsersManager";

interface SettingsClientProps {
  initialSettings: CompanySettings;
  initialUsers: AdminUser[];
}

export function SettingsClient({ initialSettings, initialUsers }: SettingsClientProps) {
  const [settings, setSettings] = useState(initialSettings);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/upload-logo", { method: "POST", body: form });
      const body = await res.json();
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
    setSuccess(false);
    try {
      const res = await fetch("/api/impostazioni", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Salvataggio non riuscito");
      setSuccess(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="wrap">
      <BrandHeader logoUrl={settings.logoUrl} eyebrow="Amministrazione" />
      <header className="page-header">
        <div className="top-nav">
          <h1>Impostazioni azienda</h1>
          <a href="/admin">← Dispositivi</a>
        </div>
        <p className="sub">
          Questi dati compaiono nell&apos;intestazione dei documenti di noleggio generati in PDF.
        </p>
      </header>

      {error ? <div className="banner error">{error}</div> : null}
      {success ? <div className="banner success">Impostazioni salvate.</div> : null}

      <form className="panel" onSubmit={handleSubmit}>
        <h2>Dati aziendali</h2>
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

      <UsersManager initialUsers={initialUsers} />
    </div>
  );
}
