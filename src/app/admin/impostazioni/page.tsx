import { getSettings } from "@/lib/settings";
import { listUsers } from "@/lib/users";
import { listCategories } from "@/lib/categories";
import { listTariffe } from "@/lib/tariffe";
import { getSnapshotStatus } from "@/lib/snapshot";
import { SettingsClient } from "@/components/SettingsClient";

export const dynamic = "force-dynamic";

export default async function ImpostazioniPage() {
  // Le sezioni della pagina non dipendono una dall'altra: una sola attesa
  // parallela evita quattro round-trip consecutivi verso Google Sheets.
  let pageData: {
    settings: Awaited<ReturnType<typeof getSettings>>;
    users: Awaited<ReturnType<typeof listUsers>>;
    categories: Awaited<ReturnType<typeof listCategories>>;
    tariffe: Awaited<ReturnType<typeof listTariffe>>;
    backupStatus: Awaited<ReturnType<typeof getSnapshotStatus>>;
  };
  try {
    const [settings, users, categories, tariffe, backupStatus] = await Promise.all([
      getSettings(),
      listUsers().catch(() => []),
      listCategories().catch(() => []),
      listTariffe().catch(() => []),
      getSnapshotStatus().catch(() => ({
        primario: { ultimo: null, giorni: 0 },
        secondario: { configurato: false, ultimo: null, giorni: 0 },
      })),
    ]);
    pageData = { settings, users, categories, tariffe, backupStatus };
  } catch (err) {
    return (
      <div className="wrap">
        <div className="banner error">
          Impossibile leggere le impostazioni da Google Sheets: {(err as Error).message}
        </div>
      </div>
    );
  }

  return (
    <SettingsClient
      initialSettings={pageData.settings}
      initialUsers={pageData.users}
      initialCategories={pageData.categories}
      initialTariffe={pageData.tariffe}
      initialBackupStatus={pageData.backupStatus}
    />
  );
}
