import { useMemo, useState, useCallback } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import type { GeneratedModel, ModelMetadata } from '../types'

const HISTORY_KEY = 'sketch-to-sky::history'

interface GenerateResponse {
  url: string
  metadata?: ModelMetadata
  thumbnailUrl?: string
}

const createId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}`

const readHistory = (): GeneratedModel[] => {
  if (typeof window === 'undefined') return []
  try {
    const data = window.localStorage.getItem(HISTORY_KEY)
    if (!data) return []
    const parsed = JSON.parse(data) as GeneratedModel[]
    return Array.isArray(parsed) ? parsed : []
  } catch (error) {
    console.warn('Failed to parse generation history', error)
    return []
  }
}

const persistHistory = (entries: GeneratedModel[]) => {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(HISTORY_KEY, JSON.stringify(entries))
  } catch (error) {
    console.warn('Failed to persist generation history', error)
  }
}

export const useModelGenerator = () => {
  const queryClient = useQueryClient()
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const historyQuery = useQuery({
    queryKey: ['model-history'],
    queryFn: async () => readHistory(),
    initialData: readHistory,
    staleTime: Infinity,
  })

  const upsertHistory = (entry: GeneratedModel) => {
    queryClient.setQueryData<GeneratedModel[]>(['model-history'], (prev) => {
      const list = prev ?? []
      const filtered = list.filter((item) => item.id !== entry.id)
      const next = [entry, ...filtered].slice(0, 20)
      persistHistory(next)
      return next
    })
    setSelectedId(entry.id)
  }

  const mutation = useMutation({
    mutationKey: ['generate-model'],
    mutationFn: async (prompt: string) => {
      if (!prompt.trim()) {
        throw new Error('Prompt is empty. Please describe the aircraft concept you want to generate.')
      }
      const { data } = await axios.post<GenerateResponse>(
        `${import.meta.env.VITE_API_URL}/generate`,
        { text: prompt.trim() },
      )
      if (!data?.url) {
        throw new Error('The AI service returned no model URL.')
      }
      return { ...data, prompt: prompt.trim() }
    },
    onSuccess: (result, prompt) => {
      const entry: GeneratedModel = {
        id: createId(),
        prompt,
        url: result.url,
        thumbnailUrl: result.thumbnailUrl,
        metadata: result.metadata,
        createdAt: new Date().toISOString(),
      }
      upsertHistory(entry)
    },
  })

  const history = historyQuery.data ?? []
  const selectedModel = useMemo(
    () => history.find((item) => item.id === selectedId) ?? history[0] ?? null,
    [history, selectedId],
  )

  const selectModel = (id: string) => {
    setSelectedId(id)
  }

  const clearHistory = () => {
    persistHistory([])
    queryClient.setQueryData(['model-history'], [] as GeneratedModel[])
    setSelectedId(null)
  }

  const generateModel = useCallback(async (prompt: string) => {
    await mutation.mutateAsync(prompt)
  }, [mutation])

  const loadExternalModel = ({
    id = createId(),
    prompt,
    url,
    thumbnailUrl,
    metadata,
    createdAt,
  }: Partial<GeneratedModel> & { url: string }) => {
    const entry: GeneratedModel = {
      id,
      prompt: prompt ?? 'Sample aircraft model',
      url,
      thumbnailUrl,
      metadata,
      createdAt: createdAt ?? new Date().toISOString(),
    }
    upsertHistory(entry)
  }

  return {
    history,
    selectedModel,
    selectModel,
    clearHistory,
    generateModel,
    loadExternalModel,
    isGenerating: mutation.isPending,
    error: mutation.error instanceof Error ? mutation.error : null,
    resetError: mutation.reset,
    isHistoryLoading: historyQuery.isFetching && !historyQuery.isFetched,
  }
}

