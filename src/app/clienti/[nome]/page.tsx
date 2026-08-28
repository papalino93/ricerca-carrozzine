import { notFound } from "next/navigation";
import { listClients, normalizeName } from "@/lib/clients";
import { listHistory } from "@/lib/history";
import { listDevices } from "@/lib/devices";
import { listFascicoliCliente } from "@/lib/fascicoli";
import { getSettingsSafe } from "@/lib/settings";
import { FrontBar } from "@/components/FrontBar";
import { ClientDetailClient } from "@/components/ClientDetailClient";

export const dynamic = "force-dynamic";

// Hub di un singolo cliente: prima i suoi dati erano sparsi (anagrafica solo
// nella riga espansa di /clienti, fascicoli plantari solo nell'archivio
// fascicoli filtrato a mano, storico noleggi anche lì) — con l'anagrafica
// cresciuta (CF, nascita, indirizzo) per servire anche i Fascicoli Plantari,
// una riga di tabella non bastava più. Raggiungibile sia dal banco
// (/clienti) sia dall'amministrazione (/admin/clienti): un solo livello di
// accesso in tutta l'app (vedi proxy.ts), stessa pagina per entrambi.
export default async function ClienteDetailPage({ params }: { params: Promise<{ nome: string }> }) {
  const { nome: nomeParam } = await params;
  const nome = decodeURIComponent(nomeParam);

  const [clients, history, devices, fascicoli, settings] = await Promise.all([
    listClients().catch(() => []),
    listHistory().catch(() => []),
    listDevices().catch(() => []),
    listFascicoliCliente(nome).catch(() => []),
    getSettingsSafe(),
  ]);

  const client = clients.find((c) => normalizeName(c.nome) === normalizeName(nome));
  if (!client) notFound();

  const clientHistory = history.filter((e) => normalizeName(e.cliente ?? "") === normalizeName(client.nome));
  const currentDevice =
    devices.find((d) => d.stato === "noleggiato" && normalizeName(d.cliente ?? "") === normalizeName(client.nome)) ??
    null;

  return (
    <>
      <FrontBar logoUrl={settings.logoUrl} />
      <ClientDetailClient
        initialClient={client}
        history={clientHistory}
        currentDevice={currentDevice}
        fascicoli={fascicoli}
      />
    </>
  );
}
