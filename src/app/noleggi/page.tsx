import { listDevices } from "@/lib/devices";
import { listCategories } from "@/lib/categories";
import { listTariffe } from "@/lib/tariffe";
import { SearchClient } from "@/components/SearchClient";
import { FrontBar } from "@/components/FrontBar";

export const dynamic = "force-dynamic";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  // Le letture sono indipendenti fra loro: eseguirle in parallelo invece
  // che in serie evita di sommare più round-trip verso Google Sheets a
  // ogni apertura della pagina.
  const [devicesResult, categories, tariffe] = await Promise.all([
    listDevices().then(
      (d) => ({ devices: d, error: null as string | null }),
      (err: Error) => ({
        devices: [] as Awaited<ReturnType<typeof listDevices>>,
        error: err.message,
      })
    ),
    listCategories().catch(() => []),
    listTariffe().catch(() => []),
  ]);

  if (devicesResult.error) {
    // Anche qui la FrontBar: senza, da una pagina in errore non ci sarebbe
    // modo di tornare alla home se non con il tasto indietro del browser.
    return (
      <>
        <FrontBar />
        <div className="wrap">
          <div className="banner error">
            Impossibile leggere il magazzino da Google Sheets: {devicesResult.error}
          </div>
        </div>
      </>
    );
  }

  // Un dispositivo venduto/rottamato non è più noleggiabile: non deve
  // comparire nella ricerca pubblica, solo in admin (dietro conferma).
  const devices = devicesResult.devices.filter((d) => !d.archiviato);

  return (
    <>
      <FrontBar />
      <SearchClient
        initialDevices={devices}
        categories={categories}
        tariffe={tariffe}
        initialQuery={q}
      />
    </>
  );
}
