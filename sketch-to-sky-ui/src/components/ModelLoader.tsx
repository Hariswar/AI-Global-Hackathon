import { useCallback, useState } from 'react'
import axios from 'axios'
import type { SceneModel, GeneratorMode, ModelSource } from '../types'

const DEMO_MODEL_PATH =
  'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/DamagedHelmet/glTF-Binary/DamagedHelmet.glb'

const createId = () => (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}`)

type ApiPayload = {
  message?: string
  public_url?: string
  gcs_path?: string
  source?: string
  [key: string]: unknown
}

type WingParameters = {
  root_chord: number
  semi_span: number
  sweep_angle_deg: number
  taper_ratio: number
}

interface UseModelLoaderReturn {
  isLoading: boolean
  error: Error | null
  resetError: () => void
  generateFromPrompt: (prompt: string, generator: GeneratorMode) => Promise<SceneModel>
  loadDemoModel: () => Promise<SceneModel>
  uploadLocalModel: (file: File) => Promise<SceneModel>
}

const DEFAULT_SOURCE_NAMES: Record<ModelSource, string> = {
  remote: 'Remote wing model',
  local: 'Local wing model',
  dreamfusion: 'DreamFusion wing model',
  gemini: 'Gemini-assisted wing model',
  parametric: 'Parametric wing model',
  upload: 'Imported part',
  demo: 'Demo aircraft sample',
}

const buildModelItem = (
  source: ModelSource,
  url: string,
  name?: string,
  metadata?: Record<string, unknown>,
): SceneModel => ({
  id: createId(),
  name: name ?? DEFAULT_SOURCE_NAMES[source],
  source,
  url,
  position: [0, 0, 0],
  metadata,
})

const extractNumber = (patterns: RegExp[], text: string, fallback: number) => {
  for (const pattern of patterns) {
    const match = pattern.exec(text)
    if (match) {
      const value = Number(match[1])
      if (!Number.isNaN(value) && Number.isFinite(value)) {
        return value
      }
    }
  }
  return fallback
}

const buildWingParametersFromPrompt = (prompt: string): WingParameters => {
  const lower = prompt.toLowerCase()

  const semiSpan = extractNumber(
    [
      /(\d+(?:\.\d+)?)\s*(?:m|meter(?:s)?)?\s*(?:wingspan|span)/,
      /span[:=]\s*(\d+(?:\.\d+)?)/,
    ],
    lower,
    10,
  )

  const rootChord = extractNumber(
    [
      /(\d+(?:\.\d+)?)\s*(?:m|meter(?:s)?)?\s*(?:root\s*chord|chord)/,
      /root\s*chord[:=]\s*(\d+(?:\.\d+)?)/,
    ],
    lower,
    2,
  )

  const sweep = extractNumber(
    [
      /(\d+(?:\.\d+)?)\s*(?:°|deg(?:rees)?)?\s*(?:sweep)/,
      /sweep[:=]\s*(\d+(?:\.\d+)?)/,
    ],
    lower,
    25,
  )

  const taper = extractNumber(
    [/(\d+(?:\.\d+)?)\s*(?:taper(?:\s*ratio)?)/, /taper(?:\s*ratio)?[:=]\s*(\d+(?:\.\d+)?)/],
    lower,
    0.5,
  )

  return {
    root_chord: Math.max(rootChord, 0.1),
    semi_span: Math.max(semiSpan, 0.5),
    sweep_angle_deg: sweep,
    taper_ratio: Math.max(taper, 0.1),
  }
}

export function useModelLoader(): UseModelLoaderReturn {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const resetError = useCallback(() => {
    setError(null)
  }, [])

  const generateFromPrompt = useCallback(async (prompt: string, generator: GeneratorMode) => {
    const trimmed = prompt.trim()
    if (!trimmed) {
      const validationError = new Error('Please enter a prompt before generating a model.')
      setError(validationError)
      throw validationError
    }

    const parameters = buildWingParametersFromPrompt(trimmed)

    setIsLoading(true)
    setError(null)
    try {
      const response = await axios.post<ApiPayload>(`${import.meta.env.VITE_API_URL}/generate`, {
        ...parameters,
        prompt_text: trimmed,
        generator,
      })
      const payload = response.data

      const candidateUrl =
        (typeof payload.viewer_url === 'string' && payload.viewer_url.trim()) ||
        (typeof payload.public_url === 'string' && payload.public_url.trim())

      if (!candidateUrl) {
        throw new Error('AI service did not return a usable model URL.')
      }

      const sourceLabel = (payload.source ?? 'remote').toString().toLowerCase()
      const source: ModelSource =
        sourceLabel === 'local'
          ? 'local'
          : sourceLabel === 'dreamfusion'
            ? 'dreamfusion'
            : sourceLabel === 'gemini'
              ? 'gemini'
              : sourceLabel === 'parametric'
                ? 'parametric'
                : 'remote'

      const modelName =
        source === 'local'
          ? 'Local wing model'
          : source === 'dreamfusion'
            ? 'DreamFusion wing model'
            : source === 'gemini'
              ? 'Gemini-assisted wing model'
              : source === 'parametric'
                ? 'Parametric wing model'
                : 'Remote wing model'

      return buildModelItem(source, candidateUrl, modelName, payload as Record<string, unknown>)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to generate model.'
      const wrapped = new Error(message)
      setError(wrapped)
      throw wrapped
    } finally {
      setIsLoading(false)
    }
  }, [])

  const loadDemoModel = useCallback(async () => {
    setError(null)
    return buildModelItem('demo', DEMO_MODEL_PATH, 'Demo aircraft sample')
  }, [])

  const uploadLocalModel = useCallback(async (file: File) => {
    if (!file) {
      const validationError = new Error('No file selected for upload.')
      setError(validationError)
      throw validationError
    }

    const extension = file.name.split('.').pop()?.toLowerCase()
    if (!extension || !['glb', 'gltf'].includes(extension)) {
      const validationError = new Error('Unsupported file type. Please upload a .glb or .gltf file.')
      setError(validationError)
      throw validationError
    }

    setIsLoading(true)
    setError(null)
    try {
      const objectUrl = URL.createObjectURL(file)
      return buildModelItem('upload', objectUrl, file.name.replace(/\.[^.]+$/, ''))
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load the selected model.'
      const wrapped = new Error(message)
      setError(wrapped)
      throw wrapped
    } finally {
      setIsLoading(false)
    }
  }, [])

  return {
    isLoading,
    error,
    resetError,
    generateFromPrompt,
    loadDemoModel,
    uploadLocalModel,
  }
}
