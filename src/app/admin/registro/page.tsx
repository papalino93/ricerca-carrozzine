import { listHistory } from "@/lib/history";
import { listDevices } from "@/lib/devices";
import { RegistroClient } from "@/components/RegistroClient";

export const dynamic = "force-dynamic";

// Elenco di tutti i noleggi (uno per numero progressivo), letto dallo stesso
// Storico già usato dalla scheda dispositivo — qui semplicemente filtrato
// agli eventi "noleggio" e mostrato come registro unico, invece che sparso
// su decine di schede diverse.
export default async function RegistroPage() {
  const [history, devices] = await Promise.all([
    listHistory().catch(() => []),
    listDevices().catch(() => []),
  ]);

  const noleggi = history.filter((e) => e.evento === "noleggio");

  return <RegistroClient noleggi={noleggi} devices={devices} />;
}
