import { Suspense, useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { Canvas } from '@react-three/fiber'
import {
  Center,
  ContactShadows,
  Environment,
  Html,
  OrbitControls,
  useGLTF,
  useProgress,
} from '@react-three/drei'
import { motion } from 'framer-motion'
import { Group, Mesh, MeshStandardMaterial, Color, WebGLRenderer } from 'three'
import type { ModelTransform } from '../types'
import { LoadingShimmer } from './LoadingShimmer'

interface ModelViewerProps {
  modelUrl: string | null
  transform: ModelTransform
  isLoading?: boolean
  onScreenshot?: (dataUrl: string) => void
}

const colorHelper = new Color()

const LoaderOverlay = () => {
  const { progress } = useProgress()
  return (
    <Html center>
      <div className="flex flex-col items-center gap-2 rounded-2xl border border-slate-200 bg-white/90 px-6 py-4 text-xs font-medium text-slate-600 shadow-md shadow-slate-900/5 backdrop-blur">
        <span className="inline-flex h-6 w-6 animate-spin rounded-full border-2 border-sky-400 border-t-transparent" />
        <span>Loading model {Math.round(progress)}%</span>
      </div>
    </Html>
  )
}

interface AircraftModelProps {
  url: string
  transform: ModelTransform
  onReady: () => void
}

const AircraftModel = ({ url, transform, onReady }: AircraftModelProps) => {
  const gltf = useGLTF(url, true)
  const groupRef = useRef<Group>(null)

  const scene = useMemo(() => gltf.scene.clone(true), [gltf.scene])

  useEffect(() => {
    onReady()
  }, [onReady])

  useEffect(() => {
    const targetColor = colorHelper.set(transform.baseColor)
    scene.traverse((object) => {
      if (object instanceof Mesh) {
        const material = object.material
        if (Array.isArray(material)) {
          material.forEach((mat) => {
            if (mat instanceof MeshStandardMaterial) {
              mat.color.copy(targetColor)
            }
          })
        } else if (material instanceof MeshStandardMaterial) {
          material.color.copy(targetColor)
        }
      }
    })
  }, [scene, transform.baseColor])

  useEffect(() => {
    if (!groupRef.current) return
    const { x, y, z } = transform.rotation
    groupRef.current.rotation.set((x * Math.PI) / 180, (y * Math.PI) / 180, (z * Math.PI) / 180)
    groupRef.current.scale.set(transform.scale, transform.scale, transform.scale)
  }, [transform])

  useEffect(
    () => () => {
      scene.traverse((object) => {
        if (object instanceof Mesh) {
          object.geometry.dispose()
          const material = object.material
          if (Array.isArray(material)) {
            material.forEach((mat) => mat.dispose())
          } else if (material) {
            material.dispose()
          }
        }
      })
    },
    [scene],
  )

  return (
    <Center>
      <group ref={groupRef}>
        <primitive object={scene} dispose={null} />
      </group>
    </Center>
  )
}

export const ModelViewer = ({
  modelUrl,
  transform,
  isLoading = false,
  onScreenshot,
}: ModelViewerProps) => {
  const [isModelReady, setIsModelReady] = useState(false)
  const [screenshotting, setScreenshotting] = useState(false)
  const rendererRef = useRef<WebGLRenderer | null>(null)

  useEffect(
    () => () => {
      rendererRef.current = null
    },
    [],
  )

  useEffect(() => {
    if (modelUrl) {
      useGLTF.preload(modelUrl)
    }
  }, [modelUrl])

  useEffect(() => {
    setIsModelReady(false)
  }, [modelUrl])

  const handleScreenshot = useCallback(() => {
    if (!rendererRef.current) return
    setScreenshotting(true)
    requestAnimationFrame(() => {
      const dataUrl = rendererRef.current!.domElement.toDataURL('image/png')
      if (onScreenshot) {
        onScreenshot(dataUrl)
      } else {
        const link = document.createElement('a')
        link.href = dataUrl
        link.download = `sketch-to-sky-${Date.now()}.png`
        link.click()
      }
      setScreenshotting(false)
    })
  }, [onScreenshot])

  if (!modelUrl) {
    return (
      <div className="flex h-full min-h-[420px] flex-col justify-between gap-4 rounded-3xl border border-dashed border-slate-200 bg-white/70 p-6 text-sm text-slate-500">
        <div className="flex flex-1 flex-col items-center justify-center text-center">
          <p className="text-base font-semibold text-slate-700">Awaiting model</p>
          <p className="mt-1 max-w-sm">
            Submit a prompt to generate a new aircraft concept. Your model will appear here once ready.
          </p>
        </div>
        <LoadingShimmer className="h-24" label="3D preview placeholder" />
      </div>
    )
  }

  const showOverlay = isLoading || !isModelReady || screenshotting

  return (
    <motion.div
      layout
      className="relative h-full min-h-[420px] overflow-hidden rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 shadow-xl shadow-slate-900/20"
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: 'spring', stiffness: 140, damping: 18 }}
    >
      <Canvas
        camera={{ position: [4, 3, 6], fov: 50 }}
        dpr={[1, 2]}
        gl={{ preserveDrawingBuffer: true, antialias: true }}
        onCreated={({ gl }) => {
          rendererRef.current = gl
        }}
      >
        <ambientLight intensity={0.45} />
        <directionalLight position={[5, 10, 7.5]} intensity={1.6} castShadow />
        <Suspense fallback={<LoaderOverlay />}>
          <AircraftModel
            url={modelUrl}
            transform={transform}
            onReady={() => setIsModelReady(true)}
          />
          <Environment preset="sunset" />
          <ContactShadows
            position={[0, -1.2, 0]}
            opacity={0.5}
            width={12}
            height={12}
            blur={1.3}
            far={6}
          />
        </Suspense>
        <OrbitControls
          enablePan
          enableZoom
          enableDamping
          dampingFactor={0.035}
          minDistance={2}
          maxDistance={12}
        />
      </Canvas>

      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between px-4 py-3">
        <div className="pointer-events-auto inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1 text-xs font-medium text-white backdrop-blur">
          <span className="inline-flex h-2.5 w-2.5 animate-pulse rounded-full bg-emerald-400" />
          <span>Interactive 3D preview</span>
        </div>
        <button
          type="button"
          onClick={handleScreenshot}
          className="pointer-events-auto inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-white/25 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        >
          <svg
            className="h-4 w-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M4 7h4l2-3h4l2 3h4v13H4z" />
            <circle cx="12" cy="13" r="3" />
          </svg>
          Capture
        </button>
      </div>

      {showOverlay && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-900/45 backdrop-blur-sm">
          <div className="flex items-center gap-3 rounded-full bg-white/90 px-4 py-2 text-sm font-medium text-slate-700 shadow-lg shadow-slate-900/20">
            <span className="inline-flex h-4 w-4 animate-spin rounded-full border-2 border-sky-400 border-t-transparent" />
            {screenshotting ? 'Preparing capture...' : isLoading ? 'Generating model...' : 'Loading 3D assets...'}
          </div>
        </div>
      )}
    </motion.div>
  )
}
