import { SendHorizonal } from 'lucide-react'
import { useState } from 'react'
import { motion } from 'framer-motion'
import type { GeneratorMode } from '../types'

type BottomPromptBarProps = {
  value: string
  onChange: (value: string) => void
  onSubmit: () => void
  isLoading: boolean
  error: Error | null
  generatorMode: GeneratorMode
  onGeneratorChange: (mode: GeneratorMode) => void
}

export function BottomPromptBar({
  value,
  onChange,
  onSubmit,
  isLoading,
  error,
  generatorMode,
  onGeneratorChange,
}: BottomPromptBarProps) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="pointer-events-none absolute bottom-6 left-1/2 z-40 w-[min(720px,90%)] -translate-x-1/2 text-sm text-slate-100">
      <motion.div
        className="pointer-events-auto rounded-3xl border border-slate-700 bg-slate-900/90 p-3 shadow-2xl backdrop-blur"
        animate={{ y: expanded ? -12 : 0, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 24 }}
      >
        <div className="flex flex-col gap-2">
          <div className="flex items-end gap-3">
            <textarea
              value={value}
              onChange={(event) => onChange(event.target.value)}
              onFocus={() => setExpanded(true)}
              onBlur={() => setExpanded(false)}
              placeholder="Describe the aircraft concept you want to generate…"
              className="h-12 flex-1 resize-none rounded-2xl bg-slate-800/80 px-4 py-3 text-sm outline-none transition focus:h-24 focus:bg-slate-800"
            />
            <div className="flex flex-col items-end gap-2">
              <select
                value={generatorMode}
                onChange={(event) => onGeneratorChange(event.target.value as GeneratorMode)}
                disabled={isLoading}
                className="w-44 rounded-2xl border border-slate-700 bg-slate-900/80 px-3 py-2 text-xs uppercase tracking-wide text-slate-300 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <option value="auto">Auto (Hybrid)</option>
                <option value="remote">Remote API</option>
                <option value="dreamfusion">DreamFusion</option>
                <option value="local">Local</option>
              </select>
              <button
                type="button"
                onClick={onSubmit}
                disabled={isLoading || !value.trim()}
                className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-500 text-slate-950 transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
              >
                {isLoading ? (
                  <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-950 border-t-transparent" />
                ) : (
                  <SendHorizonal size={22} />
                )}
              </button>
            </div>
          </div>
        </div>
        {error && (
          <p className="mt-2 text-xs text-rose-300">
            {error.message ?? 'Failed to generate model.'}
          </p>
        )}
      </motion.div>
    </div>
  )
}

