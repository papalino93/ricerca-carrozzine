import { listClients } from "@/lib/clients";
import { getSettingsSafe } from "@/lib/settings";
import { FidelityView } from "@/components/FidelityView";

export const dynamic = "force-dynamic";

export default async function FidelityPage() {
  const [clients, settings] = await Promise.all([
    listClients().catch(() => []),
    // Safe: le impostazioni qui sono solo logo e regole fedeltà (contorno),
    // non deve far crashare l'intera pagina se il foglio non risponde.
    getSettingsSafe(),
  ]);

  return (
    <FidelityView
      clients={clients}
      settings={settings}
      commesseHref="/admin/commesse"
      clientiHref="/admin/clienti"
    />
  );
}
