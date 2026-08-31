import { listClients } from "@/lib/clients";
import { listDevices } from "@/lib/devices";
import { FrontBar } from "@/components/FrontBar";
import { ClientsClient } from "@/components/ClientsClient";

export const dynamic = "force-dynamic";

export default async function FrontClientiPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const [{ q }, clients, devices] = await Promise.all([
    searchParams,
    listClients().catch(() => []),
    listDevices().catch(() => []),
  ]);

  return (
    <>
      <FrontBar />
      <ClientsClient clients={clients} devices={devices} contesto="banco" initialQuery={q} />
    </>
  );
}
