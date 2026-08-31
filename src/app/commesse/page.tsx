import { listCommesse } from "@/lib/commesse";
import { listClients } from "@/lib/clients";
import { FrontBar } from "@/components/FrontBar";
import { CommesseBanco } from "@/components/CommesseBanco";

export const dynamic = "force-dynamic";

export default async function FrontCommessePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const [{ q }, commesse, clients] = await Promise.all([
    searchParams,
    listCommesse().catch(() => []),
    listClients().catch(() => []),
  ]);
  const clienti = clients.map((c) => ({ nome: c.nome, telefono: c.telefono || c.cellulare || null }));
  return (
    <>
      <FrontBar />
      <CommesseBanco initialCommesse={commesse} initialQuery={q} clienti={clienti} />
    </>
  );
}
