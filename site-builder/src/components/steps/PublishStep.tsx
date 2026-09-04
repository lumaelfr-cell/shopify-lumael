import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Rocket, Download, Check, Copy } from 'lucide-react'
import { useBuilderStore } from '../../store/useBuilderStore'
import { findNiche } from '../../data/niches'
import { findFontPairing, findLayoutStyle } from '../../data/fonts'

export default function PublishStep() {
  const store = useBuilderStore()
  const { siteName, tagline, published, publish, activePalette, nicheId, shopId, fontId, layoutId } = store
  const [copied, setCopied] = useState(false)
  const niche = findNiche(nicheId)!
  const shop = niche.shops.find((s) => s.id === shopId)!
  const palette = activePalette()
  const font = findFontPairing(fontId)
  const layout = findLayoutStyle(layoutId)
  const domain = `${siteName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'ma-boutique'}.shop`

  const handleExport = () => {
    const config = {
      siteName,
      tagline,
      niche: niche.label,
      shop: shop.name,
      palette,
      font: font.name,
      layout: layout.name,
      products: shop.products,
      domain,
    }
    const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${domain.replace('.shop', '')}-config.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(`https://${domain}`)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      /* clipboard unavailable */
    }
  }

  return (
    <div>
      <h2 className="font-display text-2xl font-semibold text-white">Récapitulatif</h2>
      <p className="mt-1 text-sm text-white/50">Vérifie ta configuration avant de publier ta boutique.</p>

      <dl className="mt-6 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
        {[
          ['Niche', `${niche.icon} ${niche.label}`],
          ['Boutique', shop.name],
          ['Palette', palette.name],
          ['Typographie', font.name],
          ['Mise en page', layout.name],
          ['Domaine', domain],
        ].map(([k, v]) => (
          <div key={k} className="rounded-xl border border-white/8 bg-white/[0.03] p-3">
            <dt className="text-[10px] uppercase tracking-wide text-white/35">{k}</dt>
            <dd className="mt-1 truncate font-medium text-white/90">{v}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-6 flex flex-wrap gap-3">
        <button
          onClick={publish}
          className="flex items-center gap-2 rounded-full px-6 py-3 text-sm font-semibold text-black shadow-lg transition-transform hover:scale-105"
          style={{ background: 'linear-gradient(135deg, #fff, #d4d4d8)' }}
        >
          <Rocket size={16} />
          Publier la boutique
        </button>
        <button
          onClick={handleExport}
          className="flex items-center gap-2 rounded-full border border-white/15 px-6 py-3 text-sm font-semibold text-white/80 transition-colors hover:bg-white/5"
        >
          <Download size={16} />
          Exporter la config (JSON)
        </button>
      </div>

      <AnimatePresence>
        {published && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mt-6 flex items-center justify-between gap-4 rounded-2xl border border-emerald-400/30 bg-emerald-400/10 p-4"
          >
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-400/20 text-emerald-300">
                <Check size={18} />
              </span>
              <div>
                <p className="text-sm font-semibold text-emerald-200">Boutique publiée avec succès !</p>
                <p className="font-tech text-xs text-emerald-300/70">https://{domain}</p>
              </div>
            </div>
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-2 text-xs font-medium text-white/80 hover:bg-white/15"
            >
              {copied ? <Check size={13} /> : <Copy size={13} />}
              {copied ? 'Copié' : 'Copier le lien'}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
