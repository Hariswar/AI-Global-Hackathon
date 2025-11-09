import { AnimatePresence, motion } from 'framer-motion'
import { UploadCloud } from 'lucide-react'
import { useRef } from 'react'
import type { GeneratorMode } from '../types'

interface PromptModalProps {
  isOpen: boolean
  prompt: string
  isLoading: boolean
  error: Error | null
  generatorMode: GeneratorMode
  onPromptChange: (value: string) => void
  onGeneratorChange: (mode: GeneratorMode) => void
  onGenerate: () => void
  onLoadDemo: () => void
  onUploadRequest: (file: File) => Promise<void> | void
}

export function PromptModal({
  isOpen,
  prompt,
  isLoading,
  error,
  generatorMode,
  onPromptChange,
  onGeneratorChange,
  onGenerate,
  onLoadDemo,
  onUploadRequest,
}: PromptModalProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      void onUploadRequest(file)
      event.target.value = ''
    }
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="prompt-modal"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="pointer-events-auto fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur"
        >
          <motion.div
            initial={{ y: 24, opacity: 0.5 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 24, opacity: 0 }}
            transition={{ type: 'spring', damping: 22, stiffness: 200 }}
            className="w-[min(520px,92%)] rounded-3xl border border-slate-700 bg-slate-900/90 p-8 text-slate-100 shadow-2xl"
          >
            <h2 className="text-2xl font-semibold">Start Your Design</h2>
            <p className="mt-2 text-sm text-slate-400">
              Describe the aircraft component you want to see, try the demo part, or bring your own file.
            </p>

            <textarea
              value={prompt}
              onChange={(event) => onPromptChange(event.target.value)}
              placeholder="e.g. Sleek blended-wing body with forward canards"
              className="mt-6 h-28 w-full resize-none rounded-2xl border border-slate-700 bg-slate-900/80 px-4 py-3 text-sm outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
            />

            {error && <p className="mt-2 text-sm text-rose-300">{error.message}</p>}

            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-xs uppercase tracking-wide text-slate-500">Generation Mode</span>
              <select
                value={generatorMode}
                onChange={(event) => onGeneratorChange(event.target.value as GeneratorMode)}
                disabled={isLoading}
                className="rounded-xl border border-slate-700 bg-slate-900/80 px-3 py-2 text-sm text-slate-100 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <option value="auto">Auto (Remote → DreamFusion → Local)</option>
                <option value="remote">Remote API</option>
                <option value="dreamfusion">DreamFusion</option>
                <option value="local">Local Extraction</option>
              </select>
            </div>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={onGenerate}
                disabled={isLoading}
                className="inline-flex flex-1 items-center justify-center rounded-2xl bg-sky-500 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
              >
                {isLoading ? 'Generating…' : 'Generate with AI'}
              </button>
              <button
                type="button"
                onClick={onLoadDemo}
                disabled={isLoading}
                className="inline-flex flex-1 items-center justify-center rounded-2xl border border-slate-600 bg-slate-900 px-4 py-3 text-sm font-semibold text-slate-100 transition hover:border-sky-400 hover:text-sky-200 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Play with Demo Model
              </button>
            </div>

            <div className="mt-4 flex items-center justify-center gap-2 text-sm text-slate-400">
              <UploadCloud size={16} />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="text-sky-300 transition hover:text-sky-200"
              >
                Upload your own part
              </button>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".glb,.gltf"
              onChange={handleFileChange}
              className="hidden"
            />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
