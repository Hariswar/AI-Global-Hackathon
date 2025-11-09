import { create } from 'zustand'
import type { Group, Object3D } from 'three'
import { Euler, Vector3, MeshStandardMaterial, Box3, Mesh } from 'three'

export type TransformMode = 'translate' | 'rotate' | 'scale'

type CutAxis = 'x' | 'y' | 'z'

type CutRanges = Record<CutAxis, { min: number; max: number }>

export interface Annotation {
  id: string
  position: [number, number, number]
  text: string
}

interface SceneState {
  transformMode: TransformMode
  selectedObject: Object3D | null
  selectedMeshId: string | null
  showGrid: boolean
  cutPlaneColor: string
  cutPlaneEnabled: boolean
  cutAxis: CutAxis
  cutOffset: number
  cutRanges: CutRanges
  showCutPlane: boolean
  isMeasurementActive: boolean
  measurementPoints: [number, number, number][]
  measurementResult: {
    distance: number
    midpoint: [number, number, number]
  } | null
  annotations: Annotation[]
  isAnnotationMode: boolean
  isExploded: boolean
  sceneRoot: Group | null
  sceneVersion: number
  importedPartIds: string[]

  setSceneRoot: (root: Group | null) => void
  clearSceneSnapshot: () => void
  setTransformMode: (mode: TransformMode) => void
  setSelectedObject: (object: Object3D | null) => void
  setSelectedMeshId: (id: string | null) => void
  selectObjectById: (id: string | null) => void
  toggleGrid: () => void
  setCutAxis: (axis: CutAxis) => void
  setCutOffset: (offset: number) => void
  setCutRanges: (ranges: CutRanges) => void
  setShowCutPlane: (visible: boolean) => void
  setCutPlaneColor: (color: string) => void
  setCutPlaneEnabled: (enabled: boolean) => void
  resetCutPlane: () => void
  getObjectById: (id: string | null) => Object3D | null
  bumpSceneVersion: () => void
  setMeshVisibility: (id: string, visible: boolean) => void
  updateMaterialColor: (id: string, color: string) => void
  updateMaterialOpacity: (id: string, opacity: number) => void
  snapObjectToRoot: (id: string) => void
  registerImportedPart: (id: string) => void

  toggleMeasurement: () => void
  addMeasurementPoint: (point: [number, number, number]) => void
  resetMeasurement: () => void

  setAnnotationMode: (enabled: boolean) => void
  addAnnotation: (position: [number, number, number], note?: string) => void
  updateAnnotation: (id: string, text: string) => void
  removeAnnotation: (id: string) => void

  setExploded: (explode: boolean) => void
  saveSession: () => void
  loadSession: () => boolean
}

const STORAGE_KEY = 'sketch-to-sky::scene-session'

const axes: CutAxis[] = ['x', 'y', 'z']

const defaultRanges: CutRanges = {
  x: { min: -1, max: 1 },
  y: { min: -1, max: 1 },
  z: { min: -1, max: 1 },
}

const toVector3 = (arr: [number, number, number]) =>
  new Vector3(arr[0], arr[1], arr[2])

