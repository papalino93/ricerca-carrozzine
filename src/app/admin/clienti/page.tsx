import { listClients } from "@/lib/clients";
import { listHistory } from "@/lib/history";
import { listDevices } from "@/lib/devices";
import { ClientsClient } from "@/components/ClientsClient";

export const dynamic = "force-dynamic";

// L'anagrafica si popola già da sola a ogni noleggio (vedi rentDevice in
// devices.ts) ma finora non era consultabile da nessuna parte: il dato
// c'era, mancava solo questa pagina.
export default async function ClientiPage() {
  const [clients, history, devices] = await Promise.all([
    listClients().catch(() => []),
    listHistory().catch(() => []),
    listDevices().catch(() => []),
  ]);

  return <ClientsClient clients={clients} history={history} devices={devices} />;
}
