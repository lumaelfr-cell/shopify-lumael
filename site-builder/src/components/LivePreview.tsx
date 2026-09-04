import { motion } from 'framer-motion'
import { ShoppingBag, Search, Menu, Star } from 'lucide-react'
import { useBuilderStore } from '../store/useBuilderStore'
import { findNiche } from '../data/niches'
import { findFontPairing } from '../data/fonts'

export default function LivePreview({ compact = false }: { compact?: boolean }) {
  const { nicheId, shopId, siteName, tagline, layoutId, fontId, activePalette } = useBuilderStore()
  const niche = findNiche(nicheId)!
  const shop = niche.shops.find((s) => s.id === shopId) ?? niche.shops[0]
  const palette = activePalette()
  const font = findFontPairing(fontId)

  const isEditorial = layoutId === 'editorial'
  const isBold = layoutId === 'bold'

  return (
    <div
      className="relative overflow-hidden rounded-[28px] border shadow-2xl transition-colors duration-500"
      style={{
        background: palette.bg,
        borderColor: 'rgba(255,255,255,0.08)',
        color: palette.text,
      }}
    >
      {/* browser chrome */}
      <div className="flex items-center gap-2 border-b px-4 py-3" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
        <div className="flex gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-red-400/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-yellow-400/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-green-400/70" />
        </div>
        <div className="mx-auto flex items-center gap-2 rounded-full bg-white/5 px-3 py-1 text-[11px] opacity-60">
          <span>🔒</span>
          <span>{siteName.toLowerCase().replace(/\s+/g, '')}.shop</span>
        </div>
      </div>

      <div className={compact ? 'max-h-[70vh] overflow-y-auto' : ''}>
        {/* nav */}
        <nav className="flex items-center justify-between px-6 py-4 sm:px-10">
          <div className={`flex items-center gap-2 text-lg font-bold ${font.headingClass}`}>
            <span
              className="flex h-8 w-8 items-center justify-center rounded-full text-base"
              style={{ background: palette.primary }}
            >
              {shop.emoji}
            </span>
            {siteName}
          </div>
          <div className="hidden items-center gap-6 text-sm opacity-80 sm:flex">
            <span>Boutique</span>
            <span>Collections</span>
            <span>À propos</span>
          </div>
          <div className="flex items-center gap-4 opacity-90">
            <Search size={18} className="hidden sm:block" />
            <ShoppingBag size={18} />
            <Menu size={18} className="sm:hidden" />
          </div>
        </nav>

        {/* hero */}
        <motion.section
          key={`${nicheId}-${shopId}-${layoutId}`}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className={`relative px-6 pb-14 pt-6 sm:px-10 ${isEditorial ? 'grid items-center gap-8 sm:grid-cols-2' : 'text-center'}`}
        >
          <div
            className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full blur-3xl grain"
            style={{ background: palette.primary, opacity: 0.35 }}
          />
          <div
            className="pointer-events-none absolute -bottom-24 -left-16 h-56 w-56 rounded-full blur-3xl"
            style={{ background: palette.accent, opacity: 0.25 }}
          />

          <div className={isEditorial ? 'relative z-10 text-left' : 'relative z-10 mx-auto max-w-xl'}>
            {shop.badge && (
              <span
                className="mb-4 inline-block rounded-full px-3 py-1 text-xs font-semibold tracking-wide"
                style={{ background: `${palette.primary}26`, color: palette.primary }}
              >
                {shop.badge}
              </span>
            )}
            <h1
              className={`${font.headingClass} leading-[1.05] ${
                isBold ? 'text-4xl font-extrabold uppercase tracking-tight sm:text-6xl' : 'text-3xl font-semibold sm:text-5xl'
              }`}
            >
              {tagline}
            </h1>
            <p className="mt-4 text-sm opacity-70 sm:text-base">{shop.description}</p>
            <div className={`mt-7 flex flex-wrap gap-3 ${isEditorial ? '' : 'justify-center'}`}>
              <button
                className="whitespace-nowrap rounded-full px-6 py-3 text-sm font-semibold shadow-lg transition-transform hover:scale-105"
                style={{ background: palette.primary, color: palette.bg }}
              >
                Découvrir la collection
              </button>
              <button
                className="whitespace-nowrap rounded-full border px-6 py-3 text-sm font-semibold opacity-80"
                style={{ borderColor: 'rgba(255,255,255,0.2)' }}
              >
                En savoir plus
              </button>
            </div>
          </div>

          {isEditorial && (
            <div className="relative z-10 flex h-56 items-center justify-center rounded-3xl text-8xl animate-float" style={{ background: `${palette.secondary}33` }}>
              {shop.emoji}
            </div>
          )}
        </motion.section>

        {/* products */}
        <section className="px-6 pb-16 sm:px-10">
          <div className="mb-6 flex items-end justify-between">
            <h2 className={`${font.headingClass} text-xl font-semibold sm:text-2xl`}>Nos best-sellers</h2>
            <span className="text-xs opacity-60">{shop.products.length} produits</span>
          </div>

          <div
            className={
              isBold
                ? 'divide-y'
                : isEditorial
                  ? 'space-y-4'
                  : 'grid grid-cols-2 gap-4 sm:grid-cols-4'
            }
            style={isBold ? { borderColor: 'rgba(255,255,255,0.1)' } : undefined}
          >
            {shop.products.map((product, i) => (
              <motion.div
                key={product.name}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: i * 0.05 }}
                className={
                  isBold
                    ? 'flex items-center justify-between gap-4 py-5'
                    : isEditorial
                      ? 'flex items-center gap-4 rounded-2xl p-3'
                      : 'rounded-2xl p-3'
                }
                style={!isBold ? { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' } : { borderColor: 'rgba(255,255,255,0.1)' }}
              >
                <div
                  className={
                    isEditorial
                      ? 'flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-xl text-3xl'
                      : isBold
                        ? 'flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-full text-2xl'
                        : 'mb-3 flex aspect-square items-center justify-center rounded-xl text-4xl'
                  }
                  style={{ background: `${palette.secondary}40` }}
                >
                  {product.emoji}
                </div>
                <div className={isBold || isEditorial ? 'flex-1 text-left' : ''}>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium">{product.name}</p>
                    {product.tag && (
                      <span
                        className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
                        style={{ background: `${palette.accent}33`, color: palette.accent }}
                      >
                        {product.tag}
                      </span>
                    )}
                  </div>
                  <div className="mt-1 flex items-center gap-1 text-[11px] opacity-50">
                    <Star size={10} fill="currentColor" />
                    <Star size={10} fill="currentColor" />
                    <Star size={10} fill="currentColor" />
                    <Star size={10} fill="currentColor" />
                    <Star size={10} />
                  </div>
                </div>
                <p className="mt-2 text-sm font-semibold sm:mt-0" style={{ color: palette.primary }}>
                  {product.price}
                </p>
              </motion.div>
            ))}
          </div>
        </section>

        {/* footer */}
        <footer
          className="flex flex-col items-center gap-2 border-t px-6 py-8 text-center text-xs opacity-50 sm:px-10"
          style={{ borderColor: 'rgba(255,255,255,0.06)' }}
        >
          <p>{niche.icon} {siteName} — {niche.label}</p>
          <p>© {new Date().getFullYear()} · Créé avec le Site Builder</p>
        </footer>
      </div>
    </div>
  )
}
