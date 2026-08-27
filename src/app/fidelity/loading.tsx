import { FrontBar } from "@/components/FrontBar";
import { PageSkeleton } from "@/components/PageSkeleton";

/** Vedi PageSkeleton: senza questo file il clic sembra non fare nulla
 *  finché Google Sheets non risponde. La FrontBar è qui dentro apposta,
 *  così il tasto "← Home" è disponibile fin dal primo istante. */
export default function Loading() {
  return (
    <>
      <FrontBar />
      <PageSkeleton />
    </>
  );
}
