// In production, set VITE_API_URL to your Render backend URL (e.g. https://afcc-backend.onrender.com)
// In development, Vite proxies /api → localhost:4000
const BASE = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/api`
  : '/api'

function getToken() {
  return localStorage.getItem('afcc_token')
}

async function request(method, path, body) {
  const headers = { 'Content-Type': 'application/json' }
  const token = getToken()
  if (token) headers['Authorization'] = `Bearer ${token}`

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })

  const data = await res.json()
  if (!res.ok) throw new Error(data.message || data.error || 'Request failed')
  return data
}

export const api = {
  // Health — used to pre-warm a cold backend (Render free tier spins down).
  health: () => request('GET', '/health'),

  // Auth
  login: (email, password) => request('POST', '/auth/login', { email, password }),

  // Shipments
  listShipments: (params = {}) => {
    const qs = new URLSearchParams(params).toString()
    return request('GET', `/shipments${qs ? '?' + qs : ''}`)
  },
  getShipment: (id) => request('GET', `/shipments/${id}`),
  createShipment: (body) => request('POST', '/shipments', body),
  deleteShipment: (id) => request('DELETE', `/shipments/${id}`),
  previewShipment: (body) => request('POST', '/shipments/preview', body),
  decideShipment: (id, decision, reason) =>
    request('POST', `/shipments/${id}/decision`, { decision, reason }),
  getDashboard: () => request('GET', '/shipments/dashboard'),

  // Reference
  getCountries: () => request('GET', '/reference/countries'),
  getZones: () => request('GET', '/reference/zones'),
  getRates: () => request('GET', '/reference/rates'),
  getSurcharges: () => request('GET', '/reference/surcharges'),
}
