import { createContext, useContext, useState, useEffect } from 'react'
import { api } from '../lib/api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const stored = localStorage.getItem('afcc_user')
    if (stored) {
      try { setUser(JSON.parse(stored)) } catch {}
    }
    setLoading(false)
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
