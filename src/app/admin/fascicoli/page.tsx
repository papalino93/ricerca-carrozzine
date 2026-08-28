import { listFascicoli } from "@/lib/fascicoli";
import { listClients } from "@/lib/clients";
import { FascicoliDashboardClient } from "@/components/FascicoliDashboardClient";

export const dynamic = "force-dynamic";

export default async function FascicoliPage() {
  const [fascicoli, clients] = await Promise.all([
    listFascicoli().catch(() => []),
    listClients().catch(() => []),
  ]);
  return <FascicoliDashboardClient fascicoli={fascicoli} clients={clients} />;
}
