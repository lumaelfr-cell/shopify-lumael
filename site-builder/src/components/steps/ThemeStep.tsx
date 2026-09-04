import { Check } from 'lucide-react'
import { palettes } from '../../data/palettes'
import { useBuilderStore } from '../../store/useBuilderStore'

export default function ThemeStep() {
  const { paletteId, useCustomColors, selectPalette, setCustomColor, toggleCustomColors, activePalette } =
    useBuilderStore()
  const active = activePalette()

  return (
    <div>
      <h2 className="font-display text-2xl font-semibold text-white">Couleurs du thème</h2>
      <p className="mt-1 text-sm text-white/50">
        Choisis une palette prête à l'emploi, ou personnalise chaque couleur toi-même.
      </p>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
        {palettes.map((p) => {
          const isActive = !useCustomColors && p.id === paletteId
          return (
            <button
              key={p.id}
              onClick={() => selectPalette(p.id)}
              className={`flex flex-col items-center gap-2 rounded-2xl border p-3 transition-colors ${
                isActive ? 'border-white/40 bg-white/10' : 'border-white/8 bg-white/[0.03] hover:bg-white/[0.06]'
              }`}
            >
              <div className="relative flex h-10 w-full">
                <span className="h-10 w-1/3 rounded-l-lg" style={{ background: p.primary }} />
                <span className="h-10 w-1/3" style={{ background: p.secondary }} />
                <span className="h-10 w-1/3 rounded-r-lg" style={{ background: p.accent }} />
                {isActive && (
                  <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-white text-black">
                    <Check size={12} />
                  </span>
                )}
              </div>
              <span className="text-xs font-medium text-white/70">{p.name}</span>
            </button>
          )
        })}
      </div>

      <div className="mt-8 rounded-2xl border border-white/8 bg-white/[0.03] p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-white">Palette personnalisée</p>
            <p className="text-xs text-white/45">Ajuste précisément chaque couleur de ta marque.</p>
          </div>
          <label className="relative inline-flex cursor-pointer items-center">
            <input
              type="checkbox"
              className="peer sr-only"
              checked={useCustomColors}
              onChange={(e) => toggleCustomColors(e.target.checked)}
            />
            <div className="h-6 w-11 rounded-full bg-white/15 transition-colors peer-checked:bg-white/80" />
            <div className="absolute left-1 h-4 w-4 rounded-full bg-white transition-transform peer-checked:translate-x-5 peer-checked:bg-black" />
          </label>
        </div>

        <div className="mt-5 grid grid-cols-3 gap-4">
          {(['primary', 'secondary', 'accent'] as const).map((key) => (
            <div key={key} className="flex flex-col items-center gap-2">
              <input
                type="color"
                value={active[key]}
                onChange={(e) => setCustomColor(key, e.target.value)}
                className="h-12 w-12 rounded-full"
              />
              <span className="text-[11px] capitalize text-white/50">
                {key === 'primary' ? 'Primaire' : key === 'secondary' ? 'Secondaire' : 'Accent'}
              </span>
              <span className="font-tech text-[10px] text-white/30">{active[key]}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
