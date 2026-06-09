const BASE = '/api'

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
  // Auth
  login: (email, password) => request('POST', '/auth/login', { email, password }),

  // Shipments
  listShipments: (params = {}) => {
    const qs = new URLSearchParams(params).toString()
    return request('GET', `/shipments${qs ? '?' + qs : ''}`)
  },
  getShipment: (id) => request('GET', `/shipments/${id}`),
  createShipment: (body) => request('POST', '/shipments', body),
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
