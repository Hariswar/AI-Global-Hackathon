export interface ModelMetadata {
  [key: string]: unknown
}

export interface GeneratedModel {
  id: string
  prompt: string
  url: string
  thumbnailUrl?: string
  metadata?: ModelMetadata
  createdAt: string
}

export interface ModelTransform {
  rotation: {
    x: number
    y: number
    z: number
  }
  scale: number
  baseColor: string
}

export type ModelSource = 'remote' | 'local' | 'dreamfusion' | 'gemini' | 'upload' | 'demo'
export type GeneratorMode = 'auto' | 'remote' | 'local' | 'dreamfusion' | 'gemini'

export interface SceneModel {
  id: string
  name: string
  source: ModelSource
  url: string
  position: [number, number, number]
  metadata?: Record<string, unknown>
}

