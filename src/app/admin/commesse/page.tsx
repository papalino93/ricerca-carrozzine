import { listCommesse } from "@/lib/commesse";
import { getSettings } from "@/lib/settings";
import { CommesseClient } from "@/components/CommesseClient";

export const dynamic = "force-dynamic";

export default async function CommessePage() {
  const [commesse, settings] = await Promise.all([
    listCommesse().catch(() => []),
    getSettings(),
  ]);
  return <CommesseClient initialCommesse={commesse} puntiPerEuro={settings.puntiPerEuro} />;
}
