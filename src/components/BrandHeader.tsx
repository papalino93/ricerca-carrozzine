interface BrandHeaderProps {
  logoUrl?: string | null;
  eyebrow: string;
}

export function BrandHeader({ logoUrl, eyebrow }: BrandHeaderProps) {
  return (
    <div className="brand-header">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={logoUrl || "/logo.png"} alt="" />
      <div className="tag">
        <p className="eyebrow">{eyebrow}</p>
        <div className="name">Ricerca Ausili</div>
      </div>
    </div>
  );
}
