import { AnimatePresence, motion } from 'framer-motion'
import type { GeneratedModel } from '../types'
import { LoadingShimmer } from './LoadingShimmer'
import { cn } from '../utils/cn'

interface HistoryPanelProps {
  items: GeneratedModel[]
  selectedId: string | null
  onSelect: (id: string) => void
  onRegenerate?: (prompt: string) => Promise<void>
  onClear: () => void
  isLoading?: boolean
}

const formatDate = (input: string) => {
  const date = new Date(input)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
    month: 'short',
    day: 'numeric',
  })
}

export const HistoryPanel = ({
  items,
  selectedId,
  onSelect,
  onRegenerate,
  onClear,
  isLoading = false,
}: HistoryPanelProps) => {
  return (
    <section className="rounded-3xl border border-slate-700 bg-slate-900/70 p-6 shadow-lg shadow-sky-900/20 backdrop-blur">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-100">Generation history</h2>
          <p className="mt-1 text-sm text-slate-300">
            Revisit previously generated aircraft concepts or iterate with new prompts.
          </p>
        </div>
        {items.length > 0 && (
          <button
            type="button"
            onClick={onClear}
            className="rounded-full border border-slate-600 px-3 py-1 text-xs font-medium text-slate-300 transition hover:border-rose-400 hover:bg-rose-500/10 hover:text-rose-200"
          >
            Clear all
          </button>
        )}
      </div>

      <div className="mt-4 max-h-[420px] space-y-3 overflow-y-auto pr-1 scrollbar-thin scrollbar-track-slate-900/60 scrollbar-thumb-slate-700/70 hover:scrollbar-thumb-slate-600/70">
        {isLoading && (
          <div className="space-y-3">
            <LoadingShimmer className="h-24 rounded-2xl" />
            <LoadingShimmer className="h-24 rounded-2xl" />
          </div>
        )}

        {!isLoading && items.length === 0 && (
          <div className="rounded-2xl border border-dashed border-slate-600 bg-slate-950/60 p-6 text-sm text-slate-300">
            Your generated aircraft will appear here. Start with an initial prompt or try the Inspire
            Me suggestion.
          </div>
        )}

        <AnimatePresence initial={false}>
          {!isLoading &&
            items.map((item) => {
              const isActive = item.id === selectedId
              return (
                <motion.article
                  key={item.id}
                  layout
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  transition={{ type: 'spring', stiffness: 200, damping: 24 }}
                  className={cn(
                    'group relative flex flex-col gap-4 rounded-2xl border p-4 transition',
                    isActive
                      ? 'border-sky-500/70 bg-slate-950/60 shadow-md shadow-sky-500/30'
                      : 'border-slate-700 bg-slate-950/40 hover:border-sky-500/50 hover:bg-slate-950/70',
                  )}
                >
                  <div className="flex gap-4">
                    <button
                      type="button"
                      onClick={() => onSelect(item.id)}
                      className="relative h-20 w-20 flex-shrink-0 overflow-hidden rounded-2xl border border-slate-700 bg-slate-900/70 shadow-inner shadow-slate-900/40 transition hover:-translate-y-0.5 hover:shadow-xl hover:shadow-sky-900/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400"
                    >
                      {item.thumbnailUrl ? (
                        <img
                          src={item.thumbnailUrl}
                          alt={item.prompt}
                          className="h-full w-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-sky-900 via-slate-900 to-sky-600 text-sky-200">
                          <span className="text-lg font-semibold">3D</span>
                        </div>
                      )}
                      <span className="absolute bottom-1 right-1 rounded-full bg-slate-900/80 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-sky-300 shadow-sm">
                        {formatDate(item.createdAt)}
                      </span>
                    </button>

                    <div className="flex flex-1 flex-col gap-2">
                      <div className="text-sm font-medium leading-snug text-slate-100 [display:-webkit-box] [-webkit-line-clamp:3] [-webkit-box-orient:vertical] [overflow:hidden] [text-overflow:ellipsis]">
                        {item.prompt}
                      </div>
                      <div className="mt-1 text-xs text-slate-400">
                        {item.prompt}
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                        {item.metadata && Object.keys(item.metadata).length > 0 ? (
                          Object.entries(item.metadata)
                            .slice(0, 3)
                            .map(([key, value]) => (
                              <span key={key} className="rounded-full bg-slate-800/70 px-2 py-1 text-slate-200">
                                {key}: {String(value)}
                              </span>
                            ))
                        ) : (
                          <span className="rounded-full bg-slate-800/70 px-2 py-1 text-slate-300">
                            AI generated
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="inline-flex items-center gap-2 rounded-full bg-slate-800/70 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-300">
                      {isActive ? (
                        <>
                          <span className="inline-flex h-2 w-2 rounded-full bg-sky-400" />
                          Viewing
                        </>
                      ) : (
                        <>
                          <span className="inline-flex h-2 w-2 rounded-full bg-slate-500" />
                          Stored
                        </>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-sm font-medium">
                      <button
                        type="button"
                        onClick={() => onSelect(item.id)}
                        className="inline-flex items-center gap-2 rounded-full border border-sky-500/60 bg-sky-500/10 px-4 py-1.5 text-sky-200 transition hover:border-sky-400 hover:bg-sky-500/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-300"
                      >
                        View again
                        <svg
                          className="h-4 w-4"
                          viewBox="0 0 20 20"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden
                        >
                          <path d="M5 10h10M10 5l5 5-5 5" />
                        </svg>
                      </button>
                      {onRegenerate && (
                        <button
                          type="button"
                          onClick={() => {
                            void onRegenerate(item.prompt)
                          }}
                          className="inline-flex items-center gap-2 rounded-full border border-slate-600 bg-slate-900/50 px-4 py-1.5 text-slate-200 transition hover:border-slate-500 hover:bg-slate-800/70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-300"
                        >
                          Regenerate
                          <svg
                            className="h-4 w-4"
                            viewBox="0 0 20 20"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden
                          >
                            <path d="M4 4v5h5M16 16v-5h-5" />
                            <path d="M5 9a5 5 0 0 1 8.66-3.54L15 6M15 11a5 5 0 0 1-8.66 3.54L5 14" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>
                </motion.article>
              )
            })}
        </AnimatePresence>
      </div>
    </section>
  )
}
