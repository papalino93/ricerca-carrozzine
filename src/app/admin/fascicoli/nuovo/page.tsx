import { listClients } from "@/lib/clients";
import { listFascicoli } from "@/lib/fascicoli";
import { listCommesse } from "@/lib/commesse";
import { FascicoloNuovoClient } from "@/components/FascicoloNuovoClient";

export const dynamic = "force-dynamic";

export default async function NuovoFascicoloPage({
  searchParams,
}: {
  searchParams: Promise<{ cliente?: string }>;
}) {
  const [{ cliente }, clients, fascicoli, commesse] = await Promise.all([
    searchParams,
    listClients().catch(() => []),
    listFascicoli().catch(() => []),
    listCommesse().catch(() => []),
  ]);
  const commesseOptions = commesse.map((c) => ({ numero: c.numero, cliente: c.cliente }));

  return (
    <FascicoloNuovoClient
      clients={clients}
      fascicoli={fascicoli}
      commesse={commesseOptions}
      initialClienteNome={cliente}
    />
  );
}
