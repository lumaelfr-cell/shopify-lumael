import { motion } from 'framer-motion'
import { niches } from '../../data/niches'
import { useBuilderStore } from '../../store/useBuilderStore'

export default function NicheStep() {
  const { nicheId, selectNiche } = useBuilderStore()

  return (
    <div>
      <h2 className="font-display text-2xl font-semibold text-white">Choisis ta niche</h2>
      <p className="mt-1 text-sm text-white/50">
        Sélectionne le secteur qui correspond à ta boutique. Chaque niche propose des boutiques
        pré-enregistrées prêtes à personnaliser.
      </p>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {niches.map((niche) => {
          const active = niche.id === nicheId
          return (
            <motion.button
              key={niche.id}
              onClick={() => selectNiche(niche.id)}
              whileHover={{ y: -3 }}
              whileTap={{ scale: 0.97 }}
              className={`relative flex flex-col items-start gap-2 rounded-2xl border p-4 text-left transition-colors ${
                active
                  ? 'border-white/40 bg-white/10'
                  : 'border-white/8 bg-white/[0.03] hover:bg-white/[0.06]'
              }`}
            >
              <span className="text-2xl">{niche.icon}</span>
              <span className="text-sm font-semibold text-white">{niche.label}</span>
              <span className="text-xs leading-snug text-white/45">{niche.description}</span>
              {active && (
                <motion.span
                  layoutId="niche-active"
                  className="absolute inset-0 -z-10 rounded-2xl ring-2 ring-white/30"
                />
              )}
            </motion.button>
          )
        })}
      </div>
    </div>
  )
}
