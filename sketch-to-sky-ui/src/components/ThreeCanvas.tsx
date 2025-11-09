import {
  forwardRef,
  Suspense,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  type MutableRefObject,
} from 'react'
import type { ThreeEvent } from '@react-three/fiber'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import {
  ContactShadows,
  Environment,
  Html,
  OrbitControls,
  TransformControls,
  useGLTF,
} from '@react-three/drei'
import {
  Box3,
  Color,
  Group,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  PerspectiveCamera,
  Plane,
  Sphere,
  Vector3,
  DoubleSide,
  BufferAttribute,
  BufferGeometry,
  Line as ThreeLine,
  LineBasicMaterial,
  WebGLRenderer,
} from 'three'
import { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import { SkeletonUtils } from 'three-stdlib'
import * as TWEEN from '@tweenjs/tween.js'

import { useSceneStore } from '../hooks/useSceneStore'
import type { SceneModel } from '../types'

export type ThreeCanvasHandle = {
  fitView: () => void
  setCameraPreset: (preset: 'front' | 'top' | 'left' | 'iso') => void
  focusOnObject: (uuid: string) => void
  focusOnModel: (modelId: string) => void
}

type ThreeCanvasProps = {
  models: SceneModel[]
  modelTransformOffset?: number
  isLoading?: boolean
  canvasKey?: string
}

type SceneContentProps = {
  models: SceneModel[]
  groupRef: MutableRefObject<Group | null>
  orbitRef: MutableRefObject<OrbitControlsImpl | null>
  cameraRef: MutableRefObject<PerspectiveCamera | null>
  boundingRadiusRef: MutableRefObject<number>
  onModelGroupChange: (id: string, group: Group | null) => void
}

type CutAxis = 'x' | 'y' | 'z'

const axisOptions: CutAxis[] = ['x', 'y', 'z']

function AnnotationMarker({
  id,
  position,
  text,
}: {
  id: string
  position: [number, number, number]
  text: string
}) {
  const updateAnnotation = useSceneStore((state) => state.updateAnnotation)
  const removeAnnotation = useSceneStore((state) => state.removeAnnotation)
  const markerRef = useRef<Mesh>(null)
  const labelGroup = useRef<Group>(null)

  useFrame(({ camera }) => {
    if (markerRef.current) {
      const distance = markerRef.current.position.distanceTo(camera.position)
      const scale = Math.max(distance * 0.02, 0.05)
      markerRef.current.scale.setScalar(scale)
    }
    if (labelGroup.current) {
      labelGroup.current.quaternion.copy(camera.quaternion)
    }
  })

  return (
    <group position={position}>
      <mesh ref={markerRef}>
        <sphereGeometry args={[0.04, 16, 16]} />
        <meshStandardMaterial color="#facc15" emissive="#facc15" emissiveIntensity={0.4} />
      </mesh>
      <group ref={labelGroup} position={[0, 0.3, 0]}>
        <Html
          distanceFactor={12}
          className="rounded-lg border border-slate-700 bg-slate-900/90 px-3 py-2 text-xs text-slate-200 shadow-lg backdrop-blur"
          style={{ pointerEvents: 'auto' }}
        >
          <div className="flex items-center gap-2">
            <input
              value={text}
              onChange={(event) => updateAnnotation(id, event.target.value)}
              className="w-40 rounded bg-transparent text-xs text-slate-100 outline-none"
            />
            <button
              type="button"
              onClick={() => removeAnnotation(id)}
              className="rounded bg-rose-500/20 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-rose-200 hover:bg-rose-500/40"
            >
              ×
            </button>
          </div>
        </Html>
      </group>
    </group>
  )
}

function CutPlaneControls({ disabled = false }: { disabled?: boolean }) {
  const cutAxis = useSceneStore((state) => state.cutAxis)
  const cutOffset = useSceneStore((state) => state.cutOffset)
  const showCutPlane = useSceneStore((state) => state.showCutPlane)
  const cutPlaneEnabled = useSceneStore((state) => state.cutPlaneEnabled)
  const cutPlaneColor = useSceneStore((state) => state.cutPlaneColor)
  const cutRanges = useSceneStore((state) => state.cutRanges)
  const setCutAxis = useSceneStore((state) => state.setCutAxis)
  const setCutOffset = useSceneStore((state) => state.setCutOffset)
  const setShowCutPlane = useSceneStore((state) => state.setShowCutPlane)
  const setCutPlaneColor = useSceneStore((state) => state.setCutPlaneColor)
  const setCutPlaneEnabled = useSceneStore((state) => state.setCutPlaneEnabled)
  const resetCutPlane = useSceneStore((state) => state.resetCutPlane)
  const hasScene = useSceneStore((state) => Boolean(state.sceneRoot))

  const range = cutRanges[cutAxis]
  const min = range.min
  const max = range.max
  const span = Math.max(max - min, 1e-3)

  const isDisabled = disabled || !hasScene

  return (
    <div className="pointer-events-auto absolute left-6 top-6 z-30 w-56 rounded-2xl border border-slate-700 bg-slate-900/80 p-4 text-xs text-slate-200 shadow-xl backdrop-blur">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
          Cut Plane
        </span>
        <button
          type="button"
          onClick={resetCutPlane}
          className="rounded-full border border-slate-700 px-2 py-0.5 text-[10px] text-slate-300 transition hover:border-slate-500 hover:bg-slate-800"
          disabled={isDisabled}
        >
          Reset
        </button>
      </div>

      <div className="mb-3 grid grid-cols-3 gap-2">
        {axisOptions.map((axis) => (
          <button
            key={axis}
            type="button"
            onClick={() => {
              if (!cutPlaneEnabled) setCutPlaneEnabled(true)
              setCutAxis(axis)
            }}
            disabled={isDisabled}
            className={`rounded-lg px-2 py-1 text-[11px] font-semibold uppercase transition ${
              cutAxis === axis
                ? 'bg-sky-500/30 text-sky-200 ring-1 ring-sky-400/60'
                : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
            } ${isDisabled ? 'cursor-not-allowed opacity-50' : ''}`}
          >
            {axis}
          </button>
        ))}
      </div>

      <div className="mb-3 text-[10px] uppercase tracking-wide text-slate-400">
        Offset: <span className="text-slate-200">{cutOffset.toFixed(3)}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={span / 200}
        value={cutOffset}
        disabled={isDisabled}
        onChange={(event) => {
          if (!cutPlaneEnabled) setCutPlaneEnabled(true)
          setCutOffset(Number(event.target.value))
        }}
        className="w-full accent-sky-500"
      />

      <label className="mt-3 flex items-center justify-between text-[11px] text-slate-300">
        <span>Enable Cutting</span>
        <input
          type="checkbox"
          checked={cutPlaneEnabled}
          disabled={isDisabled}
          onChange={(event) => setCutPlaneEnabled(event.target.checked)}
          className="h-4 w-4 accent-sky-500"
        />
      </label>

      <label className="mt-3 flex items-center justify-between text-[11px] text-slate-300">
        <span>Show Plane</span>
        <input
          type="checkbox"
          checked={showCutPlane}
          disabled={isDisabled}
          onChange={(event) => setShowCutPlane(event.target.checked)}
          className="h-4 w-4 accent-sky-500"
        />
      </label>

      <div className="mt-3 text-[11px] text-slate-300">
        <span className="font-semibold uppercase tracking-wide text-slate-400">Plane Color</span>
        <div className="mt-2 flex items-center justify-between gap-2">
          <input
            type="color"
            value={cutPlaneColor}
            disabled={isDisabled}
            onChange={(event) => setCutPlaneColor(event.target.value)}
            className="h-6 w-12 cursor-pointer rounded border border-slate-600 bg-transparent p-0"
          />
          <span className="rounded-full bg-slate-800 px-2 py-1 text-[10px] uppercase tracking-wide text-slate-400">
            {cutPlaneColor.toUpperCase()}
          </span>
        </div>
      </div>
    </div>
  )
}

function StableLine({ points, color = '#38bdf8' }: { points: Vector3[]; color?: string }) {
  const geometry = useMemo(() => new BufferGeometry(), [])
  const material = useMemo(() => new LineBasicMaterial({ color }), [color])
  const line = useMemo(() => new ThreeLine(geometry, material), [geometry, material])

  useEffect(() => {
    const array = new Float32Array(points.length * 3)
    points.forEach((point, index) => {
      array[index * 3] = point.x
      array[index * 3 + 1] = point.y
      array[index * 3 + 2] = point.z
    })
    geometry.setAttribute('position', new BufferAttribute(array, 3))
    geometry.computeBoundingSphere()
  }, [points, geometry])

  useEffect(() => {
    return () => {
      geometry.dispose()
      material.dispose()
    }
  }, [geometry, material])

  return <primitive object={line} />
}

function SceneContent({
  models,
  groupRef,
  orbitRef,
  cameraRef,
  boundingRadiusRef,
  onModelGroupChange,
}: SceneContentProps) {
  const localGroupRef = useRef<Group>(null)
  const planeMeshRef = useRef<Mesh>(null)
  const animatedOffset = useRef(0)
  const boundingCenter = useRef(new Vector3())
  const planeRef = useRef(new Plane(new Vector3(0, 0, 1), 0))
  const modelGroupsRef = useRef<Map<string, Group>>(new Map())
  const { camera, gl } = useThree()

  const {
    transformMode,
    selectedObject,
    isMeasurementActive,
    addMeasurementPoint,
    isAnnotationMode,
    addAnnotation,
    annotations,
    measurementPoints,
    measurementResult,
    setSceneRoot,
    isExploded,
    showGrid,
    selectObjectById,
    selectedMeshId,
    sceneVersion,
    cutAxis,
    cutOffset,
    setCutRanges,
    showCutPlane,
    cutRanges,
    cutPlaneEnabled,
    cutPlaneColor,
  } = useSceneStore((state) => ({
    transformMode: state.transformMode,
    selectedObject: state.selectedObject,
    isMeasurementActive: state.isMeasurementActive,
    addMeasurementPoint: state.addMeasurementPoint,
    isAnnotationMode: state.isAnnotationMode,
    addAnnotation: state.addAnnotation,
    annotations: state.annotations,
    measurementPoints: state.measurementPoints,
    measurementResult: state.measurementResult,
    setSceneRoot: state.setSceneRoot,
    isExploded: state.isExploded,
    showGrid: state.showGrid,
    selectObjectById: state.selectObjectById,
    selectedMeshId: state.selectedMeshId,
    sceneVersion: state.sceneVersion,
    cutAxis: state.cutAxis,
    cutOffset: state.cutOffset,
    setCutRanges: state.setCutRanges,
    showCutPlane: state.showCutPlane,
    cutRanges: state.cutRanges,
    cutPlaneEnabled: state.cutPlaneEnabled,
    cutPlaneColor: state.cutPlaneColor,
  }))

  const originalPositions = useRef<Map<string, Vector3>>(new Map())

  const axisNormal = useMemo(() => {
    switch (cutAxis) {
      case 'x':
        return new Vector3(1, 0, 0)
      case 'y':
        return new Vector3(0, 1, 0)
      default:
        return new Vector3(0, 0, 1)
    }
  }, [cutAxis])

  const updatePlanePosition = useCallback(
    (offset: number) => {
      animatedOffset.current = offset
      const normal = axisNormal.clone().normalize()
      planeRef.current.normal.copy(normal)
      const planePoint = boundingCenter.current.clone()
      planePoint[cutAxis] += offset
      planeRef.current.constant = -normal.dot(planePoint)

      if (cutPlaneEnabled) {
        gl.clippingPlanes = [planeRef.current]
      } else {
        gl.clippingPlanes = []
      }

      if (planeMeshRef.current) {
        const position = boundingCenter.current.clone()
        position[cutAxis] += offset
        planeMeshRef.current.position.copy(position)
        planeMeshRef.current.rotation.set(0, 0, 0)
        if (cutAxis === 'x') {
          planeMeshRef.current.rotation.y = Math.PI / 2
        } else if (cutAxis === 'y') {
          planeMeshRef.current.rotation.x = -Math.PI / 2
        }
      }
    },
    [axisNormal, cutAxis, cutPlaneEnabled, gl],
  )

  const registerModelGroup = useCallback(
    (id: string, group: Group | null) => {
      if (group) {
        group.userData.modelId = id
        modelGroupsRef.current.set(id, group)
        group.traverse((child) => {
          const mesh = child as Mesh
          if (!mesh.isMesh) return
          mesh.castShadow = true
          mesh.receiveShadow = true
          mesh.userData.modelId = id
          if (!originalPositions.current.has(mesh.uuid)) {
            originalPositions.current.set(mesh.uuid, mesh.position.clone())
          }
        })
        useSceneStore.getState().bumpSceneVersion()
      } else {
        const existing = modelGroupsRef.current.get(id)
        if (existing) {
          existing.traverse((child) => {
            const mesh = child as Mesh
            if (!mesh.isMesh) return
            originalPositions.current.delete(mesh.uuid)
          })
        }
        modelGroupsRef.current.delete(id)
      }
      onModelGroupChange(id, group)
    },
    [onModelGroupChange],
  )

  const handlePointerDown = useCallback(
    (event: ThreeEvent<PointerEvent>) => {
      event.stopPropagation()
      const point = event.point
      const object = event.object as Object3D

      if (isMeasurementActive) {
        addMeasurementPoint(point.toArray() as [number, number, number])
        return
      }

      if (isAnnotationMode) {
        addAnnotation(point.toArray() as [number, number, number])
        return
      }

      selectObjectById(object.uuid)
    },
    [addAnnotation, addMeasurementPoint, isAnnotationMode, isMeasurementActive, selectObjectById],
  )

  const measurementVectors = useMemo(
    () => measurementPoints.map((coords) => new Vector3(...coords)),
    [measurementPoints],
  )

  const planeSizeForAxis = useMemo<[number, number]>(() => {
    const ranges = cutRanges
    if (!ranges) return [1, 1]
    switch (cutAxis) {
      case 'x':
        return [Math.max(ranges.z.max - ranges.z.min, 0.1), Math.max(ranges.y.max - ranges.y.min, 0.1)]
      case 'y':
        return [Math.max(ranges.x.max - ranges.x.min, 0.1), Math.max(ranges.z.max - ranges.z.min, 0.1)]
      default:
        return [Math.max(ranges.x.max - ranges.x.min, 0.1), Math.max(ranges.y.max - ranges.y.min, 0.1)]
    }
  }, [cutAxis, cutRanges])

  useEffect(() => {
    setSceneRoot(localGroupRef.current)
  }, [setSceneRoot])

  useEffect(() => {
    const root = localGroupRef.current
    if (!root || models.length === 0) {
      boundingRadiusRef.current = 2
      boundingCenter.current.set(0, 0, 0)
      setCutRanges({
        x: { min: -1, max: 1 },
        y: { min: -1, max: 1 },
        z: { min: -1, max: 1 },
      })
      return
    }

    const box = new Box3().setFromObject(root)
    if (!box.isEmpty()) {
      const size = box.getSize(new Vector3())
      const sphere = box.getBoundingSphere(new Sphere())
      if (sphere) {
        boundingRadiusRef.current = sphere.radius
        boundingCenter.current.copy(sphere.center)
      }
      setCutRanges({
        x: { min: box.min.x, max: box.max.x },
        y: { min: box.min.y, max: box.max.y },
        z: { min: box.min.z, max: box.max.z },
      })
      const offset = Math.max(size.length(), 4)
      camera.position.set(boundingCenter.current.x + offset, boundingCenter.current.y + offset * 0.6, boundingCenter.current.z + offset)
      camera.lookAt(boundingCenter.current)
      camera.updateProjectionMatrix()
    }
  }, [models, sceneVersion, camera, boundingRadiusRef, setCutRanges])

  useEffect(() => {
    updatePlanePosition(cutOffset)
  }, [cutOffset, updatePlanePosition])

  useEffect(() => {
    updatePlanePosition(animatedOffset.current)
  }, [cutAxis, updatePlanePosition])

useEffect(() => {
  updatePlanePosition(animatedOffset.current)
}, [showCutPlane, cutPlaneEnabled, updatePlanePosition])

  useEffect(() => {
    gl.localClippingEnabled = true
    return () => {
      gl.localClippingEnabled = false
      gl.clippingPlanes = []
    }
  }, [gl])

  useFrame(() => {
    try {
      const diff = cutOffset - animatedOffset.current
      if (Math.abs(diff) > 1e-4) {
        updatePlanePosition(animatedOffset.current + diff * 0.2)
      }
      TWEEN.update()
    } catch (error) {
      console.warn('Frame update error suppressed to keep renderer alive.', error)
    }
  })

  useEffect(() => {
    const root = localGroupRef.current
    if (!root) return
    modelGroupsRef.current.forEach((group) => {
      group.traverse((child) => {
        const mesh = child as Mesh
        if (!mesh.isMesh) return
        const origin = originalPositions.current.get(mesh.uuid)
        if (!origin) {
          originalPositions.current.set(mesh.uuid, mesh.position.clone())
        }
        const target = origin ? origin.clone() : mesh.position.clone()
        if (isExploded) {
          const worldPosition = mesh.getWorldPosition(new Vector3())
          const direction = worldPosition.clone().sub(boundingCenter.current)
          if (direction.lengthSq() === 0) direction.set(0, 1, 0)
          target.copy(origin ?? mesh.position).add(direction.normalize().multiplyScalar(0.35))
        }
        new TWEEN.Tween(mesh.position)
          .to(target, 550)
          .easing(TWEEN.Easing.Quadratic.Out)
          .start()
      })
    })
  }, [isExploded, sceneVersion])

  useEffect(() => {
    groupRef.current = localGroupRef.current
    cameraRef.current = camera as PerspectiveCamera
  }, [camera, groupRef, cameraRef])

  return (
    <>
      <group ref={localGroupRef} onPointerDown={handlePointerDown} onPointerMissed={() => selectObjectById(null)}>
        {models.map((model) => (
          <ModelInstance key={model.id} model={model} registerGroup={registerModelGroup} />
        ))}
      </group>

      {selectedObject && (
        <TransformControls
          object={selectedObject}
          mode={transformMode}
          size={0.9}
          onMouseDown={() => {
            if (orbitRef.current) orbitRef.current.enabled = false
          }}
          onMouseUp={() => {
            if (orbitRef.current) orbitRef.current.enabled = true
          }}
        />
      )}

      <OrbitControls
        ref={orbitRef}
        makeDefault
        enableDamping
        dampingFactor={0.08}
        maxPolarAngle={Math.PI - 0.2}
        minDistance={boundingRadiusRef.current * 0.4}
        maxDistance={boundingRadiusRef.current * 4}
        enabled={!isMeasurementActive}
      />

      {measurementVectors.length === 2 && (
        <>
          <StableLine points={measurementVectors} color="#38bdf8" />
          {measurementResult && (
            <Html
              position={measurementResult.midpoint}
              distanceFactor={10}
              className="rounded-full bg-sky-500/90 px-3 py-1 text-xs font-semibold text-slate-900 shadow-lg"
            >
              {measurementResult.distance.toFixed(3)} m
            </Html>
          )}
        </>
      )}

      {annotations.map((annotation) => (
        <AnnotationMarker key={annotation.id} {...annotation} />
      ))}

      {showCutPlane && (
        <mesh ref={planeMeshRef}>
          <planeGeometry args={[planeSizeForAxis[0], planeSizeForAxis[1]]} />
          <meshBasicMaterial color={cutPlaneColor} opacity={0.15} transparent side={DoubleSide} />
        </mesh>
      )}

      <HighlightSelection selectedMeshId={selectedMeshId} />

      {showGrid && (
        <>
          <gridHelper args={[100, 50, '#888888', '#444444']} position={[0, -0.02, 0]} />
          <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.021, 0]}>
            <planeGeometry args={[200, 200]} />
            <meshStandardMaterial color="#0f172a" transparent opacity={0.25} clipShadows={false} />
          </mesh>
        </>
      )}

      <Environment preset="city" />
      <ContactShadows position={[0, -1.1, 0]} opacity={0.5} blur={2} far={8} width={10} height={10} />
    </>
  )
}

