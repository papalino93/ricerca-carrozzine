import { listCommesse } from "@/lib/commesse";
import { getSettings } from "@/lib/settings";
import { FrontBar } from "@/components/FrontBar";
import { CommesseClient } from "@/components/CommesseClient";

export const dynamic = "force-dynamic";

export default async function FrontCommessePage() {
  const [commesse, settings] = await Promise.all([
    listCommesse().catch(() => []),
    getSettings(),
  ]);
  return (
    <>
      <FrontBar logoUrl={settings.logoUrl} />
      <CommesseClient initialCommesse={commesse} puntiPerEuro={settings.puntiPerEuro} />
    </>
  );
}
