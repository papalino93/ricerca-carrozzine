import { listDevices } from "@/lib/devices";
import { toPublicDevice } from "@/lib/device-types";
import { getSettings } from "@/lib/settings";
import { listCategories } from "@/lib/categories";
import { SearchClient } from "@/components/SearchClient";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  let devices: Awaited<ReturnType<typeof listDevices>> = [];
  let loadError: string | null = null;
  try {
    devices = await listDevices();
  } catch (err) {
    loadError = (err as Error).message;
  }

  if (loadError) {
    return (
      <div className="wrap">
        <div className="banner error">
          Impossibile leggere il magazzino da Google Sheets: {loadError}
        </div>
      </div>
    );
  }

  const logoUrl = await getSettings()
    .then((s) => s.logoUrl || null)
    .catch(() => null);
  const categories = await listCategories().catch(() => []);

  return (
    <SearchClient
      initialDevices={devices.map(toPublicDevice)}
      logoUrl={logoUrl}
      categories={categories}
    />
  );
}