export { CutPlaneControls }

function HighlightSelection({ selectedMeshId }: { selectedMeshId: string | null }) {
  const sceneRoot = useSceneStore((state) => state.sceneRoot)
  const sceneVersion = useSceneStore((state) => state.sceneVersion)

  useEffect(() => {
    if (!sceneRoot) return
    sceneRoot.traverse((child) => {
      const mesh = child as Mesh
      if (!mesh.isMesh) return

      const materials = Array.isArray(mesh.material)
        ? mesh.material
        : [mesh.material]
      materials.forEach((material) => {
        if (!material) return
        const mat = material as MeshStandardMaterial
        if (!mat.userData.__originalEmissiveHex) {
          const emissive = mat.emissive ? mat.emissive.clone() : new Color(0, 0, 0)
          mat.userData.__originalEmissiveHex = emissive.getHex()
        }
        if (!mat.userData.__originalColorHex) {
          const base = mat.color ? mat.color.clone() : new Color(0xffffff)
          mat.userData.__originalColorHex = base.getHex()
        }

        if (mesh.uuid === selectedMeshId) {
          mat.emissive.set('#38bdf8')
          mat.emissiveIntensity = 0.6
        } else {
          const originalHex = mat.userData.__originalEmissiveHex as number | undefined
          mat.emissive.setHex(originalHex ?? 0x000000)
          mat.emissiveIntensity = 0
        }
        mat.needsUpdate = true
      })
    })
  }, [sceneRoot, selectedMeshId, sceneVersion])

  return null
}

