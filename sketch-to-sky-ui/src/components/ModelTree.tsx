import { useMemo, useState, useEffect, type MutableRefObject } from 'react'
import {
  ChevronDown,
  ChevronRight,
  ChevronsDown,
  ChevronsUp,
  Eye,
  EyeOff,
  Search,
} from 'lucide-react'
import { Box3, Mesh, Object3D, Vector3 } from 'three'
import { useSceneStore } from '../hooks/useSceneStore'
import type { ThreeCanvasHandle } from './ThreeCanvas'

interface TreeNodeData {
  id: string
  name: string
  type: string
  visible: boolean
  vertexCount: number | null
  dimensions: [number, number, number] | null
  object: Object3D
  children: TreeNodeData[]
}

const formatDimensions = (dims: [number, number, number] | null) => {
  if (!dims) return 'N/A'
  return `${dims[0].toFixed(2)} × ${dims[1].toFixed(2)} × ${dims[2].toFixed(2)} m`
}

const buildTree = (object: Object3D): TreeNodeData => {
  const name =
    object.name ||
    (object.type === 'Mesh'
      ? 'Unnamed Mesh'
      : object.type.replace(/([a-z])([A-Z])/g, '$1 $2'))

  let vertexCount: number | null = null
  let dimensions: [number, number, number] | null = null

  if ((object as Mesh).isMesh) {
    const mesh = object as Mesh
    const geometry = mesh.geometry
    vertexCount = geometry?.attributes?.position?.count ?? null

    const box = new Box3().setFromObject(mesh)
    if (!box.isEmpty()) {
      const size = box.getSize(new Vector3())
      dimensions = [size.x, size.y, size.z]
    }
  }

  const children = object.children.map((child) => buildTree(child))

  return {
    id: object.uuid,
    name,
    type: object.type,
    visible: object.visible,
    vertexCount,
    dimensions,
    object,
    children,
  }
}

const flattenNodes = (nodes: TreeNodeData[]): string[] => {
  const ids: string[] = []
  nodes.forEach((node) => {
    ids.push(node.id)
    if (node.children.length > 0) {
      ids.push(...flattenNodes(node.children))
    }
  })
  return ids
}

const filterTree = (nodes: TreeNodeData[], query: string): TreeNodeData[] => {
  if (!query) return nodes

  return nodes
    .map((node) => {
      const children = filterTree(node.children, query)
      if (node.name.toLowerCase().includes(query) || children.length > 0) {
        return { ...node, children }
      }
      return null
    })
    .filter((node): node is TreeNodeData => node !== null)
}

interface ModelTreeProps {
  canvasRef: MutableRefObject<ThreeCanvasHandle | null>
}

