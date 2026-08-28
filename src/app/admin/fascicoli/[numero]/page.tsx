import { notFound } from "next/navigation";
import { getFascicolo } from "@/lib/fascicoli";
import { listClients, normalizeName, EMPTY_CLIENT_TEMPLATE } from "@/lib/clients";
import { FascicoloEditorClient } from "@/components/FascicoloEditorClient";

export const dynamic = "force-dynamic";

export default async function FascicoloPage({ params }: { params: Promise<{ numero: string }> }) {
  const { numero } = await params;

  let fascicolo;
  try {
    fascicolo = await getFascicolo(numero);
  } catch (err) {
    return (
      <div className="wrap">
        <div className="banner error">Impossibile leggere il fascicolo da Google Sheets: {(err as Error).message}</div>
      </div>
    );
  }
  if (!fascicolo) notFound();

  const clients = await listClients().catch(() => []);
  const cliente =
    clients.find((c) => normalizeName(c.nome) === normalizeName(fascicolo.clienteNome)) ??
    EMPTY_CLIENT_TEMPLATE(fascicolo.clienteNome, fascicolo.clienteCF);

  return <FascicoloEditorClient initialFascicolo={fascicolo} initialCliente={cliente} />;
}
