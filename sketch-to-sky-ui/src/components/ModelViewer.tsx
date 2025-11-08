import { Canvas } from '@react-three/fiber'
import { OrbitControls, Environment, useGLTF } from '@react-three/drei'

interface Props {
  modelUrl: string
}

function Model({ modelUrl }: Props) {
  const { scene } = useGLTF(modelUrl)
  return <primitive object={scene} />
}

export default function ModelViewer({ modelUrl }: Props) {
  return (
    <Canvas camera={{ position: [0, 2, 5], fov: 45 }}>
      <ambientLight intensity={0.8} />
      <Environment preset="studio" />
      <Model modelUrl={modelUrl} />
      <OrbitControls />
    </Canvas>
  )
}
