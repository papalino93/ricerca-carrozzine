import { listDevices } from "@/lib/devices";
import { listCategories } from "@/lib/categories";
import { listTariffe } from "@/lib/tariffe";
import { AdminDevicesClient } from "@/components/AdminDevicesClient";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  // Sono letture indipendenti dello stesso caricamento: avviarle insieme
  // evita che l'apertura del magazzino sommi i tempi di tre richieste a
  // Google Sheets, soprattutto quando l'istanza server è appena partita.
  const [devicesResult, categories, tariffe] = await Promise.all([
    listDevices().then(
      (devices) => ({ devices, error: null as string | null }),
      (err: unknown) => ({
        devices: [] as Awaited<ReturnType<typeof listDevices>>,
        error: err instanceof Error ? err.message : "Errore imprevisto",
      })
    ),
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

  return <AdminDevicesClient initialDevices={devicesResult.devices} categories={categories} tariffe={tariffe} />;
}
