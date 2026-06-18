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

  // Body may not be JSON (e.g. a gateway 502/HTML while the backend wakes up).
  let data = {}
  try { data = await res.json() } catch { /* non-JSON response */ }

  if (!res.ok) {
    // Expired/invalid token on an authenticated call → drop the session so the
    // app routes to a clean login instead of rendering a broken page.
    if (res.status === 401 && token) {
      window.dispatchEvent(new Event('afcc:unauthorized'))
    }
    throw new Error(data.message || data.error || `Request failed (${res.status})`)
  }
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

  // Tracking
  getTracking: (params = {}) => {
    const qs = new URLSearchParams(params).toString()
    return request('GET', `/tracking${qs ? '?' + qs : ''}`)
  },
  getTrackingSummary: () => request('GET', '/tracking/summary'),

  // Reference
  getCountries: () => request('GET', '/reference/countries'),
  getZones: () => request('GET', '/reference/zones'),
  getRates: () => request('GET', '/reference/rates'),
  getSurcharges: () => request('GET', '/reference/surcharges'),
}
