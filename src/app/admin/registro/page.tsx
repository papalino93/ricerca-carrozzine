import { listHistory } from "@/lib/history";
import { listDevices } from "@/lib/devices";
import { listDocumentLog } from "@/lib/documentLog";
import { RegistroClient } from "@/components/RegistroClient";

export const dynamic = "force-dynamic";

// Elenco di tutti i noleggi (uno per numero progressivo), letto dallo stesso
// Storico già usato dalla scheda dispositivo — qui semplicemente filtrato
// agli eventi "noleggio" e mostrato come registro unico, invece che sparso
// su decine di schede diverse.
export default async function RegistroPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const [{ q }, history, devices, documentLog] = await Promise.all([
    searchParams,
    listHistory().catch(() => []),
    listDevices().catch(() => []),
    listDocumentLog().catch(() => []),
  ]);

  const noleggi = history.filter((e) => e.evento === "noleggio");
  // Solo i verbali firmati digitalmente hanno un link Drive: la maggior
  // parte dei documenti generati "di carta" non compare qui, non serve
  // portarseli dietro fino al client per un dato che non useranno mai.
  const firmeDrive = documentLog.filter((d) => d.driveUrl);

  return <RegistroClient noleggi={noleggi} devices={devices} firmeDrive={firmeDrive} initialQuery={q} />;
}
