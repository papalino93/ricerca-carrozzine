import { listClients } from "@/lib/clients";
import { listDevices } from "@/lib/devices";
import { ClientsClient } from "@/components/ClientsClient";

export const dynamic = "force-dynamic";

// L'anagrafica si popola già da sola a ogni noleggio (vedi rentDevice in
// devices.ts) ma finora non era consultabile da nessuna parte: il dato
// c'era, mancava solo questa pagina.
export default async function ClientiPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const [{ q }, clients, devices] = await Promise.all([
    searchParams,
    listClients().catch(() => []),
    listDevices().catch(() => []),
  ]);

  return <ClientsClient clients={clients} devices={devices} initialQuery={q} />;
}
