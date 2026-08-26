import { listClients } from "@/lib/clients";
import { getSettings } from "@/lib/settings";
import { FrontBar } from "@/components/FrontBar";
import { FidelityView } from "@/components/FidelityView";

export const dynamic = "force-dynamic";

export default async function FrontFidelityPage() {
  const [clients, settings] = await Promise.all([
    listClients().catch(() => []),
    getSettings(),
  ]);

  return (
    <>
      <FrontBar logoUrl={settings.logoUrl} />
      <FidelityView clients={clients} settings={settings} commesseHref="/commesse" clientiHref="/clienti" />
    </>
  );
}
