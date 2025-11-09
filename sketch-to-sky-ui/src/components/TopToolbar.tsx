import {
  Flame,
  FolderDown,
  FolderUp,
  LayoutDashboard,
  Rotate3d,
  Save,
  Ruler,
  SplitSquareVertical,
} from 'lucide-react'
import { useSceneStore } from '../hooks/useSceneStore'

type TopToolbarProps = {
  onSave: () => void
  onLoad: () => void
  onReset: () => void
  onFitView: () => void
  onFrontView: () => void
  onTopView: () => void
  onPerspective: () => void
}

const toolbarButtons = [
  { label: 'File', icon: FolderDown },
  { label: 'Edit', icon: Rotate3d },
  { label: 'View', icon: LayoutDashboard },
  { label: 'Tools', icon: Flame },
]

export function TopToolbar({
  onLoad,
  onSave,
  onReset,
  onFitView,
  onFrontView,
  onTopView,
  onPerspective,
}: TopToolbarProps) {
  const { isMeasurementActive, toggleMeasurement, isExploded, setExploded } = useSceneStore((state) => ({
    isMeasurementActive: state.isMeasurementActive,
    toggleMeasurement: state.toggleMeasurement,
    isExploded: state.isExploded,
    setExploded: state.setExploded,
  }))

  const handleExplodeToggle = () => {
    setExploded(!isExploded)
  }

  return (
    <header className="z-50 flex h-16 items-center justify-between border-b border-slate-800 bg-slate-900/80 px-6 backdrop-blur">
      <div className="flex items-center gap-2 text-slate-100">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-sky-500 text-xl font-semibold text-slate-950 shadow-lg">
          ✈️
        </div>
        <div>
          <h1 className="text-lg font-semibold">Sketch to Sky – Editor</h1>
          <p className="text-xs text-slate-400">AI-assisted aircraft CAD studio</p>
        </div>
      </div>

      <nav className="hidden items-center gap-1 text-sm text-slate-300 md:flex">
        {toolbarButtons.map((item) => (
          <button
            key={item.label}
            type="button"
            className="flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium transition hover:bg-slate-800"
          >
            <item.icon size={14} className="text-sky-400" />
            {item.label}
          </button>
        ))}
      </nav>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={toggleMeasurement}
          title="Measurement mode"
          className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition ${
            isMeasurementActive
              ? 'bg-sky-500 text-slate-900'
              : 'border border-slate-700 text-slate-200 hover:bg-slate-800'
          }`}
        >
          <Ruler size={16} />
          Measure
        </button>
        <button
          type="button"
          onClick={handleExplodeToggle}
          title="Explode / Assemble view"
          className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition ${
            isExploded
              ? 'bg-amber-500 text-slate-900'
              : 'border border-slate-700 text-slate-200 hover:bg-slate-800'
          }`}
        >
          <SplitSquareVertical size={16} />
          {isExploded ? 'Assemble' : 'Explode'}
        </button>
        <button
          type="button"
          onClick={onSave}
          title="Save current scene session"
          className="inline-flex items-center gap-2 rounded-full bg-sky-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-sky-400"
        >
          <Save size={16} />
          Save
        </button>
        <button
          type="button"
          onClick={onLoad}
          title="Load saved scene session"
          className="inline-flex items-center gap-2 rounded-full bg-slate-800 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:bg-slate-700"
        >
          <FolderUp size={16} />
          Load
        </button>
        <button
          type="button"
          onClick={onReset}
          title="Reset scene to initial state"
          className="inline-flex items-center gap-2 rounded-full border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:bg-slate-800"
        >
          Reset Scene
        </button>

        <div className="hidden items-center gap-1 rounded-full bg-slate-900/80 px-3 py-1 text-[11px] text-slate-400 lg:flex">
          <button
            type="button"
            className="rounded-full px-2 py-1 transition hover:bg-slate-800"
            onClick={onFitView}
          >
            Fit
          </button>
          <button
            type="button"
            className="rounded-full px-2 py-1 transition hover:bg-slate-800"
            onClick={onFrontView}
          >
            Front
          </button>
          <button
            type="button"
            className="rounded-full px-2 py-1 transition hover:bg-slate-800"
            onClick={onTopView}
          >
            Top
          </button>
          <button
            type="button"
            className="rounded-full px-2 py-1 transition hover:bg-slate-800"
            onClick={onPerspective}
          >
            ISO
          </button>
        </div>
      </div>
    </header>
  )
}

