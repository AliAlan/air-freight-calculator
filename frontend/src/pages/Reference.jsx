import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import { Globe, MapPin, BarChart3, Shield } from 'lucide-react'

function Tab({ active, onClick, icon: Icon, label }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg transition-colors ${
        active ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'
      }`}
    >
      <Icon className="w-4 h-4" />
      {label}
    </button>
  )
}

function Countries({ data }) {
  const [search, setSearch] = useState('')
  const filtered = data.filter(c =>
    !search || c.name.toLowerCase().includes(search.toLowerCase()) || c.code.toLowerCase().includes(search.toLowerCase())
  )
  return (
    <div>
      <input
        type="text"
        placeholder="Search countries…"
        className="input max-w-xs mb-4"
        value={search}
        onChange={e => setSearch(e.target.value)}
      />
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200 text-xs text-gray-500 uppercase tracking-wide">
              <th className="text-left px-6 py-3">Code</th>
              <th className="text-left px-6 py-3">Country</th>
              <th className="text-left px-6 py-3">Zone</th>
              <th className="text-left px-6 py-3">Remote Area</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.map(c => (
              <tr key={c.id} className="hover:bg-gray-50">
                <td className="px-6 py-3 font-mono font-medium text-blue-600">{c.code}</td>
                <td className="px-6 py-3 text-gray-900">{c.name}</td>
                <td className="px-6 py-3">
                  <span className="badge bg-blue-50 text-blue-700">{c.zone?.code} – {c.zone?.name}</span>
                </td>
                <td className="px-6 py-3 text-gray-500">{c.remote ? 'Yes' : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function Zones({ data }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {data.map(z => (
        <div key={z.id} className="card p-5">
          <div className="flex items-center gap-3 mb-3">
            <span className="w-10 h-10 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold text-sm">
              {z.code}
            </span>
            <div>
              <div className="font-medium text-gray-900">{z.name}</div>
              <div className="text-xs text-gray-500">{z._count?.countries ?? z.countries?.length ?? 0} countries</div>
            </div>
          </div>
          {z.countries?.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {z.countries.map(c => (
                <span key={c.code} className="badge bg-gray-100 text-gray-600 font-mono">{c.code}</span>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

function Rates({ data }) {
  const grouped = data.reduce((acc, r) => {
    const k = r.zone?.code ?? r.zoneId
    if (!acc[k]) acc[k] = { zone: r.zone, rates: [] }
    acc[k].rates.push(r)
    return acc
  }, {})

  return (
    <div className="space-y-6">
      {Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b)).map(([code, { zone, rates }]) => (
        <div key={code} className="card overflow-hidden">
          <div className="px-6 py-3 bg-gray-50 border-b border-gray-200 flex items-center gap-2">
            <span className="font-bold text-blue-600">{code}</span>
            <span className="text-gray-600 text-sm">{zone?.name}</span>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-400 uppercase tracking-wide">
                <th className="text-left px-6 py-2">Min Kg</th>
                <th className="text-left px-6 py-2">Max Kg</th>
                <th className="text-right px-6 py-2">Per Kg (SAR)</th>
                <th className="text-right px-6 py-2">Min Charge (SAR)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rates.sort((a, b) => a.minKg - b.minKg).map(r => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-6 py-2 text-gray-700">{r.minKg}</td>
                  <td className="px-6 py-2 text-gray-700">{r.maxKg ?? '∞'}</td>
                  <td className="px-6 py-2 text-right font-mono text-gray-900">{r.perKg?.toFixed(2)}</td>
                  <td className="px-6 py-2 text-right font-mono text-gray-900">{r.minCharge?.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  )
}

function Surcharges({ data }) {
  const typeColor = {
    FLAT: 'bg-blue-50 text-blue-700',
    PER_KG: 'bg-green-50 text-green-700',
    PERCENT: 'bg-purple-50 text-purple-700',
  }
  return (
    <div className="card overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-50 border-b border-gray-200 text-xs text-gray-500 uppercase tracking-wide">
            <th className="text-left px-6 py-3">Code</th>
            <th className="text-left px-6 py-3">Name</th>
            <th className="text-left px-6 py-3">Type</th>
            <th className="text-right px-6 py-3">Value</th>
            <th className="text-left px-6 py-3">Condition</th>
            <th className="text-left px-6 py-3">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {data.map(s => (
            <tr key={s.id} className="hover:bg-gray-50">
              <td className="px-6 py-3 font-mono font-medium text-gray-900">{s.code}</td>
              <td className="px-6 py-3 text-gray-900">{s.name}</td>
              <td className="px-6 py-3">
                <span className={`badge ${typeColor[s.type] ?? 'bg-gray-100 text-gray-600'}`}>{s.type}</span>
              </td>
              <td className="px-6 py-3 text-right font-mono">
                {s.type === 'PERCENT' ? `${s.value}%` : `${s.value} SAR`}
              </td>
              <td className="px-6 py-3 text-gray-500 text-xs">{s.condition}</td>
              <td className="px-6 py-3">
                <span className={`badge ${s.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                  {s.active ? 'Active' : 'Inactive'}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

const TABS = [
  { id: 'countries', label: 'Countries', icon: Globe },
  { id: 'zones', label: 'Zones', icon: MapPin },
  { id: 'rates', label: 'Rate Cards', icon: BarChart3 },
  { id: 'surcharges', label: 'Surcharges', icon: Shield },
]

export default function Reference() {
  const [tab, setTab] = useState('countries')
  const [data, setData] = useState({ countries: [], zones: [], rates: [], surcharges: [] })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      api.getCountries(),
      api.getZones(),
      api.getRates(),
      api.getSurcharges(),
    ]).then(([c, z, r, s]) => {
      setData({
        countries: c.data?.countries ?? c.data ?? [],
        zones: z.data?.zones ?? z.data ?? [],
        rates: r.data?.rates ?? r.data ?? [],
        surcharges: s.data?.surcharges ?? s.data ?? [],
      })
    }).finally(() => setLoading(false))
  }, [])

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Reference Data</h1>
        <p className="text-gray-500 text-sm mt-1">Master data: countries, zones, rates, and surcharges</p>
      </div>

      <div className="flex gap-2 mb-6">
        {TABS.map(t => (
          <Tab key={t.id} active={tab === t.id} onClick={() => setTab(t.id)} icon={t.icon} label={t.label} />
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {tab === 'countries' && <Countries data={data.countries} />}
          {tab === 'zones' && <Zones data={data.zones} />}
          {tab === 'rates' && <Rates data={data.rates} />}
          {tab === 'surcharges' && <Surcharges data={data.surcharges} />}
        </>
      )}
    </div>
  )
}
