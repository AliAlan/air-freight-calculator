import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { Plane, AlertCircle } from 'lucide-react'

const QUICK_LOGINS = [
  { email: 'admin@afcc.demo',    role: 'Admin',    color: 'bg-purple-50 border-purple-200 hover:bg-purple-100' },
  { email: 'operator@afcc.demo', role: 'Operator', color: 'bg-green-50 border-green-200 hover:bg-green-100' },
  { email: 'approver@afcc.demo', role: 'Approver', color: 'bg-blue-50 border-blue-200 hover:bg-blue-100' },
]

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('admin@afcc.demo')
  const [password, setPassword] = useState('demo1234')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(email, password)
      navigate('/dashboard')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function quickLogin(e) {
    setEmail(e.email)
    setError('')
    setLoading(true)
    try {
      await login(e.email, 'demo1234')
      navigate('/dashboard')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-blue-800 to-blue-700 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-white/10 rounded-2xl backdrop-blur mb-4">
            <Plane className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white">AFCC</h1>
          <p className="text-blue-200 mt-1">Air Freight Cost Calculator</p>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">Sign in to your account</h2>

          {error && (
            <div className="flex items-center gap-2 text-red-700 bg-red-50 border border-red-200 rounded-lg px-4 py-3 mb-4 text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">Email</label>
              <input
                type="email"
                className="input"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>
            <div>
              <label className="label">Password</label>
              <input
                type="password"
                className="input"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </div>
            <button type="submit" className="btn-primary w-full justify-center py-2.5 mt-2" disabled={loading}>
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          {/* Quick logins */}
          <div className="mt-6 pt-6 border-t border-gray-200">
            <p className="text-xs text-gray-500 text-center mb-3">Quick login (password: demo1234)</p>
            <div className="grid grid-cols-3 gap-2">
              {QUICK_LOGINS.map(q => (
                <button
                  key={q.email}
                  onClick={() => quickLogin(q)}
                  disabled={loading}
                  className={`text-xs py-2 px-3 rounded-lg border font-medium transition-colors disabled:opacity-50 ${q.color}`}
                >
                  {q.role}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