export const useSceneStore = create<SceneState>((set, get) => ({
  transformMode: 'translate',
  selectedObject: null,
  selectedMeshId: null,
  showGrid: true,
  cutPlaneColor: '#38bdf8',
  cutPlaneEnabled: false,
  cutAxis: 'z',
  cutOffset: 0,
  cutRanges: defaultRanges,
  showCutPlane: false,
  isMeasurementActive: false,
  measurementPoints: [],
  measurementResult: null,
  annotations: [],
  isAnnotationMode: false,
  isExploded: false,
  sceneRoot: null,
  sceneVersion: 0,
  importedPartIds: [],

  setSceneRoot: (root) => set({ sceneRoot: root }),
  clearSceneSnapshot: () => set({ sceneRoot: null }),

  setTransformMode: (mode) => set({ transformMode: mode }),
  setSelectedObject: (object) =>
    set({
      selectedObject: object,
      selectedMeshId: object ? object.uuid : null,
    }),
  setSelectedMeshId: (id) => set({ selectedMeshId: id }),
  selectObjectById: (uuid) => {
    const { sceneRoot } = get()
    let object: Object3D | null = null
    if (uuid && sceneRoot) {
      object = sceneRoot.getObjectByProperty('uuid', uuid) as Object3D | null
    }
    set({
      selectedObject: object ?? null,
      selectedMeshId: object ? object.uuid : null,
    })
  },
  toggleGrid: () => set((state) => ({ showGrid: !state.showGrid })),
  setCutAxis: (axis) => {
    const { cutRanges } = get()
    const range = cutRanges[axis]
    const midpoint = (range.min + range.max) / 2
    const clamped = Math.min(range.max, Math.max(range.min, midpoint))
    set({ cutAxis: axis, cutOffset: clamped })
  },
  setCutOffset: (offset) => {
    const { cutAxis, cutRanges } = get()
    const range = cutRanges[cutAxis]
    const clamped = Math.min(range.max, Math.max(range.min, offset))
    set({ cutOffset: clamped })
  },
  setCutRanges: (ranges) => {
    set((state) => {
      const unchanged = axes.every((axis) => {
        const prev = state.cutRanges[axis]
        const next = ranges[axis]
        return prev.min === next.min && prev.max === next.max
      })
      if (unchanged) {
        return state
      }
      const axis = state.cutAxis
      const range = ranges[axis]
      const midpoint = (range.min + range.max) / 2
      const clamped = Math.min(range.max, Math.max(range.min, state.cutOffset))
      return {
        cutRanges: ranges,
        cutOffset:
          clamped >= range.min && clamped <= range.max ? clamped : midpoint,
      }
    })
  },
  setShowCutPlane: (visible) => set({ showCutPlane: visible }),
  setCutPlaneColor: (color) => set({ cutPlaneColor: color }),
  setCutPlaneEnabled: (enabled) => set({ cutPlaneEnabled: enabled }),
  resetCutPlane: () =>
    set((state) => {
      const range = state.cutRanges['z']
      const midpoint = (range.min + range.max) / 2
      const clamped = Math.min(range.max, Math.max(range.min, midpoint))
      return { cutAxis: 'z', cutOffset: clamped, showCutPlane: false, cutPlaneEnabled: false }
    }),
  getObjectById: (id) => {
    const { sceneRoot } = get()
    if (!id || !sceneRoot) return null
    return sceneRoot.getObjectByProperty('uuid', id) as Object3D | null
  },
  bumpSceneVersion: () =>
    set((state) => ({
      sceneVersion: state.sceneVersion + 1,
    })),
  setMeshVisibility: (id, visible) => {
    const { getObjectById, bumpSceneVersion } = get()
    const object = getObjectById(id)
    if (!object) return
    object.visible = visible
    object.traverse((child) => {
      const mesh = child as Mesh
      if ((mesh as any).isMesh) {
        mesh.visible = visible
      }
    })
    bumpSceneVersion()
  },
  updateMaterialColor: (id, color) => {
    const { getObjectById, bumpSceneVersion } = get()
    const object = getObjectById(id)
    if (!object) return
    const mesh = object as any
    if (!mesh.isMesh) return
    const materials = (Array.isArray(mesh.material)
      ? mesh.material
      : [mesh.material]) as MeshStandardMaterial[]
    materials.forEach((material) => {
      if (!material || !material.color) return
      material.color.set(color)
      material.needsUpdate = true
    })
    bumpSceneVersion()
  },
  updateMaterialOpacity: (id, opacity) => {
    const { getObjectById, bumpSceneVersion } = get()
    const object = getObjectById(id)
    if (!object) return
    const mesh = object as any
    if (!mesh.isMesh) return
    const materials = (Array.isArray(mesh.material)
      ? mesh.material
      : [mesh.material]) as MeshStandardMaterial[]
    materials.forEach((material) => {
      if (!material) return
      material.opacity = opacity
      material.transparent = opacity < 1
      material.needsUpdate = true
    })
    bumpSceneVersion()
  },
  snapObjectToRoot: (id) => {
    const { getObjectById, sceneRoot, bumpSceneVersion } = get()
    const object = getObjectById(id)
    if (!object || !sceneRoot) return
    const rootBox = new Box3().setFromObject(sceneRoot)
    const objectBox = new Box3().setFromObject(object)
    if (rootBox.isEmpty() || objectBox.isEmpty()) return
    const rootCenter = rootBox.getCenter(new Vector3())
    const objectCenter = objectBox.getCenter(new Vector3())
    const parent = object.parent
    if (parent) {
      const localRoot = parent.worldToLocal(rootCenter.clone())
      const localObject = parent.worldToLocal(objectCenter.clone())
      object.position.add(localRoot.sub(localObject))
    } else {
      object.position.add(rootCenter.clone().sub(objectCenter))
    }
    object.updateMatrixWorld()
    bumpSceneVersion()
  },
  registerImportedPart: (id) =>
    set((state) => {
      const already = state.importedPartIds.includes(id)
      const nextIds = already ? state.importedPartIds : [...state.importedPartIds, id]
      return {
        importedPartIds: nextIds,
        sceneVersion: state.sceneVersion + (already ? 0 : 1),
      }
    }),
  toggleMeasurement: () =>
    set((state) => ({
      isMeasurementActive: !state.isMeasurementActive,
      measurementPoints: [],
      measurementResult: null,
    })),

  addMeasurementPoint: (point) => {
    const { measurementPoints, isMeasurementActive } = get()
    if (!isMeasurementActive) return

    const nextPoints =
      measurementPoints.length >= 2
        ? [measurementPoints[1], point]
        : [...measurementPoints, point]

    if (nextPoints.length === 2) {
      const [a, b] = nextPoints.map(toVector3)
      const distance = a.distanceTo(b)
      const midpoint = a.clone().add(b).multiplyScalar(0.5).toArray() as [number, number, number]

      set({
        measurementPoints: nextPoints,
        measurementResult: { distance, midpoint },
      })

      window.setTimeout(() => {
        set({
          measurementPoints: [],
          measurementResult: null,
          isMeasurementActive: false,
        })
      }, 3500)
    } else {
      set({ measurementPoints: nextPoints })
    }
  },

  resetMeasurement: () =>
    set({
      measurementPoints: [],
      measurementResult: null,
      isMeasurementActive: false,
    }),

  setAnnotationMode: (enabled) => set({ isAnnotationMode: enabled }),
  addAnnotation: (position, note = 'Annotation') =>
    set((state) => ({
      annotations: [
        ...state.annotations,
        {
          id:
            typeof crypto !== 'undefined' && crypto.randomUUID
              ? crypto.randomUUID()
              : `${Date.now()}`,
          position,
          text: note,
        },
      ],
    })),
  updateAnnotation: (id, text) =>
    set((state) => ({
      annotations: state.annotations.map((annotation) =>
        annotation.id === id ? { ...annotation, text } : annotation,
      ),
    })),
  removeAnnotation: (id) =>
    set((state) => ({
      annotations: state.annotations.filter((annotation) => annotation.id !== id),
    })),

  setExploded: (explode) => set({ isExploded: explode }),

  saveSession: () => {
    const {
      sceneRoot,
      annotations,
      transformMode,
      cutAxis,
      cutOffset,
      cutRanges,
      showCutPlane,
    } = get()
    if (!sceneRoot) return

    const transforms: Record<
      string,
      {
        position: [number, number, number]
        rotation: [number, number, number]
        scale: [number, number, number]
      }
    > = {}

    sceneRoot.traverse((child) => {
      const mesh = child as Object3D
      if ((mesh as any).isMesh) {
        transforms[mesh.uuid] = {
          position: mesh.position.toArray() as [number, number, number],
          rotation: [mesh.rotation.x, mesh.rotation.y, mesh.rotation.z],
          scale: mesh.scale.toArray() as [number, number, number],
        }
      }
    })

    const payload = {
      transforms,
      annotations,
      transformMode,
      cutAxis,
      cutOffset,
      cutRanges,
      showCutPlane,
      timestamp: Date.now(),
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
  },

  loadSession: () => {
    const raw = localStorage.getItem(STORAGE_KEY)
    const { sceneRoot } = get()
    if (!raw || !sceneRoot) return false

    try {
      const parsed = JSON.parse(raw) as {
        transforms: Record<
          string,
          {
            position: [number, number, number]
            rotation: [number, number, number]
            scale: [number, number, number]
          }
        >
        annotations: Annotation[]
        transformMode: TransformMode
        cutAxis?: CutAxis
        cutOffset?: number
        cutRanges?: CutRanges
        showCutPlane?: boolean
      }

      sceneRoot.traverse((child) => {
        const mesh = child as Object3D
        if ((mesh as any).isMesh && parsed.transforms[mesh.uuid]) {
          const snapshot = parsed.transforms[mesh.uuid]
          mesh.position.fromArray(snapshot.position)
          mesh.rotation.copy(
            new Euler(snapshot.rotation[0], snapshot.rotation[1], snapshot.rotation[2]),
          )
          mesh.scale.fromArray(snapshot.scale)
          mesh.updateMatrixWorld()
        }
      })

      set((state) => ({
        annotations: parsed.annotations ?? [],
        transformMode: parsed.transformMode ?? state.transformMode,
        cutAxis: parsed.cutAxis ?? state.cutAxis,
        cutOffset: parsed.cutOffset ?? state.cutOffset,
        cutRanges: parsed.cutRanges ?? state.cutRanges,
        showCutPlane: parsed.showCutPlane ?? state.showCutPlane,
        selectedObject: null,
      }))

      return true
    } catch (error) {
      console.warn('Failed to load saved session', error)
      return false
    }
  },
}))

