// E:\blog-fabio\src\components\admin\editor\RatingPicker.tsx
'use client';
import { formatRating } from '@/shared/review';

export function RatingPicker({ value, onChange }: { value: number | null; onChange: (v: number | null) => void }) {
  const v = value ?? 6;
  const step = (d: number) => onChange(Math.min(10, Math.max(0, Math.round((v + d) * 2) / 2)));
  return (
    <div>
      <div className="flex items-center gap-3">
        <button type="button" onClick={() => step(-0.5)} className="h-12 w-12 rounded-full border border-line bg-surface text-2xl" aria-label="Diminuisci di mezzo punto">−</button>
        <output className="min-w-24 text-center font-serif text-4xl text-accent-strong" aria-live="polite">
          {value === null ? '–' : formatRating(value)}<span className="text-lg text-muted"> / 10</span>
        </output>
        <button type="button" onClick={() => step(0.5)} className="h-12 w-12 rounded-full border border-line bg-surface text-2xl" aria-label="Aumenta di mezzo punto">+</button>
      </div>
      <label className="sr-only" htmlFor="rating-range">Voto da 0 a 10</label>
      <input
        id="rating-range" type="range" min={0} max={10} step={0.5} value={v}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-3 w-full max-w-sm accent-[#345A6C]"
        aria-valuetext={`${formatRating(v)} su 10`}
      />
      {value === null ? (
        <p className="mt-1 text-sm text-muted">Nessun voto scelto: tocca + o − oppure trascina.</p>
      ) : (
        <button type="button" onClick={() => onChange(null)} className="mt-1 text-sm text-muted underline">Togli il voto</button>
      )}
    </div>
  );
}
