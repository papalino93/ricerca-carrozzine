import { listDevices } from "@/lib/devices";
import { getSettings } from "@/lib/settings";
import { listCategories } from "@/lib/categories";
import { AdminDevicesClient } from "@/components/AdminDevicesClient";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
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

  return <AdminDevicesClient initialDevices={devices} logoUrl={logoUrl} categories={categories} />;
}
