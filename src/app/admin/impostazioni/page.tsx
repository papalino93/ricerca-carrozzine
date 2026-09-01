import { cookies } from "next/headers";
import { getSettings } from "@/lib/settings";
import { listUsers } from "@/lib/users";
import { listCategories } from "@/lib/categories";
import { listTariffe } from "@/lib/tariffe";
import { getSnapshotStatus } from "@/lib/snapshot";
import { listTwoFactorUsernames } from "@/lib/twofactor";
import { readSessionToken, SESSION_COOKIE } from "@/lib/session";
import { SettingsClient } from "@/components/SettingsClient";

export const dynamic = "force-dynamic";

export default async function ImpostazioniPage() {
  const cookieStore = await cookies();
  const currentUsername = readSessionToken(cookieStore.get(SESSION_COOKIE)?.value)?.username ?? "";

  // Le sezioni della pagina non dipendono una dall'altra: una sola attesa
  // parallela evita più round-trip consecutivi verso Google Sheets.
  let pageData: {
    settings: Awaited<ReturnType<typeof getSettings>>;
    users: Awaited<ReturnType<typeof listUsers>>;
    categories: Awaited<ReturnType<typeof listCategories>>;
    tariffe: Awaited<ReturnType<typeof listTariffe>>;
    backupStatus: Awaited<ReturnType<typeof getSnapshotStatus>>;
    twoFactorUsernames: string[];
  };
  try {
    const [settings, users, categories, tariffe, backupStatus, twoFactorUsernames] = await Promise.all([
      getSettings(),
      listUsers().catch(() => []),
      listCategories().catch(() => []),
      listTariffe().catch(() => []),
      getSnapshotStatus().catch(() => ({
        primario: { ultimo: null, giorni: 0 },
        secondario: { configurato: false, ultimo: null, giorni: 0 },
      })),
      listTwoFactorUsernames().catch(() => []),
    ]);
    pageData = { settings, users, categories, tariffe, backupStatus, twoFactorUsernames };
  } catch (err) {
    return (
      <div className="wrap">
        <div className="banner error">
          Impossibile leggere le impostazioni da Google Sheets: {(err as Error).message}
        </div>
      </div>
    );
  }

  const normalized = pageData.twoFactorUsernames.map((u) => u.toLowerCase());

  return (
    <SettingsClient
      initialSettings={pageData.settings}
      initialUsers={pageData.users}
      initialCategories={pageData.categories}
      initialTariffe={pageData.tariffe}
      initialBackupStatus={pageData.backupStatus}
      currentUsername={currentUsername}
      currentUserTwoFactorEnabled={normalized.includes(currentUsername.toLowerCase())}
      twoFactorUsernames={pageData.twoFactorUsernames}
    />
  );
}
