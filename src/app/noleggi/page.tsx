import { listDevices } from "@/lib/devices";
import { toPublicDevice } from "@/lib/device-types";
import { getSettings } from "@/lib/settings";
import { listCategories } from "@/lib/categories";
import { listTariffe } from "@/lib/tariffe";
import { SearchClient } from "@/components/SearchClient";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  // Le letture sono indipendenti fra loro: eseguirle in parallelo invece
  // che in serie evita di sommare più round-trip verso Google Sheets a
  // ogni apertura della pagina.
  const [devicesResult, logoUrl, categories, tariffe] = await Promise.all([
    listDevices().then(
      (d) => ({ devices: d, error: null as string | null }),
      (err: Error) => ({
        devices: [] as Awaited<ReturnType<typeof listDevices>>,
        error: err.message,
      })
    ),
    getSettings()
      .then((s) => s.logoUrl || null)
      .catch(() => null),
    listCategories().catch(() => []),
    listTariffe().catch(() => []),
  ]);

  if (devicesResult.error) {
    return (
      <div className="wrap">
        <div className="banner error">
          Impossibile leggere il magazzino da Google Sheets: {devicesResult.error}
        </div>
      </div>
    );
  }

  // Un dispositivo venduto/rottamato non è più noleggiabile: non deve
  // comparire nella ricerca pubblica, solo in admin (dietro conferma).
  const devices = devicesResult.devices.filter((d) => !d.archiviato);

  return (
    <SearchClient
      initialDevices={devices.map(toPublicDevice)}
      logoUrl={logoUrl}
      categories={categories}
      tariffe={tariffe}
    />
  );
}
