import {
  ChevronDown,
  ChevronUp,
  Compass,
  Sparkles,
  Wand2,
  Scissors,
} from 'lucide-react'
import { useState } from 'react'
import type { MutableRefObject } from 'react'
import type { ThreeCanvasHandle } from './ThreeCanvas'
import { useSceneStore } from '../hooks/useSceneStore'
import { PartManager } from './PartManager'
import type { SceneModel } from '../types'

type SectionKey = 'view' | 'transform' | 'annotations' | 'explode'

type RightWidgetPanelProps = {
  models: SceneModel[]
  activeModelId: string | null
  onFocusModel: (id: string) => void
  onRemoveModel: (id: string) => void
  canvasRef: MutableRefObject<ThreeCanvasHandle | null>
}

const SectionHeader = ({
  title,
  icon: Icon,
  isCollapsed,
  onToggle,
  badge,
}: {
  title: string
  icon: React.ComponentType<{ size?: number; className?: string }>
  isCollapsed: boolean
  onToggle: () => void
  badge?: React.ReactNode
}) => (
  <button
    type="button"
    onClick={onToggle}
    className="flex w-full items-center justify-between rounded-xl bg-slate-900/70 px-3 py-2 text-sm font-semibold text-slate-200 transition hover:bg-slate-900/90"
  >
    <span className="flex items-center gap-2">
      <Icon size={16} className="text-sky-400" />
      {title}
    </span>
    <span className="flex items-center gap-2 text-xs text-slate-400">
      {badge}
      {isCollapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
    </span>
  </button>
)

export function RightWidgetPanel({
  models,
  activeModelId,
  onFocusModel,
  onRemoveModel,
  canvasRef,
}: RightWidgetPanelProps) {
  const [collapsed, setCollapsed] = useState<Record<SectionKey, boolean>>({
    view: false,
    transform: false,
    annotations: false,
    explode: false,
  })

  const {
    setTransformMode,
    transformMode,
    setAnnotationMode,
    isAnnotationMode,
    toggleMeasurement,
    isMeasurementActive,
    isExploded,
    setExploded,
    annotations,
    showGrid,
    toggleGrid,
  } = useSceneStore((state) => ({
    transformMode: state.transformMode,
    setTransformMode: state.setTransformMode,
    setAnnotationMode: state.setAnnotationMode,
    isAnnotationMode: state.isAnnotationMode,
    toggleMeasurement: state.toggleMeasurement,
    isMeasurementActive: state.isMeasurementActive,
    isExploded: state.isExploded,
    setExploded: state.setExploded,
    annotations: state.annotations,
    showGrid: state.showGrid,
    toggleGrid: state.toggleGrid,
  }))

  const toggleSection = (key: SectionKey) =>
    setCollapsed((prev) => ({ ...prev, [key]: !prev[key] }))

  return (
    <aside className="pointer-events-auto relative flex w-80 min-w-[320px] flex-col gap-4 p-6 text-sm text-slate-200">
      <div className="sticky top-20 flex max-h-[calc(100vh-9rem)] flex-col gap-4 overflow-y-auto rounded-3xl border border-slate-700 bg-slate-900/70 p-4 shadow-2xl backdrop-blur">
        <PartManager
          models={models}
          activeModelId={activeModelId}
          onFocus={onFocusModel}
          onRemove={onRemoveModel}
        />

        <SectionHeader
          title="View Controls"
          icon={Compass}
          isCollapsed={collapsed.view}
          onToggle={() => toggleSection('view')}
        />
        {!collapsed.view && (
          <div className="space-y-3 rounded-2xl bg-slate-900/40 p-3 text-xs text-slate-300">
            <p className="text-slate-400">Quick camera presets:</p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <button
                type="button"
                className="rounded-lg bg-slate-800 px-3 py-2 transition hover:bg-slate-700"
                onClick={() => canvasRef.current?.setCameraPreset('front')}
              >
                Front
              </button>
              <button
                type="button"
                className="rounded-lg bg-slate-800 px-3 py-2 transition hover:bg-slate-700"
                onClick={() => canvasRef.current?.setCameraPreset('top')}
              >
                Top
              </button>
              <button
                type="button"
                className="rounded-lg bg-slate-800 px-3 py-2 transition hover:bg-slate-700"
                onClick={() => canvasRef.current?.setCameraPreset('left')}
              >
                Left
              </button>
              <button
                type="button"
                className="rounded-lg bg-slate-800 px-3 py-2 transition hover:bg-slate-700"
                onClick={() => canvasRef.current?.setCameraPreset('iso')}
              >
                ISO
              </button>
            </div>
            <button
              type="button"
              className="mt-2 w-full rounded-lg bg-sky-500 px-3 py-2 font-semibold text-slate-900 transition hover:bg-sky-400"
              onClick={() => canvasRef.current?.fitView()}
            >
              Fit to View
            </button>
            <div className="mt-1 flex items-center justify-between rounded-lg bg-slate-900/60 px-3 py-2 text-xs">
              <span className="text-slate-300">Show Grid / Scale</span>
              <label className="inline-flex cursor-pointer items-center gap-2">
                <span className="relative inline-flex h-5 w-10 items-center rounded-full bg-slate-700 transition">
                  <input
                    type="checkbox"
                    checked={showGrid}
                    onChange={toggleGrid}
                    className="peer sr-only"
                  />
                  <span className="absolute left-1 h-3 w-3 rounded-full bg-slate-300 transition-all peer-checked:left-6 peer-checked:bg-sky-400" />
                </span>
              </label>
            </div>
          </div>
        )}

        <SectionHeader
          title="Transform"
          icon={Wand2}
          isCollapsed={collapsed.transform}
          onToggle={() => toggleSection('transform')}
          badge={<span className="text-sky-300">{transformMode}</span>}
        />
        {!collapsed.transform && (
          <div className="grid gap-2 rounded-2xl bg-slate-900/40 p-3">
            {(['translate', 'rotate', 'scale'] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setTransformMode(mode)}
                className={`rounded-lg px-3 py-2 text-xs font-semibold transition ${
                  transformMode === mode
                    ? 'bg-sky-500 text-slate-900'
                    : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
                }`}
              >
                {mode.toUpperCase()}
              </button>
            ))}
          </div>
        )}

        <SectionHeader
          title="Annotations & Measure"
          icon={Scissors}
          isCollapsed={collapsed.annotations}
          onToggle={() => toggleSection('annotations')}
          badge={
            annotations.length > 0 ? (
              <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px]">{annotations.length}</span>
            ) : undefined
          }
        />
        {!collapsed.annotations && (
          <div className="space-y-2 rounded-2xl bg-slate-900/40 p-3">
            <button
              type="button"
              onClick={toggleMeasurement}
              className={`w-full rounded-lg px-3 py-2 text-xs font-semibold transition ${
                isMeasurementActive
                  ? 'bg-sky-500 text-slate-900'
                  : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
              }`}
            >
              {isMeasurementActive ? 'Measurement Active' : 'Measure Distance'}
            </button>
            <button
              type="button"
              onClick={() => setAnnotationMode(!isAnnotationMode)}
              className={`w-full rounded-lg px-3 py-2 text-xs font-semibold transition ${
                isAnnotationMode
                  ? 'bg-amber-400 text-slate-950'
                  : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
              }`}
            >
              {isAnnotationMode ? 'Annotation Mode On' : 'Add Marker'}
            </button>
          </div>
        )}

        <SectionHeader
          title="Explode & Clipping"
          icon={Sparkles}
          isCollapsed={collapsed.explode}
          onToggle={() => toggleSection('explode')}
        />
        {!collapsed.explode && (
          <div className="space-y-3 rounded-2xl bg-slate-900/40 p-3 text-xs">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setExploded(true)}
                className={`flex-1 rounded-lg px-3 py-2 font-semibold transition ${
                  isExploded
                    ? 'bg-rose-500 text-slate-900'
                    : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
                }`}
              >
                Explode
              </button>
              <button
                type="button"
                onClick={() => setExploded(false)}
                className="flex-1 rounded-lg bg-slate-800 px-3 py-2 font-semibold text-slate-200 transition hover:bg-slate-700"
              >
                Assemble
              </button>
            </div>
            <p className="text-slate-500">
              Use the cut-plane widget to slice the scene along any axis.
            </p>
          </div>
        )}
      </div>
    </aside>
  )
}

