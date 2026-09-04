import { Check } from 'lucide-react'
import { steps, useBuilderStore } from '../store/useBuilderStore'

export default function Stepper() {
  const { step, setStep } = useBuilderStore()
  const activeIdx = steps.findIndex((s) => s.id === step)

  return (
    <div className="flex items-center gap-1 overflow-x-auto pb-1">
      {steps.map((s, i) => {
        const isActive = i === activeIdx
        const isDone = i < activeIdx
        return (
          <button
            key={s.id}
            onClick={() => setStep(s.id)}
            className="group flex items-center gap-2 whitespace-nowrap"
          >
            <span
              className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold transition-all ${
                isActive
                  ? 'bg-white text-black scale-110'
                  : isDone
                    ? 'bg-white/25 text-white'
                    : 'bg-white/5 text-white/40'
              }`}
            >
              {isDone ? <Check size={13} /> : i + 1}
            </span>
            <span
              className={`text-xs font-medium transition-colors ${
                isActive ? 'text-white' : 'text-white/40 group-hover:text-white/70'
              }`}
            >
              {s.label}
            </span>
            {i < steps.length - 1 && <span className="mx-1 h-px w-4 bg-white/10 sm:w-8" />}
          </button>
        )
      })}
    </div>
  )
}
