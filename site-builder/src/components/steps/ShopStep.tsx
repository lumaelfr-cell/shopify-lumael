import { motion } from 'framer-motion'
import { findNiche } from '../../data/niches'
import { useBuilderStore } from '../../store/useBuilderStore'

export default function ShopStep() {
  const { nicheId, shopId, selectShop } = useBuilderStore()
  const niche = findNiche(nicheId)!

  return (
    <div>
      <h2 className="font-display text-2xl font-semibold text-white">Boutiques pré-enregistrées</h2>
      <p className="mt-1 text-sm text-white/50">
        Des boutiques prêtes à l'emploi pour <span className="text-white/80">{niche.label}</span>, avec
        produits, ton éditorial et univers déjà pensés.
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {niche.shops.map((shop) => {
          const active = shop.id === shopId
          return (
            <motion.button
              key={shop.id}
              onClick={() => selectShop(shop.id)}
              whileHover={{ y: -3 }}
              className={`flex flex-col gap-3 rounded-2xl border p-5 text-left transition-colors ${
                active ? 'border-white/40 bg-white/10' : 'border-white/8 bg-white/[0.03] hover:bg-white/[0.06]'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-3xl">{shop.emoji}</span>
                {shop.badge && (
                  <span className="rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-semibold text-white/70">
                    {shop.badge}
                  </span>
                )}
              </div>
              <div>
                <p className="text-base font-semibold text-white">{shop.name}</p>
                <p className="text-xs italic text-white/50">{shop.tagline}</p>
              </div>
              <p className="text-xs leading-relaxed text-white/45">{shop.description}</p>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {shop.products.slice(0, 4).map((p) => (
                  <span key={p.name} className="rounded-full bg-white/5 px-2 py-1 text-[10px] text-white/50">
                    {p.emoji} {p.name}
                  </span>
                ))}
              </div>
            </motion.button>
          )
        })}
      </div>
    </div>
  )
}
