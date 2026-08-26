import { listDevices } from "@/lib/devices";
import { listCategories } from "@/lib/categories";
import { listTariffe } from "@/lib/tariffe";
import { AdminDevicesClient } from "@/components/AdminDevicesClient";

export const dynamic = "force-dynamic";

export default async function MagazzinoPage() {
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

  const categories = await listCategories().catch(() => []);
  const tariffe = await listTariffe().catch(() => []);

  return <AdminDevicesClient initialDevices={devices} categories={categories} tariffe={tariffe} />;
}
