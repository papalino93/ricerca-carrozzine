import { FrontBar } from "@/components/FrontBar";
import { PageSkeleton } from "@/components/PageSkeleton";

/** Vedi PageSkeleton: senza questo file il clic su "Vedi tutto" sembra non
 *  fare nulla finché Google Sheets non risponde. */
export default function Loading() {
  return (
    <>
      <FrontBar />
      <PageSkeleton />
    </>
  );
}
