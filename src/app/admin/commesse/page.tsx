import { listCommesse } from "@/lib/commesse";
import { listClients } from "@/lib/clients";
import { getSettings } from "@/lib/settings";
import { CommesseClient } from "@/components/CommesseClient";

export const dynamic = "force-dynamic";

export default async function CommessePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const [{ q }, commesse, settings, clients] = await Promise.all([
    searchParams,
    listCommesse().catch(() => []),
    getSettings(),
    listClients().catch(() => []),
  ]);
  const clienti = clients.map((c) => ({ nome: c.nome, telefono: c.telefono || c.cellulare || null }));
  return (
    <CommesseClient initialCommesse={commesse} initialQuery={q} puntiPerEuro={settings.puntiPerEuro} clienti={clienti} />
  );
}