function LoaderFallback() {
  return (
    <Html center>
      <div className="rounded-2xl border border-slate-700 bg-slate-900/80 px-6 py-3 text-sm text-slate-200 shadow-xl backdrop-blur">
        Loading model...
      </div>
    </Html>
  )
}

interface ModelInstanceProps {
  model: SceneModel
  registerGroup: (id: string, group: Group | null) => void
}

function ModelInstance({ model, registerGroup }: ModelInstanceProps) {
  const gltf = useGLTF(model.url)
  const normalizedScene = useMemo<Group>(() => {
    if (!gltf?.scene) return new Group()
    const clone = SkeletonUtils.clone(gltf.scene) as Group
    const box = new Box3().setFromObject(clone)
    if (!box.isEmpty()) {
      const center = box.getCenter(new Vector3())
      clone.position.sub(center)
      const size = box.getSize(new Vector3())
      const maxDimension = Math.max(size.x, size.y, size.z)
      if (maxDimension > 0) {
        const scale = 3.5 / maxDimension
        clone.scale.setScalar(scale)
      }
    }
    clone.traverse((child) => {
      const mesh = child as Mesh
      if (!mesh.isMesh) return
      mesh.castShadow = true
      mesh.receiveShadow = true
    })
    return clone
  }, [gltf?.scene])

  const wrapperRef = useRef<Group>(null)

  useEffect(() => {
    const wrapper = wrapperRef.current
    if (!wrapper) return
    wrapper.position.set(...model.position)
    wrapper.name = model.name
    wrapper.userData.modelId = model.id
    registerGroup(model.id, wrapper)
    return () => {
      registerGroup(model.id, null)
      try {
        useGLTF.clear(model.url)
      } catch (error) {
        console.warn(`Failed to clear GLTF cache for ${model.url}`, error)
      }
    }
  }, [model, registerGroup])

  return (
    <group ref={wrapperRef}>
      <primitive object={normalizedScene} dispose={null} />
    </group>
  )
}

