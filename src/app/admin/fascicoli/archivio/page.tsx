import { listFascicoli } from "@/lib/fascicoli";
import { FascicoliArchivioClient } from "@/components/FascicoliArchivioClient";

export const dynamic = "force-dynamic";

export default async function FascicoliArchivioPage() {
  const fascicoli = await listFascicoli().catch(() => []);
  return <FascicoliArchivioClient fascicoli={fascicoli} />;
}
