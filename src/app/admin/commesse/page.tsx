import { listCommesse } from "@/lib/commesse";
import { listClients } from "@/lib/clients";
import { getSettingsSafe } from "@/lib/settings";
import { listOperatori } from "@/lib/operatori";
import { CommesseClient } from "@/components/CommesseClient";

export const dynamic = "force-dynamic";

export default async function CommessePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const [{ q }, commesse, settings, clients, operatori] = await Promise.all([
    searchParams,
    listCommesse().catch(() => []),
    // Safe: qui le impostazioni servono solo per "puntiPerEuro" (contorno),
    // non deve far crashare l'intera pagina se il foglio non risponde.
    getSettingsSafe(),
    listClients().catch(() => []),
    listOperatori().catch(() => []),
  ]);
  const clienti = clients.map((c) => ({ nome: c.nome, telefono: c.telefono || c.cellulare || null }));
  return (
    <CommesseClient
      initialCommesse={commesse}
      initialQuery={q}
      puntiPerEuro={settings.puntiPerEuro}
      clienti={clienti}
      operatori={operatori}
    />
  );
}
