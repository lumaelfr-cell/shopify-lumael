import { useBuilderStore } from '../../store/useBuilderStore'

export default function InfosStep() {
  const { siteName, tagline, setSiteName, setTagline } = useBuilderStore()

  return (
    <div>
      <h2 className="font-display text-2xl font-semibold text-white">Informations de la boutique</h2>
      <p className="mt-1 text-sm text-white/50">Personnalise le nom et l'accroche affichés sur ton site.</p>

      <div className="mt-6 space-y-5">
        <div>
          <label className="text-xs font-medium uppercase tracking-wide text-white/40">Nom de la boutique</label>
          <input
            value={siteName}
            onChange={(e) => setSiteName(e.target.value)}
            maxLength={40}
            className="mt-2 w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white outline-none transition-colors focus:border-white/30"
            placeholder="Ex. Velvet Atelier"
          />
        </div>
        <div>
          <label className="text-xs font-medium uppercase tracking-wide text-white/40">Accroche principale</label>
          <textarea
            value={tagline}
            onChange={(e) => setTagline(e.target.value)}
            maxLength={80}
            rows={3}
            className="mt-2 w-full resize-none rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white outline-none transition-colors focus:border-white/30"
            placeholder="Ex. Le luxe discret, taillé pour durer."
          />
          <p className="mt-1 text-right text-[11px] text-white/30">{tagline.length}/80</p>
        </div>
      </div>
    </div>
  )
}
