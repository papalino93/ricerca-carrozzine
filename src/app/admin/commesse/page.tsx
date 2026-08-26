import { listCommesse } from "@/lib/commesse";
import { CommesseClient } from "@/components/CommesseClient";

export const dynamic = "force-dynamic";

export default async function CommessePage() {
  const commesse = await listCommesse().catch(() => []);
  return <CommesseClient initialCommesse={commesse} />;
}
