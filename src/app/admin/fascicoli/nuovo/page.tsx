import { listClients } from "@/lib/clients";
import { listFascicoli } from "@/lib/fascicoli";
import { FascicoloNuovoClient } from "@/components/FascicoloNuovoClient";

export const dynamic = "force-dynamic";

export default async function NuovoFascicoloPage({
  searchParams,
}: {
  searchParams: Promise<{ cliente?: string }>;
}) {
  const [{ cliente }, clients, fascicoli] = await Promise.all([
    searchParams,
    listClients().catch(() => []),
    listFascicoli().catch(() => []),
  ]);

  return <FascicoloNuovoClient clients={clients} fascicoli={fascicoli} initialClienteNome={cliente} />;
}
