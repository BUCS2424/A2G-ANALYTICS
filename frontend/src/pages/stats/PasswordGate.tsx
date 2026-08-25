import { useState, type FormEvent } from 'react'

export default function PasswordGate({ onUnlock }: { onUnlock: (password: string) => Promise<void> }) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    try {
      await onUnlock(password)
    } catch {
      setError('Incorrect password')
    }
  }

  return (
    <div className="auth-page">
      <form className="auth-card" onSubmit={handleSubmit}>
        <h1>Password required</h1>
        <p>This website's stats are password-protected.</p>
        {error && <p className="error">{error}</p>}
        <label>
          Password
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </label>
        <button type="submit">Unlock</button>
      </form>
    </div>
  )
}
