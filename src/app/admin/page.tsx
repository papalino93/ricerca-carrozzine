import { listDevices } from "@/lib/devices";
import { listCategories } from "@/lib/categories";
import { listTariffe } from "@/lib/tariffe";
import { listClients } from "@/lib/clients";
import { AdminDevicesClient } from "@/components/AdminDevicesClient";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  // Sono letture indipendenti dello stesso caricamento: avviarle insieme
  // evita che l'apertura del magazzino sommi i tempi di più richieste a
  // Google Sheets, soprattutto quando l'istanza server è appena partita.
  const [devicesResult, categories, tariffe, clients] = await Promise.all([
    listDevices().then(
      (devices) => ({ devices, error: null as string | null }),
      (err: unknown) => ({
        devices: [] as Awaited<ReturnType<typeof listDevices>>,
        error: err instanceof Error ? err.message : "Errore imprevisto",
      })
    ),
    listCategories().catch(() => []),
    listTariffe().catch(() => []),
    listClients().catch(() => []),
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

  const clienti = clients.map((c) => ({ nome: c.nome, telefono: c.telefono || c.cellulare || null }));

  return (
    <AdminDevicesClient
      initialDevices={devicesResult.devices}
      categories={categories}
      tariffe={tariffe}
      clienti={clienti}
    />
  );
}
