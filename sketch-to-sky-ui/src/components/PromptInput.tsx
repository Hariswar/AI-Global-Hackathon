import { useState } from 'react'
import axios from 'axios'

interface Props {
  onResult: (url: string) => void
}

export default function PromptInput({ onResult }: Props) {
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async () => {
    if (!text.trim()) return
    setLoading(true)
    try {
      const res = await axios.post(`${import.meta.env.VITE_API_URL}/generate`, { text })
      onResult(res.data.url)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ textAlign: 'center', marginTop: '1rem' }}>
      <textarea
        style={{ width: '60%', height: '100px' }}
        placeholder="Describe aircraft part or component..."
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <br />
      <button onClick={handleSubmit} disabled={loading}>
        {loading ? 'Generating...' : 'Generate 3D Part'}
      </button>
    </div>
  )
}
