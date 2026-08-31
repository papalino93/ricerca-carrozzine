import { listCommesse } from "@/lib/commesse";
import { listClients } from "@/lib/clients";
import { getSettings } from "@/lib/settings";
import { CommesseClient } from "@/components/CommesseClient";

export const dynamic = "force-dynamic";

export default async function CommessePage() {
  const [commesse, settings, clients] = await Promise.all([
    listCommesse().catch(() => []),
    getSettings(),
    listClients().catch(() => []),
  ]);
  const clienti = clients.map((c) => ({ nome: c.nome, telefono: c.telefono || c.cellulare || null }));
  return <CommesseClient initialCommesse={commesse} puntiPerEuro={settings.puntiPerEuro} clienti={clienti} />;
}
