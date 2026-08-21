import { getSettings } from "@/lib/settings";
import { listUsers } from "@/lib/users";
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

  // Se il foglio Utenti non è ancora leggibile per qualche motivo, non
  // blocchiamo l'intera pagina Impostazioni: la sezione utenti parte vuota.
  const users = await listUsers().catch(() => []);

  return <SettingsClient initialSettings={settings} initialUsers={users} />;
}
