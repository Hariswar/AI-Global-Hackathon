import { FormEvent, useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'

interface PromptPanelProps {
  isGenerating: boolean
  onGenerate: (prompt: string) => Promise<void>
  error: Error | null
  onResetError: () => void
}

const SUGGESTED_PROMPTS = [
  'Futuristic electric passenger jet with blended wing body',
  'Lightweight reconnaissance drone inspired by peregrine falcon wings',
  'Regional turboprop aircraft with noise-reduction engine nacelles',
  'Supersonic business jet concept with adaptive wing geometry',
]

const LAST_PROMPT_KEY = 'sketch-to-sky::last-prompt'

export const PromptPanel = ({
  isGenerating,
  onGenerate,
  error,
  onResetError,
}: PromptPanelProps) => {
  const [prompt, setPrompt] = useState(() => {
    if (typeof window === 'undefined') return ''
    return window.localStorage.getItem(LAST_PROMPT_KEY) ?? ''
  })
  const [hasInteracted, setHasInteracted] = useState(false)
  const charCount = prompt.length

  useEffect(() => {
    if (!isGenerating) return
    setHasInteracted(true)
  }, [isGenerating])

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!prompt.trim()) {
      window.localStorage.removeItem(LAST_PROMPT_KEY)
      return
    }
    window.localStorage.setItem(LAST_PROMPT_KEY, prompt)
  }, [prompt])

  const randomSuggestion = useMemo(
    () => SUGGESTED_PROMPTS[Math.floor(Math.random() * SUGGESTED_PROMPTS.length)],
    [],
  )

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!prompt.trim()) return
    try {
      await onGenerate(prompt)
      setHasInteracted(false)
    } catch (err) {
      console.error(err)
    }
  }

  return (
    <motion.section
      layout
      className="rounded-3xl border border-slate-700 bg-slate-900/70 p-6 shadow-lg shadow-sky-900/20 backdrop-blur"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 160, damping: 24 }}
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-100">Describe your aircraft concept</h2>
          <p className="mt-1 text-sm text-slate-300">
            The AI will transform your prompt into a detailed 3D aircraft model.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setPrompt(randomSuggestion)}
          className="hidden rounded-full border border-sky-500/40 px-3 py-1 text-xs font-medium text-sky-300 transition hover:border-sky-400 hover:bg-sky-500/10 hover:text-sky-200 sm:block"
        >
          Inspire me
        </button>
      </div>

      <form className="mt-4 space-y-4" onSubmit={handleSubmit}>
        <div className="relative">
          <textarea
            value={prompt}
            onChange={(event) => {
              if (error) onResetError()
              setPrompt(event.target.value)
            }}
            placeholder={randomSuggestion}
            rows={4}
            className="peer w-full resize-none rounded-2xl border border-slate-700 bg-slate-950/70 p-4 text-sm text-slate-100 shadow-inner shadow-slate-900/40 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-500/40"
            maxLength={600}
          />
          <span className="pointer-events-none absolute bottom-3 right-4 text-xs font-medium text-slate-500">
            {charCount}/600
          </span>
        </div>

        {error && (
          <motion.div
            className="flex items-start gap-2 rounded-2xl border border-rose-500/30 bg-rose-900/40 px-4 py-3 text-sm text-rose-200"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <span className="mt-0.5 text-base leading-none">⚠️</span>
            <div>
              <p className="font-medium">We couldn&apos;t generate the model.</p>
              <p>{error.message}</p>
            </div>
          </motion.div>
        )}

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-xs text-slate-400">
            Tip: mention wing style, propulsion system, and materials for better results.
          </div>
          <button
            type="submit"
            disabled={isGenerating || !prompt.trim()}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-gradient-to-r from-sky-600 to-blue-500 px-6 text-sm font-semibold text-white transition hover:from-sky-500 hover:to-sky-500 hover:shadow-lg hover:shadow-sky-600/40 disabled:from-slate-600 disabled:to-slate-700 disabled:text-slate-400 disabled:shadow-none"
          >
            {isGenerating ? (
              <>
                <span className="inline-flex h-4 w-4 animate-spin rounded-full border-2 border-white/70 border-t-transparent" />
                Generating...
              </>
            ) : hasInteracted ? (
              'Generating...'
            ) : (
              'Generate 3D Model'
            )}
          </button>
        </div>
      </form>
    </motion.section>
  )
}

