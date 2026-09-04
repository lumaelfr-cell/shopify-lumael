import { fontPairings, layoutStyles } from '../../data/fonts'
import { useBuilderStore } from '../../store/useBuilderStore'

export default function StyleStep() {
  const { fontId, layoutId, setFont, setLayout } = useBuilderStore()

  return (
    <div className="space-y-8">
      <div>
        <h2 className="font-display text-2xl font-semibold text-white">Typographie</h2>
        <p className="mt-1 text-sm text-white/50">Le duo de polices qui donnera le ton à ta boutique.</p>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          {fontPairings.map((f) => {
            const active = f.id === fontId
            return (
              <button
                key={f.id}
                onClick={() => setFont(f.id)}
                className={`rounded-2xl border p-4 text-left transition-colors ${
                  active ? 'border-white/40 bg-white/10' : 'border-white/8 bg-white/[0.03] hover:bg-white/[0.06]'
                }`}
              >
                <p className={`${f.headingClass} text-xl font-semibold text-white`}>Aa</p>
                <p className="mt-2 text-sm font-medium text-white/80">{f.name}</p>
                <p className="text-[11px] text-white/40">{f.heading}</p>
              </button>
            )
          })}
        </div>
      </div>

      <div>
        <h2 className="font-display text-2xl font-semibold text-white">Mise en page</h2>
        <p className="mt-1 text-sm text-white/50">La structure visuelle de ta page d'accueil.</p>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          {layoutStyles.map((l) => {
            const active = l.id === layoutId
            return (
              <button
                key={l.id}
                onClick={() => setLayout(l.id)}
                className={`rounded-2xl border p-4 text-left transition-colors ${
                  active ? 'border-white/40 bg-white/10' : 'border-white/8 bg-white/[0.03] hover:bg-white/[0.06]'
                }`}
              >
                <p className="text-sm font-semibold text-white">{l.name}</p>
                <p className="mt-1 text-[11px] leading-relaxed text-white/45">{l.description}</p>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
