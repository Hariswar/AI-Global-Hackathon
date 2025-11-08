import { useState } from 'react'
import PromptInput from './components/PromptInput'
import ModelViewer from './components/ModelViewer'

export default function App() {
  const [modelUrl, setModelUrl] = useState<string | null>(null)

  return (
    <div style={{ textAlign: 'center' }}>
      <h1>✈️ AI Aircraft Assistant</h1>
      <PromptInput onResult={setModelUrl} />
      {modelUrl && (
        <div style={{ width: '100%', height: '500px', marginTop: '2rem' }}>
          <ModelViewer modelUrl={modelUrl} />
        </div>
      )}
    </div>
  )
}
