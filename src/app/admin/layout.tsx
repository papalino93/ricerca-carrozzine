import { getSettings } from "@/lib/settings";
import { AdminSidebar } from "@/components/AdminSidebar";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const logoUrl = await getSettings()
    .then((s) => s.logoUrl || null)
    .catch(() => null);

  return (
    <div className="admin-shell">
      <AdminSidebar logoUrl={logoUrl} />
      <div className="admin-main">{children}</div>
    </div>
  );
}
