import { motion } from 'framer-motion'
import { useMemo, useState } from 'react'
import { Box3, Mesh, MeshStandardMaterial, Object3D, Vector3 } from 'three'
import { ChevronDown, ChevronUp, Eye, EyeOff, Palette, Ruler, Shapes } from 'lucide-react'
import { useSceneStore } from '../hooks/useSceneStore'

const placeholder = (
  <div className="rounded-2xl border border-slate-700 bg-slate-900/60 px-4 py-16 text-center text-xs text-slate-400">
    Select a part in the scene or model tree to inspect its properties.
  </div>
)

const CollapsibleSection = ({
  title,
  children,
  defaultOpen = true,
}: {
  title: string
  children: React.ReactNode
  defaultOpen?: boolean
}) => {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/50">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center justify-between px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400 transition hover:text-slate-200"
      >
        <span>{title}</span>
        {open ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
      </button>
      {open && <div className="space-y-2 border-t border-slate-800 px-3 py-3">{children}</div>}
    </div>
  )
}

const InfoRow = ({
  label,
  value,
}: {
  label: string
  value: React.ReactNode
}) => (
  <div className="flex items-center justify-between text-xs text-slate-300">
    <span className="text-slate-400">{label}</span>
    <span className="ml-3 font-semibold text-slate-100">{value}</span>
  </div>
)

export function PropertiesPanel() {
  const {
    selectedMeshId,
    sceneRoot,
    sceneVersion,
    setMeshVisibility,
    updateMaterialColor,
    updateMaterialOpacity,
    snapObjectToRoot,
  } = useSceneStore((state) => ({
    selectedMeshId: state.selectedMeshId,
    sceneRoot: state.sceneRoot,
    sceneVersion: state.sceneVersion,
    setMeshVisibility: state.setMeshVisibility,
    updateMaterialColor: state.updateMaterialColor,
    updateMaterialOpacity: state.updateMaterialOpacity,
    snapObjectToRoot: state.snapObjectToRoot,
  }))

  const selectedObject = useMemo(() => {
    if (!sceneRoot || !selectedMeshId) return null
    return sceneRoot.getObjectByProperty('uuid', selectedMeshId) as Object3D | null
  }, [sceneRoot, selectedMeshId, sceneVersion])

  const selectedMesh = useMemo(() => {
    if (!selectedObject) return null
    if ((selectedObject as Mesh).isMesh) {
      return selectedObject as Mesh
    }
    return null
  }, [selectedObject])

  const geometryInfo = useMemo(() => {
    if (!selectedObject) return null

    const box = new Box3().setFromObject(selectedObject)
    const size = new Vector3()
    box.getSize(size)

    if (selectedMesh && selectedMesh.geometry?.attributes?.position) {
      const vertices = selectedMesh.geometry.attributes.position.count
      const faces = Math.floor(vertices / 3)
      return {
        dimensions: size,
        vertices,
        faces,
      }
    }

    return {
      dimensions: size,
      vertices: null,
      faces: null,
    }
  }, [selectedObject, selectedMesh])

  const materialInfo = useMemo(() => {
    if (!selectedMesh) return null
    const material = Array.isArray(selectedMesh.material)
      ? selectedMesh.material[0]
      : selectedMesh.material
    if (!material) return null
    const mat = material as MeshStandardMaterial
    return {
      name: mat.name || 'MeshStandardMaterial',
      type: mat.type,
      color: mat.color ? `#${mat.color.getHexString()}` : '#ffffff',
      opacity: typeof mat.opacity === 'number' ? mat.opacity : 1,
      transparent: mat.transparent,
    }
  }, [selectedMesh, sceneVersion])

  const toggleVisibility = () => {
    if (!selectedObject) return
    setMeshVisibility(selectedObject.uuid, !selectedObject.visible)
  }

  const handleSnap = () => {
    if (!selectedObject) return
    snapObjectToRoot(selectedObject.uuid)
  }

  if (!selectedObject) {
    return placeholder
  }

  return (
    <motion.div
      key={selectedObject.uuid}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="space-y-3 rounded-3xl border border-slate-700 bg-slate-900/70 p-4 shadow-2xl"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-sky-300">{selectedObject.name || 'Unnamed node'}</h2>
          <p className="mt-0.5 max-w-[180px] break-words text-[10px] text-slate-500">
            UUID: {selectedObject.uuid}
          </p>
        </div>
        <button
          type="button"
          onClick={toggleVisibility}
          className="rounded-full border border-slate-700 bg-slate-900/70 p-2 text-slate-300 transition hover:text-sky-300"
          title={selectedObject.visible ? 'Hide node' : 'Show node'}
        >
          {selectedObject.visible ? <Eye size={14} /> : <EyeOff size={14} />}
        </button>
      </div>
      <button
        type="button"
        onClick={handleSnap}
        title="Snap selection to assembly center"
        className="w-full rounded-full border border-sky-500/40 bg-slate-900/70 px-3 py-2 text-[11px] font-semibold text-sky-300 transition hover:bg-slate-800"
      >
        Snap to Assembly
      </button>

      <div className="grid gap-2 text-[11px] text-slate-400">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-sky-500/20 text-sky-300">
            <Shapes size={12} />
          </span>
          <span>{selectedObject.type}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-sky-500/20 text-sky-300">
            <Ruler size={12} />
          </span>
          <span>
            Bounding box: {geometryInfo
              ? `${geometryInfo.dimensions.x.toFixed(2)} × ${geometryInfo.dimensions.y.toFixed(
                  2,
                )} × ${geometryInfo.dimensions.z.toFixed(2)}`
              : 'N/A'}{' '}
            m
          </span>
        </div>
      </div>

      {geometryInfo && (
        <CollapsibleSection title="Geometry">
          <InfoRow
            label="Vertices"
            value={geometryInfo.vertices !== null ? geometryInfo.vertices : 'N/A'}
          />
          <InfoRow
            label="Faces"
            value={geometryInfo.faces !== null ? geometryInfo.faces : 'N/A'}
          />
          <InfoRow
            label="Dimensions"
            value={`${geometryInfo.dimensions.x.toFixed(2)} × ${geometryInfo.dimensions.y.toFixed(
              2,
            )} × ${geometryInfo.dimensions.z.toFixed(2)} m`}
          />
        </CollapsibleSection>
      )}

      {selectedMesh && materialInfo && (
        <CollapsibleSection title="Material">
          <div className="flex items-center justify-between text-xs text-slate-200">
            <span>{materialInfo.name}</span>
            <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] uppercase text-slate-400">
              {materialInfo.type}
            </span>
          </div>
          <div className="mt-2 flex items-center justify-between">
            <span className="text-xs text-slate-400">Base color</span>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={materialInfo.color}
                onChange={(event) => updateMaterialColor(selectedMesh.uuid, event.target.value)}
                className="h-7 w-12 cursor-pointer rounded border border-slate-700 bg-slate-900"
              />
              <Palette size={14} className="text-slate-500" />
            </div>
          </div>
          <div className="mt-2">
            <label className="flex items-center justify-between text-xs text-slate-400">
              Opacity
              <span className="text-slate-200">{materialInfo.opacity.toFixed(2)}</span>
            </label>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              defaultValue={materialInfo.opacity}
              onChange={(event) => updateMaterialOpacity(selectedMesh.uuid, Number(event.target.value))}
              className="mt-1 w-full accent-sky-500"
            />
          </div>
        </CollapsibleSection>
      )}
    </motion.div>
  )
}