export function ModelTree({ canvasRef }: ModelTreeProps) {
  const sceneRoot = useSceneStore((state) => state.sceneRoot)
  const selectedMeshId = useSceneStore((state) => state.selectedMeshId)
  const selectObjectById = useSceneStore((state) => state.selectObjectById)
  const setMeshVisibility = useSceneStore((state) => state.setMeshVisibility)
  const sceneVersion = useSceneStore((state) => state.sceneVersion)

  const [filter, setFilter] = useState('')
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

  const treeData = useMemo(() => {
    if (!sceneRoot) return []
    const rootNode = buildTree(sceneRoot)
    return [{ ...rootNode, name: sceneRoot.name || 'Scene Root' }]
  }, [sceneRoot, sceneVersion])

  const filteredTree = useMemo(() => {
    const query = filter.trim().toLowerCase()
    return filterTree(treeData, query)
  }, [filter, treeData])

  useEffect(() => {
    if (!sceneRoot) return
    const ids = flattenNodes(treeData)
    const initial: Record<string, boolean> = {}
    ids.forEach((id) => {
      initial[id] = true
    })
    setExpanded(initial)
  }, [sceneRoot, treeData])

  const toggleExpand = (id: string) => {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  const expandAll = () => {
    const ids = flattenNodes(treeData)
    const next: Record<string, boolean> = {}
    ids.forEach((id) => {
      next[id] = true
    })
    setExpanded(next)
  }

  const collapseAll = () => {
    const ids = flattenNodes(treeData)
    const next: Record<string, boolean> = {}
    ids.forEach((id, index) => {
      next[id] = index === 0
    })
    setExpanded(next)
  }

  const handleSelect = (id: string) => {
    selectObjectById(id)
    canvasRef.current?.focusOnObject(id)
  }

  return (
    <div className="flex h-full flex-col gap-3 rounded-3xl border border-slate-700 bg-slate-900/70 p-4 text-xs text-slate-300 shadow-2xl backdrop-blur">
      <div className="flex items-center gap-2">
        <div className="flex flex-1 items-center gap-2 rounded-2xl bg-slate-900/60 px-3 py-2">
          <Search size={14} className="text-slate-500" />
          <input
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            placeholder="Search model tree..."
            className="w-full bg-transparent text-xs text-slate-200 outline-none"
          />
        </div>
        <button
          type="button"
          onClick={expandAll}
          className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-slate-800 text-slate-300 transition hover:bg-slate-700"
          title="Expand all"
        >
          <ChevronsDown size={14} />
        </button>
        <button
          type="button"
          onClick={collapseAll}
          className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-slate-800 text-slate-300 transition hover:bg-slate-700"
          title="Collapse all"
        >
          <ChevronsUp size={14} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto overflow-x-auto pr-1">
        {filteredTree.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-900/60 px-3 py-10 text-center text-slate-500">
            No components found.
          </div>
        ) : (
          <div className="min-w-full space-y-1">
            {filteredTree.map((node) => (
              <TreeNode
                key={node.id}
                node={node}
                depth={0}
                expanded={expanded}
                onToggle={toggleExpand}
                onSelect={handleSelect}
                toggleVisibility={(object) => setMeshVisibility(object.uuid, !object.visible)}
                selectedId={selectedMeshId}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

type TreeNodeProps = {
  node: TreeNodeData
  depth: number
  expanded: Record<string, boolean>
  onToggle: (id: string) => void
  onSelect: (id: string) => void
  toggleVisibility: (object: Object3D) => void
  selectedId: string | null
}

const TreeNode = ({
  node,
  depth,
  expanded,
  onToggle,
  onSelect,
  toggleVisibility,
  selectedId,
}: TreeNodeProps) => {
  const hasChildren = node.children.length > 0
  const isExpanded = expanded[node.id] ?? true
  const isSelected = selectedId === node.id

  const dimensionsText = formatDimensions(node.dimensions)
  const vertexText = node.vertexCount !== null ? `${node.vertexCount} vertices` : 'N/A vertices'

  return (
    <div className="select-none">
      <div
        className={`group rounded-xl px-2 py-1.5 transition ${
          isSelected
            ? 'bg-sky-500/20 text-sky-200 ring-1 ring-sky-500/60'
            : 'hover:bg-slate-800/70'
        }`}
        style={{ paddingLeft: depth * 16 + 6 }}
        title={`${node.name}\nType: ${node.type}\n${vertexText}\nDimensions: ${dimensionsText}`}
      >
        <div className="flex items-center gap-2">
          {hasChildren ? (
            <button
              type="button"
              onClick={() => onToggle(node.id)}
              className="rounded p-1 text-slate-400 hover:text-slate-200"
            >
              {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </button>
          ) : (
            <span className="inline-flex h-6 w-6 items-center justify-center text-slate-700">
              •
            </span>
          )}
          <button
            type="button"
            onClick={() => onSelect(node.id)}
            className="min-w-0 flex-1 text-left text-[11px] font-medium text-slate-200 transition hover:text-sky-300"
          >
            <span className="block truncate">{node.name}</span>
          </button>
        </div>

        <div className="mt-2 flex items-center justify-between rounded-lg bg-slate-900/60 px-2 py-1.5 text-[10px] text-slate-400">
          <span>{node.type}</span>
          <span>{vertexText}</span>
        </div>

        <div className="mt-2 flex items-center justify-between text-[10px] text-slate-400">
          <span>{dimensionsText}</span>
          <button
            type="button"
            onClick={() => toggleVisibility(node.object)}
            className="rounded-full border border-slate-700 bg-slate-900/70 px-2 py-1 text-slate-300 transition hover:text-slate-100"
            title={node.visible ? 'Hide component' : 'Show component'}
          >
            <span className="inline-flex items-center gap-1">
              {node.visible ? <Eye size={12} /> : <EyeOff size={12} />}
              {node.visible ? 'Visible' : 'Hidden'}
            </span>
          </button>
        </div>
      </div>

      {hasChildren && isExpanded && (
        <div className="space-y-1">
          {node.children.map((child) => (
            <TreeNode
              key={child.id}
              node={child}
              depth={depth + 1}
              expanded={expanded}
              onToggle={onToggle}
              onSelect={onSelect}
              toggleVisibility={toggleVisibility}
              selectedId={selectedId}
            />
          ))}
        </div>
      )}
    </div>
  )
}

