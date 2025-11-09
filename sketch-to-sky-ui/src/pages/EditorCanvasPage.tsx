import { Component, type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useSceneStore } from '../hooks/useSceneStore'
import type { GeneratorMode, SceneModel } from '../types'
import { useModelLoader } from '../components/ModelLoader'
import { ThreeCanvas, CutPlaneControls, type ThreeCanvasHandle } from '../components/ThreeCanvas'
import { TopToolbar } from '../components/TopToolbar'
import { BottomPromptBar } from '../components/BottomPromptBar'
import { PromptModal } from '../components/PromptModal'
import { RightWidgetPanel } from '../components/RightWidgetPanel'
import { ModelTree } from '../components/ModelTree'

const positionForIndex = (index: number): [number, number, number] => [index * 2.5, 0, 0]

const revokeIfObjectUrl = (model: SceneModel) => {
  if (model.url.startsWith('blob:')) {
    URL.revokeObjectURL(model.url)
  }
}

export default function EditorCanvasPage() {
  const canvasRef = useRef<ThreeCanvasHandle>(null)
  const [prompt, setPrompt] = useState('')
  const [models, setModels] = useState<SceneModel[]>([])
  const [initialModalVisible, setInitialModalVisible] = useState(true)
  const [activeModelId, setActiveModelId] = useState<string | null>(null)
  const [generatorMode, setGeneratorMode] = useState<GeneratorMode>('auto')
  const selectedObject = useSceneStore((state) => state.selectedObject)
  const { resetMeasurement } = useSceneStore((state) => ({ resetMeasurement: state.resetMeasurement }))
  const latestModelsRef = useRef<SceneModel[]>([])
  const [sceneMessage, setSceneMessage] = useState<string | null>(null)

  const {
    isLoading,
    error,
    resetError,
    generateFromPrompt,
    loadDemoModel,
    uploadLocalModel,
  } = useModelLoader()

  const hasModels = models.length > 0

  useEffect(() => {
    if (!selectedObject) {
      setActiveModelId((prev) => (hasModels ? prev : null))
      return
    }
    let cursor: any = selectedObject
    while (cursor) {
      if (cursor.userData && cursor.userData.modelId) {
        setActiveModelId(cursor.userData.modelId)
        return
      }
      cursor = cursor.parent
    }
  }, [selectedObject, hasModels])

  const appendModel = useCallback((model: SceneModel) => {
    setModels((prev) => {
      prev.forEach(revokeIfObjectUrl)
      const nextModel = { ...model, position: positionForIndex(0) }
      return [nextModel]
    })
    setInitialModalVisible(false)
    setPrompt('')
    setActiveModelId(model.id)
    setSceneMessage(null)
  }, [])

  const verifyModelUrl = useCallback(async (url: string) => {
    if (url.startsWith('blob:')) return
    try {
      const response = await fetch(url, { method: 'HEAD' })
      if (!response.ok) {
        console.warn(`Model URL HEAD request returned status ${response.status}: ${url}`)
      }
    } catch (error) {
      console.warn('Skipping HEAD verification for model URL due to network/CORS error:', url, error)
    }
  }, [])

  const addModelToScene = useCallback(
    async (model: SceneModel) => {
      await verifyModelUrl(model.url)
      appendModel(model)
    },
    [appendModel, verifyModelUrl],
  )

  const handleGenerate = useCallback(async () => {
    try {
      const generated = await generateFromPrompt(prompt, generatorMode)
      await addModelToScene(generated)
      resetError()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to generate model.'
      setSceneMessage(message)
    }
  }, [addModelToScene, generateFromPrompt, generatorMode, prompt, resetError])

  const handleBottomSubmit = useCallback(async () => {
    if (!prompt.trim()) return
    await handleGenerate()
  }, [handleGenerate, prompt])

  const handleLoadDemo = useCallback(async () => {
    try {
      const demo = await loadDemoModel()
      await addModelToScene(demo)
      resetError()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load the demo model.'
      setSceneMessage(message)
    }
  }, [addModelToScene, loadDemoModel, resetError])

  const handleUpload = useCallback(
    async (file: File) => {
      try {
        const uploaded = await uploadLocalModel(file)
        await addModelToScene(uploaded)
        resetError()
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to import the selected part.'
        setSceneMessage(message)
      }
    },
    [addModelToScene, uploadLocalModel, resetError],
  )

  const handleRemoveModel = useCallback(
    (id: string) => {
      setModels((prev) => {
        prev.forEach((model) => {
          if (model.id === id) {
            revokeIfObjectUrl(model)
          }
        })
        const filtered = prev.filter((model) => model.id !== id)
        if (filtered.length === 0) {
          setActiveModelId(null)
          resetMeasurement()
          setSceneMessage('Workspace empty. Generate or upload a part to get started.')
        }
        return filtered.map((model, index) => ({ ...model, position: positionForIndex(index) }))
      })
    },
    [resetMeasurement],
  )

  const handleFocusModel = useCallback(
    (id: string) => {
      setActiveModelId(id)
      canvasRef.current?.focusOnModel(id)
    },
    [],
  )

  useEffect(() => {
    latestModelsRef.current = models
  }, [models])

  useEffect(() => {
    return () => {
      latestModelsRef.current.forEach(revokeIfObjectUrl)
    }
  }, [])

  const emptyStateVisible = !initialModalVisible && models.length === 0

  const statusLabel = useMemo(() => {
    if (isLoading) return 'Generating…'
    return null
  }, [isLoading])

  const handleCanvasError = useCallback(
    (error: Error) => {
      console.error('Canvas rendering error', error)
      setSceneMessage(error.message || 'Failed to load the model in the viewer.')
      setModels((prev) => {
        prev.forEach(revokeIfObjectUrl)
        return []
      })
      setActiveModelId(null)
      resetMeasurement()
    },
    [resetMeasurement],
  )

  const boundaryKey = models.length > 0 ? models[0].id : 'empty'

  return (
    <div className="relative flex h-screen w-screen flex-col bg-slate-950 text-slate-100">
      <PromptModal
        isOpen={initialModalVisible}
        prompt={prompt}
        isLoading={isLoading}
        error={error}
        generatorMode={generatorMode}
        onPromptChange={(value) => {
          resetError()
          setPrompt(value)
        }}
        onGeneratorChange={(mode) => {
          setGeneratorMode(mode)
          resetError()
          setSceneMessage(null)
        }}
        onGenerate={handleGenerate}
        onLoadDemo={handleLoadDemo}
        onUploadRequest={handleUpload}
      />

      <TopToolbar
        onSave={() => useSceneStore.getState().saveSession()}
        onLoad={() => useSceneStore.getState().loadSession()}
        onReset={() => window.location.reload()}
        onFitView={() => canvasRef.current?.fitView()}
        onFrontView={() => canvasRef.current?.setCameraPreset('front')}
        onTopView={() => canvasRef.current?.setCameraPreset('top')}
        onPerspective={() => canvasRef.current?.setCameraPreset('iso')}
      />

      <div className="flex flex-1 overflow-hidden">
        <motion.aside
          initial={false}
          animate={{ width: 280, opacity: 1 }}
          className="relative flex h-full max-w-xs flex-shrink-0 overflow-hidden pl-6 pr-2"
        >
          <ModelTree canvasRef={canvasRef} />
        </motion.aside>

        <div className="relative flex h-full flex-1 pr-2">
          <div className="flex-1 pl-[3.5rem] pr-4">
            <div className="relative h-full w-full">
              <CanvasErrorBoundary key={boundaryKey} onError={handleCanvasError}>
                <ThreeCanvas models={models} ref={canvasRef} canvasKey="editor-canvas" />
              </CanvasErrorBoundary>
              <div className="pointer-events-none absolute inset-0">
                <div className="pointer-events-auto">
                  <CutPlaneControls disabled={!hasModels} />
                </div>
              </div>
              {emptyStateVisible && (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <div className="rounded-3xl border border-dashed border-slate-700 bg-slate-900/70 px-8 py-6 text-center text-sm text-slate-400">
                    {sceneMessage ?? 'Start by generating or uploading a part to populate the workspace.'}
                  </div>
                </div>
              )}
              {statusLabel && (
                <div className="pointer-events-none absolute top-6 left-1/2 -translate-x-1/2 rounded-full bg-slate-900/80 px-4 py-1 text-xs text-slate-200 shadow-lg">
                  {statusLabel}
                </div>
              )}
            </div>
          </div>

          <RightWidgetPanel
            models={models}
            activeModelId={activeModelId}
            onFocusModel={handleFocusModel}
            onRemoveModel={handleRemoveModel}
            canvasRef={canvasRef}
          />
        </div>
      </div>

      <AnimatePresence>
        {!initialModalVisible && (
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 30 }}
            transition={{ type: 'spring', stiffness: 250, damping: 28 }}
          >
            <BottomPromptBar
              value={prompt}
              onChange={(value) => {
                resetError()
                setSceneMessage(null)
                setPrompt(value)
              }}
              onSubmit={handleBottomSubmit}
              isLoading={isLoading}
              error={error}
                  generatorMode={generatorMode}
                  onGeneratorChange={(mode) => {
                    setGeneratorMode(mode)
                    resetError()
                    setSceneMessage(null)
                  }}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

class CanvasErrorBoundary extends Component<{
  onError: (error: Error, errorInfo?: unknown) => void
  children: ReactNode
}> {
  state = { hasError: false }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error: Error, errorInfo: unknown) {
    this.props.onError(error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return null
    }
    return this.props.children
  }
}
