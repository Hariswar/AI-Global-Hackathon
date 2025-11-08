import * as Slider from '@radix-ui/react-slider'
import * as Popover from '@radix-ui/react-popover'
import type { ModelTransform } from '../types'
import { cn } from '../utils/cn'

interface ModelEditorControlsProps {
  transform: ModelTransform
  onTransformChange: (transform: ModelTransform) => void
}

const COLOR_SWATCHES = [
  '#ffffff',
  '#dbeafe',
  '#bfdbfe',
  '#93c5fd',
  '#60a5fa',
  '#3b82f6',
  '#1d4ed8',
  '#0ea5e9',
  '#22d3ee',
  '#a855f7',
  '#f97316',
  '#facc15',
  '#86efac',
  '#22c55e',
  '#94a3b8',
]

const ControlLabel = ({ title, description }: { title: string; description: string }) => (
  <div>
    <p className="text-sm font-semibold text-slate-900">{title}</p>
    <p className="text-xs text-slate-500">{description}</p>
  </div>
)

export const ModelEditorControls = ({
  transform,
  onTransformChange,
}: ModelEditorControlsProps) => {
  const updateRotation = (axis: 'x' | 'y' | 'z', value: number[]) => {
    const next = {
      ...transform,
      rotation: {
        ...transform.rotation,
        [axis]: value[0] ?? 0,
      },
    }
    onTransformChange(next)
  }

  const updateScale = (value: number[]) => {
    onTransformChange({
      ...transform,
      scale: parseFloat((value[0] ?? 1).toFixed(2)),
    })
  }

  const updateColor = (value: string) => {
    onTransformChange({
      ...transform,
      baseColor: value,
    })
  }

  return (
    <section className="rounded-3xl border border-slate-700 bg-slate-900/70 p-6 shadow-lg shadow-sky-900/20 backdrop-blur">
      <div className="flex flex-col gap-4">
        <header>
          <h2 className="text-lg font-semibold text-slate-100">Model editing controls</h2>
          <p className="mt-1 text-sm text-slate-300">
            Adjust orientation, scale, and base material tint of the generated aircraft.
          </p>
        </header>

        <div className="space-y-5">
          <div>
            <ControlLabel
              title="Rotation"
              description="Fine-tune the aircraft orientation along each axis (degrees)."
            />
            <div className="mt-3 grid gap-4 sm:grid-cols-3">
              {(['x', 'y', 'z'] as const).map((axis) => (
                <div key={axis} className="rounded-2xl border border-slate-700 bg-slate-950/60 p-4 shadow-inner shadow-slate-900/40">
                  <div className="flex items-center justify-between text-xs font-medium text-slate-400">
                    <span>{axis.toUpperCase()} axis</span>
                    <span className="text-slate-200">{Math.round(transform.rotation[axis])}°</span>
                  </div>
                  <Slider.Root
                    value={[transform.rotation[axis]]}
                    min={-180}
                    max={180}
                    step={1}
                    onValueChange={(value) => updateRotation(axis, value)}
                    className="relative mt-3 flex h-5 touch-none select-none items-center"
                  >
                    <Slider.Track className="relative h-1.5 w-full grow rounded-full bg-slate-800">
                      <Slider.Range className="absolute h-full rounded-full bg-sky-500" />
                    </Slider.Track>
                    <Slider.Thumb
                      className="block h-4 w-4 rounded-full border border-sky-500 bg-slate-900 shadow shadow-sky-500/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
                      aria-label={`${axis}-rotation`}
                    />
                  </Slider.Root>
                </div>
              ))}
            </div>
          </div>

          <div>
            <ControlLabel
              title="Scale"
              description="Zoom the aircraft in or out to inspect additional detail."
            />
            <div className="mt-3 rounded-2xl border border-slate-700 bg-slate-950/60 p-4 shadow-inner shadow-slate-900/40">
              <div className="flex items-center justify-between text-xs font-medium text-slate-400">
                <span>Multiplier</span>
                <span className="text-slate-200">{transform.scale.toFixed(2)}x</span>
              </div>
              <Slider.Root
                value={[transform.scale]}
                min={0.4}
                max={2.5}
                step={0.01}
                onValueChange={updateScale}
                className="relative mt-3 flex h-5 touch-none select-none items-center"
              >
                <Slider.Track className="relative h-1.5 w-full grow rounded-full bg-slate-800">
                  <Slider.Range className="absolute h-full rounded-full bg-sky-500" />
                </Slider.Track>
                <Slider.Thumb
                  className="block h-4 w-4 rounded-full border border-sky-500 bg-slate-900 shadow shadow-sky-500/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
                  aria-label="scale"
                />
              </Slider.Root>
            </div>
          </div>

          <div>
            <ControlLabel
              title="Material tint"
              description="Choose a base color wash to highlight components."
            />
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <Popover.Root>
                <Popover.Trigger asChild>
                  <button
                    type="button"
                    className="flex h-11 items-center gap-3 rounded-2xl border border-slate-600 bg-slate-950/70 px-4 text-sm font-medium text-slate-200 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg hover:shadow-sky-900/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400"
                  >
                    <span
                      className="h-8 w-8 rounded-xl border border-slate-200 shadow-inner"
                      style={{ backgroundColor: transform.baseColor }}
                    />
                    <span>{transform.baseColor.toUpperCase()}</span>
                  </button>
                </Popover.Trigger>
                <Popover.Portal>
                  <Popover.Content
                    className="z-50 rounded-2xl border border-slate-600 bg-slate-900/95 p-4 shadow-2xl shadow-slate-950/50"
                    sideOffset={12}
                  >
                    <div className="grid grid-cols-5 gap-2">
                      {COLOR_SWATCHES.map((color) => (
                        <button
                          key={color}
                          type="button"
                          onClick={() => updateColor(color)}
                          className={cn(
                            'h-10 w-10 rounded-xl border transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400',
                            transform.baseColor === color
                              ? 'border-sky-400 shadow-inner shadow-sky-500/40'
                              : 'border-slate-700 hover:-translate-y-0.5 hover:shadow-lg',
                          )}
                          style={{ backgroundColor: color }}
                          aria-label={`Select ${color}`}
                        />
                      ))}
                    </div>
                    <div className="mt-3">
                      <label className="flex items-center gap-3 text-xs font-medium text-slate-300">
                        Custom HEX
                        <input
                          type="color"
                          value={transform.baseColor}
                          onChange={(event) => updateColor(event.target.value)}
                          className="h-9 w-16 cursor-pointer rounded-md border border-slate-600 bg-slate-900"
                          aria-label="Custom color picker"
                        />
                      </label>
                    </div>
                  </Popover.Content>
                </Popover.Portal>
              </Popover.Root>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

