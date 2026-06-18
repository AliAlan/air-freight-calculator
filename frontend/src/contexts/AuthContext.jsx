import { createContext, useContext, useState, useEffect } from 'react'
import { api } from '../lib/api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('afcc_token')
    const stored = localStorage.getItem('afcc_user')
    // Only restore a session when BOTH the token and a parseable user exist.
    // A user without a token (or corrupted JSON) is a stale/zombie state that
    // would render protected pages whose every API call then 401s — clear it.
    if (token && stored) {
      try {
        setUser(JSON.parse(stored))
      } catch {
        localStorage.removeItem('afcc_token')
        localStorage.removeItem('afcc_user')
      }
    } else if (stored || token) {
      localStorage.removeItem('afcc_token')
      localStorage.removeItem('afcc_user')
    }
    setLoading(false)

    // If any API call hits 401 (expired/invalid token), the api layer fires
    // this event → drop the session so the user is routed to a clean login.
    function onUnauthorized() {
      localStorage.removeItem('afcc_token')
      localStorage.removeItem('afcc_user')
      setUser(null)
    }
    window.addEventListener('afcc:unauthorized', onUnauthorized)
    return () => window.removeEventListener('afcc:unauthorized', onUnauthorized)
  }, [])

  async function login(email, password) {
    const res = await api.login(email, password)
    const { token, user: u } = res.data
    localStorage.setItem('afcc_token', token)
    localStorage.setItem('afcc_user', JSON.stringify(u))
    setUser(u)
    return u
  }

  function logout() {
    localStorage.removeItem('afcc_token')
    localStorage.removeItem('afcc_user')
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
