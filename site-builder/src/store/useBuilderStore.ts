import { create } from 'zustand'
import { niches } from '../data/niches'
import { palettes } from '../data/palettes'
import { fontPairings, layoutStyles } from '../data/fonts'
import type { NicheId, Palette } from '../types'

export type Step = 'niche' | 'shop' | 'theme' | 'style' | 'infos' | 'preview'

export const steps: { id: Step; label: string }[] = [
  { id: 'niche', label: 'Niche' },
  { id: 'shop', label: 'Boutique' },
  { id: 'theme', label: 'Couleurs' },
  { id: 'style', label: 'Style' },
  { id: 'infos', label: 'Infos' },
  { id: 'preview', label: 'Publier' },
]

interface BuilderState {
  step: Step
  nicheId: NicheId
  shopId: string
  paletteId: string
  customColors: Partial<Pick<Palette, 'primary' | 'secondary' | 'accent'>>
  useCustomColors: boolean
  fontId: string
  layoutId: string
  siteName: string
  tagline: string
  published: boolean

  setStep: (step: Step) => void
  goNext: () => void
  goPrev: () => void
  selectNiche: (id: NicheId) => void
  selectShop: (id: string) => void
  selectPalette: (id: string) => void
  setCustomColor: (key: 'primary' | 'secondary' | 'accent', value: string) => void
  toggleCustomColors: (value: boolean) => void
  setFont: (id: string) => void
  setLayout: (id: string) => void
  setSiteName: (value: string) => void
  setTagline: (value: string) => void
  publish: () => void
  reset: () => void
  activePalette: () => Palette
}

const defaultNiche = niches[0]
const defaultShop = defaultNiche.shops[0]

export const useBuilderStore = create<BuilderState>((set, get) => ({
  step: 'niche',
  nicheId: defaultNiche.id,
  shopId: defaultShop.id,
  paletteId: defaultNiche.defaultPaletteId,
  customColors: {},
  useCustomColors: false,
  fontId: fontPairings[0].id,
  layoutId: layoutStyles[0].id,
  siteName: defaultShop.name,
  tagline: defaultShop.tagline,
  published: false,

  setStep: (step) => set({ step }),
  goNext: () =>
    set((s) => {
      const idx = steps.findIndex((st) => st.id === s.step)
      const next = steps[Math.min(idx + 1, steps.length - 1)]
      return { step: next.id }
    }),
  goPrev: () =>
    set((s) => {
      const idx = steps.findIndex((st) => st.id === s.step)
      const prev = steps[Math.max(idx - 1, 0)]
      return { step: prev.id }
    }),

  selectNiche: (id) =>
    set(() => {
      const niche = niches.find((n) => n.id === id) ?? defaultNiche
      const shop = niche.shops[0]
      return {
        nicheId: id,
        shopId: shop.id,
        paletteId: niche.defaultPaletteId,
        siteName: shop.name,
        tagline: shop.tagline,
      }
    }),

  selectShop: (id) =>
    set((s) => {
      const niche = niches.find((n) => n.id === s.nicheId) ?? defaultNiche
      const shop = niche.shops.find((sh) => sh.id === id) ?? niche.shops[0]
      return { shopId: id, siteName: shop.name, tagline: shop.tagline }
    }),

  selectPalette: (id) => set({ paletteId: id, useCustomColors: false }),

  setCustomColor: (key, value) =>
    set((s) => ({
      customColors: { ...s.customColors, [key]: value },
      useCustomColors: true,
    })),

  toggleCustomColors: (value) => set({ useCustomColors: value }),

  setFont: (id) => set({ fontId: id }),
  setLayout: (id) => set({ layoutId: id }),
  setSiteName: (value) => set({ siteName: value }),
  setTagline: (value) => set({ tagline: value }),
  publish: () => set({ published: true }),
  reset: () =>
    set({
      step: 'niche',
      nicheId: defaultNiche.id,
      shopId: defaultShop.id,
      paletteId: defaultNiche.defaultPaletteId,
      customColors: {},
      useCustomColors: false,
      fontId: fontPairings[0].id,
      layoutId: layoutStyles[0].id,
      siteName: defaultShop.name,
      tagline: defaultShop.tagline,
      published: false,
    }),

  activePalette: () => {
    const s = get()
    const base = palettes.find((p) => p.id === s.paletteId) ?? palettes[0]
    if (!s.useCustomColors) return base
    return { ...base, ...s.customColors, id: 'custom', name: 'Personnalisé' }
  },
}))
