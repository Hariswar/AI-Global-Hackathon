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

