import { getSettings } from "@/lib/settings";
import { listUsers } from "@/lib/users";
import { listCategories } from "@/lib/categories";
import { listTariffe } from "@/lib/tariffe";
import { getSnapshotStatus } from "@/lib/snapshot";
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

  // Se il foglio Utenti/Categorie non è ancora leggibile per qualche motivo,
  // non blocchiamo l'intera pagina Impostazioni: quella sezione parte vuota.
  const users = await listUsers().catch(() => []);
  const categories = await listCategories().catch(() => []);
  const tariffe = await listTariffe().catch(() => []);
  const backupStatus = await getSnapshotStatus().catch(() => ({
    primario: { ultimo: null, totale: 0 },
    secondario: { configurato: false, ultimo: null, totale: 0 },
  }));

  return (
    <SettingsClient
      initialSettings={settings}
      initialUsers={users}
      initialCategories={categories}
      initialTariffe={tariffe}
      initialBackupStatus={backupStatus}
    />
  );
}
