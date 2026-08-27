interface BrandHeaderProps {
  logoUrl?: string | null;
  eyebrow: string;
}

export function BrandHeader({ logoUrl, eyebrow }: BrandHeaderProps) {
  return (
    <div className="brand-header">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={logoUrl || "/logo.png"} alt="" />
      {/* Il nome "Ricerca Ausili" è sparito da qui come dal resto del
          gestionale: il logo Medical Center dice già di chi è il negozio, e
          il sottotitolo dice in che pagina si è. Un secondo marchio in mezzo
          ai due non aggiungeva niente. */}
      <div className="tag">
        <div className="name">{eyebrow}</div>
      </div>
    </div>
  );
}
