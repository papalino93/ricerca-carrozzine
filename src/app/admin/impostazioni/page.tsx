import { getSettings } from "@/lib/settings";
import { SettingsClient } from "@/components/SettingsClient";

export const dynamic = "force-dynamic";

export default async function ImpostazioniPage() {
  let settings: Awaited<ReturnType<typeof getSettings>>;
  try {
    settings = await getSettings();
  } catch (err) {
    return (
      <div className="wrap">
        <div className="banner error">
          Impossibile leggere le impostazioni da Google Sheets: {(err as Error).message}
        </div>
      </div>
    );
  }

  return <SettingsClient initialSettings={settings} />;
}
