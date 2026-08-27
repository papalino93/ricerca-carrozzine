import { listCommesse } from "@/lib/commesse";
import { getSettings } from "@/lib/settings";
import { FrontBar } from "@/components/FrontBar";
import { CommesseClient } from "@/components/CommesseClient";

export const dynamic = "force-dynamic";

export default async function FrontCommessePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const [{ q }, commesse, settings] = await Promise.all([
    searchParams,
    listCommesse().catch(() => []),
    getSettings(),
  ]);
  return (
    <>
      <FrontBar logoUrl={settings.logoUrl} />
      <CommesseClient
        initialCommesse={commesse}
        puntiPerEuro={settings.puntiPerEuro}
        initialQuery={q}
      />
    </>
  );
}
