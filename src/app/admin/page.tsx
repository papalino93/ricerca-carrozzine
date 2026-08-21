import { listDevices } from "@/lib/devices";
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

  return <AdminDevicesClient initialDevices={devices} />;
}