export const ThreeCanvas = forwardRef<ThreeCanvasHandle, ThreeCanvasProps>(function ThreeCanvas(
  { models, modelTransformOffset = 2.2, canvasKey },
  ref,
) {
  const groupRef = useRef<Group | null>(null)
  const orbitRef = useRef<OrbitControlsImpl | null>(null)
  const cameraRef = useRef<PerspectiveCamera | null>(null)
  const boundingRadiusRef = useRef(1)
  const rendererRef = useRef<WebGLRenderer | null>(null)
  const modelGroupsRef = useRef<Map<string, Group>>(new Map())

  useEffect(() => {
    return () => {
      const renderer = rendererRef.current
      if (!renderer) return
      try {
        renderer.dispose()
        renderer.forceContextLoss?.()
        const context = renderer.getContext()
        const loseContext = context?.getExtension('WEBGL_lose_context')
        loseContext?.loseContext()
      } catch (error) {
        console.warn('Warning: failed to dispose renderer cleanly.', error)
      } finally {
        rendererRef.current = null
      }
    }
  }, [])

  const handleModelGroupChange = useCallback((id: string, group: Group | null) => {
    if (group) {
      modelGroupsRef.current.set(id, group)
    } else {
      modelGroupsRef.current.delete(id)
    }
  }, [])

  useImperativeHandle(ref, () => ({
    fitView: () => {
      const group = groupRef.current
      const camera = cameraRef.current
      const controls = orbitRef.current
      if (!group || !camera || !controls) return

      const box = new Box3().setFromObject(group)
      if (box.isEmpty()) return
      const sphere = box.getBoundingSphere(new Sphere())
      if (!sphere) return

      const distance = sphere.radius * modelTransformOffset
      const offset = new Vector3(distance, distance * 0.6, distance)
      camera.position.copy(sphere.center.clone().add(offset))
      controls.target.copy(sphere.center)
      controls.update()
    },
    setCameraPreset: (preset) => {
      const controls = orbitRef.current
      const camera = cameraRef.current
      if (!controls || !camera) return

      const target = controls.target.clone()
      const distance = camera.position.distanceTo(target)
      const iso = distance / Math.sqrt(3)

      switch (preset) {
        case 'front':
          camera.position.set(target.x, target.y, target.z + distance)
          break
        case 'top':
          camera.position.set(target.x, target.y + distance, target.z)
          break
        case 'left':
          camera.position.set(target.x - distance, target.y, target.z)
          break
        default:
          camera.position.set(target.x + iso, target.y + iso * 0.6, target.z + iso)
          break
      }
      camera.lookAt(target)
      controls.update()
    },
    focusOnObject: (uuid: string) => {
      const group = groupRef.current
      const camera = cameraRef.current
      const controls = orbitRef.current
      if (!group || !camera || !controls) return

      const object = group.getObjectByProperty('uuid', uuid) as Object3D | null
      if (!object) return

      const box = new Box3().setFromObject(object)
      if (box.isEmpty()) return

      const sphere = box.getBoundingSphere(new Sphere())
      if (!sphere) return

      const offset = Math.max(sphere.radius * 2.2, 0.8)
      const focusPosition = sphere.center.clone().add(new Vector3(offset, offset * 0.6, offset))

      camera.position.copy(focusPosition)
      controls.target.copy(sphere.center)
      controls.update()
    },
    focusOnModel: (modelId: string) => {
      const group = modelGroupsRef.current.get(modelId)
      const camera = cameraRef.current
      const controls = orbitRef.current
      if (!group || !camera || !controls) return

      const box = new Box3().setFromObject(group)
      if (box.isEmpty()) return
      const sphere = box.getBoundingSphere(new Sphere())
      if (!sphere) return

      const distance = Math.max(sphere.radius * modelTransformOffset, 1.2)
      const focusPosition = sphere.center.clone().add(new Vector3(distance, distance * 0.6, distance))

      camera.position.copy(focusPosition)
      controls.target.copy(sphere.center)
      controls.update()
    },
  }))

  return (
    <Canvas
      key={canvasKey}
      shadows
      camera={{ position: [6, 4, 8], fov: 45 }}
      onCreated={({ gl }) => {
        rendererRef.current = gl
      }}
    >
      <Suspense fallback={<LoaderFallback />}>
        <SceneContent
          models={models}
          groupRef={groupRef}
          orbitRef={orbitRef}
          cameraRef={cameraRef}
          boundingRadiusRef={boundingRadiusRef}
          onModelGroupChange={handleModelGroupChange}
        />
      </Suspense>
    </Canvas>
  )
})

