import { listClients } from "@/lib/clients";
import { getSettingsSafe } from "@/lib/settings";
import { FrontBar } from "@/components/FrontBar";
import { FidelityView } from "@/components/FidelityView";

export const dynamic = "force-dynamic";

export default async function FrontFidelityPage() {
  const [clients, settings] = await Promise.all([
    listClients().catch(() => []),
    getSettingsSafe(),
  ]);

  return (
    <>
      <FrontBar />
      <FidelityView clients={clients} settings={settings} commesseHref="/commesse" clientiHref="/clienti" />
    </>
  );
}
