import { listClients } from "@/lib/clients";
import { listHistory } from "@/lib/history";
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
  const [{ q }, clients, history, devices, settings] = await Promise.all([
    searchParams,
    listClients().catch(() => []),
    listHistory().catch(() => []),
    listDevices().catch(() => []),
    getSettingsSafe(),
  ]);

  return (
    <>
      <FrontBar logoUrl={settings.logoUrl} />
      <ClientsClient
        clients={clients}
        history={history}
        devices={devices}
        contesto="banco"
        initialQuery={q}
      />
    </>
  );
}
