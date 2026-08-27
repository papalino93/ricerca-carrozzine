import { listCommesse } from "@/lib/commesse";
import { getSettingsSafe } from "@/lib/settings";
import { FrontBar } from "@/components/FrontBar";
import { CommesseBanco } from "@/components/CommesseBanco";

export const dynamic = "force-dynamic";

export default async function FrontCommessePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const [{ q }, commesse, settings] = await Promise.all([
    searchParams,
    listCommesse().catch(() => []),
    getSettingsSafe(),
  ]);
  return (
    <>
      <FrontBar logoUrl={settings.logoUrl} />
      <CommesseBanco initialCommesse={commesse} initialQuery={q} />
    </>
  );
}
