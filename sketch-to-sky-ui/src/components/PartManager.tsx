import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Focus, Trash2 } from 'lucide-react'
import type { SceneModel } from '../types'

interface PartManagerProps {
  models: SceneModel[]
  activeModelId: string | null
  onFocus: (id: string) => void
  onRemove: (id: string) => void
}

export function PartManager({ models, activeModelId, onFocus, onRemove }: PartManagerProps) {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <motion.section
      layout
      className="rounded-3xl border border-slate-700 bg-slate-900/70 p-4 shadow-2xl backdrop-blur"
    >
      <button
        type="button"
        onClick={() => setCollapsed((prev) => !prev)}
        className="flex w-full items-center justify-between rounded-2xl bg-slate-900/60 px-3 py-2 text-sm font-semibold text-slate-100 transition hover:bg-slate-900"
      >
        <span>Part Manager</span>
        <span className="rounded-full bg-slate-800 px-2 py-0.5 text-xs text-slate-300">
          {models.length}
        </span>
      </button>

      <AnimatePresence initial={false}>
        {!collapsed && (
          <motion.div
            key="parts"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: 'tween', duration: 0.25 }}
            className="mt-3 space-y-2"
          >
            {models.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-900/60 px-3 py-6 text-center text-xs text-slate-400">
                No parts loaded. Generate or upload to populate the workspace.
              </div>
            ) : (
              models.map((model) => {
                const isActive = model.id === activeModelId
                return (
                  <motion.article
                    key={model.id}
                    layout
                    className={`rounded-2xl border p-3 text-xs transition ${
                      isActive
                        ? 'border-sky-500/70 bg-slate-950/80 shadow-sky-500/30'
                        : 'border-slate-700 bg-slate-900/50 hover:border-sky-500/50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-100">{model.name}</p>
                        <p className="mt-1 text-[11px] uppercase tracking-wide text-slate-400">
                          {model.source === 'remote'
                            ? 'Remote AI'
                            : model.source === 'local'
                              ? 'Local Extraction'
                              : model.source === 'dreamfusion'
                                ? 'DreamFusion'
                                : model.source === 'demo'
                                  ? 'Demo asset'
                                  : 'Uploaded'}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => onFocus(model.id)}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-slate-800 text-slate-200 transition hover:bg-slate-700"
                          title="Focus on part"
                        >
                          <Focus size={16} />
                        </button>
                        <button
                          type="button"
                          onClick={() => onRemove(model.id)}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-rose-500/20 text-rose-200 transition hover:bg-rose-500/40"
                          title="Remove part"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  </motion.article>
                )
              })
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.section>
  )
}
