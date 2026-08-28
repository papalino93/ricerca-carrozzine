import { listClients } from "@/lib/clients";
import { listDevices } from "@/lib/devices";
import { getSettingsSafe } from "@/lib/settings";
import { FrontBar } from "@/components/FrontBar";
import { ClientsClient } from "@/components/ClientsClient";

export const dynamic = "force-dynamic";

export default async function FrontClientiPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const [{ q }, clients, devices, settings] = await Promise.all([
    searchParams,
    listClients().catch(() => []),
    listDevices().catch(() => []),
    getSettingsSafe(),
  ]);

  return (
    <>
      <FrontBar logoUrl={settings.logoUrl} />
      <ClientsClient clients={clients} devices={devices} contesto="banco" initialQuery={q} />
    </>
  );
}
