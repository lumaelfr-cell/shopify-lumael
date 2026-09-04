import { AnimatePresence, motion } from 'framer-motion'
import { ArrowLeft, ArrowRight, Sparkles } from 'lucide-react'
import Stepper from './components/Stepper'
import LivePreview from './components/LivePreview'
import NicheStep from './components/steps/NicheStep'
import ShopStep from './components/steps/ShopStep'
import ThemeStep from './components/steps/ThemeStep'
import StyleStep from './components/steps/StyleStep'
import InfosStep from './components/steps/InfosStep'
import PublishStep from './components/steps/PublishStep'
import { steps, useBuilderStore } from './store/useBuilderStore'

const stepComponents = {
  niche: NicheStep,
  shop: ShopStep,
  theme: ThemeStep,
  style: StyleStep,
  infos: InfosStep,
  preview: PublishStep,
}

function App() {
  const { step, goNext, goPrev } = useBuilderStore()
  const idx = steps.findIndex((s) => s.id === step)
  const StepComponent = stepComponents[step]

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[#07070c]">
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,rgba(139,92,246,0.18),transparent_60%),radial-gradient(ellipse_at_bottom_right,rgba(244,114,182,0.12),transparent_55%)]" />

      <header className="mx-auto flex max-w-7xl items-center justify-between px-6 py-6 sm:px-10">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500">
            <Sparkles size={18} className="text-white" />
          </span>
          <span className="font-display text-lg font-semibold text-white">Site Builder Studio</span>
        </div>
        <span className="hidden rounded-full border border-white/10 px-3 py-1.5 text-xs text-white/50 sm:block">
          Crée ta boutique en ligne en quelques minutes
        </span>
      </header>

      <main className="mx-auto max-w-7xl px-6 pb-20 sm:px-10">
        <div className="mb-8 text-center sm:text-left">
          <h1 className="font-display text-3xl font-semibold text-white sm:text-4xl">
            Construis la boutique de tes rêves
          </h1>
          <p className="mt-2 max-w-xl text-sm text-white/50 sm:mx-0 mx-auto">
            Choisis une niche, une boutique pré-enregistrée, une palette de couleurs et un style —
            l'aperçu se met à jour en direct.
          </p>
        </div>

        <div className="mb-6 glass rounded-2xl p-3">
          <Stepper />
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
          <div className="glass flex flex-col rounded-3xl p-6 sm:p-8">
            <div className="min-h-[420px] flex-1">
              <AnimatePresence mode="wait">
                <motion.div
                  key={step}
                  initial={{ opacity: 0, x: 16 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -16 }}
                  transition={{ duration: 0.25 }}
                >
                  <StepComponent />
                </motion.div>
              </AnimatePresence>
            </div>

            <div className="mt-8 flex items-center justify-between border-t border-white/8 pt-5">
              <button
                onClick={goPrev}
                disabled={idx === 0}
                className="flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium text-white/60 transition-colors hover:bg-white/5 disabled:opacity-30"
              >
                <ArrowLeft size={15} />
                Précédent
              </button>
              <span className="text-xs text-white/30">
                Étape {idx + 1} / {steps.length}
              </span>
              <button
                onClick={goNext}
                disabled={idx === steps.length - 1}
                className="flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-sm font-semibold text-black transition-transform hover:scale-105 disabled:pointer-events-none disabled:opacity-30"
              >
                Suivant
                <ArrowRight size={15} />
              </button>
            </div>
          </div>

          <div className="lg:sticky lg:top-6 lg:self-start">
            <LivePreview />
          </div>
        </div>
      </main>
    </div>
  )
}

export default App
