import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api } from '../lib/api'
import StatusBadge from '../components/StatusBadge'
import { Package, Search, Filter, PlusCircle, ArrowRight, ChevronDown } from 'lucide-react'

const STATUSES = ['', 'DRAFT', 'PENDING', 'APPROVED', 'REJECTED']

function fmt(n) {
  if (n == null) return '—'
  return new Intl.NumberFormat('en-SA', { style: 'currency', currency: 'SAR', maximumFractionDigits: 0 }).format(n)
}

export default function Shipments() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [shipments, setShipments] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  const status = searchParams.get('status') || ''

  useEffect(() => {
    setLoading(true)
    const params = {}
    if (status) params.status = status
    api.listShipments(params)
      .then(res => {
        const list = res.data?.shipments ?? res.data ?? []
        setShipments(Array.isArray(list) ? list : [])
      })
      .finally(() => setLoading(false))
  }, [status])

  const filtered = shipments.filter(s => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      s.ref?.toLowerCase().includes(q) ||
      s.originCountry?.code?.toLowerCase().includes(q) ||
      s.destinationCountry?.code?.toLowerCase().includes(q) ||
      s.mode?.toLowerCase().includes(q)
    )
  })

  function setStatus(v) {
    if (v) setSearchParams({ status: v })
    else setSearchParams({})
  }

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Shipments</h1>
          <p className="text-gray-500 text-sm mt-1">{shipments.length} total records</p>
        </div>
        <Link to="/shipments/new" className="btn-primary">
          <PlusCircle className="w-4 h-4" />
          New Shipment
        </Link>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-6">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search ref, country, mode…"
            className="input pl-9"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-1">
          {STATUSES.map(s => (
            <button
              key={s || 'all'}
              onClick={() => setStatus(s)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border ${
                status === s
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
              }`}
            >
              {s || 'All'}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-gray-500">
            <Package className="w-10 h-10 mx-auto mb-3 text-gray-300" />
            <p className="font-medium">No shipments found</p>
            <p className="text-sm mt-1">Try adjusting filters or create a new one</p>
            <Link to="/shipments/new" className="btn-primary mt-4 inline-flex">
              <PlusCircle className="w-4 h-4" /> New Shipment
            </Link>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-xs text-gray-500 uppercase tracking-wide">
                <th className="text-left px-6 py-3 font-medium">Reference</th>
                <th className="text-left px-6 py-3 font-medium">Route</th>
                <th className="text-left px-6 py-3 font-medium">Mode</th>
                <th className="text-right px-6 py-3 font-medium">Chargeable</th>
                <th className="text-right px-6 py-3 font-medium">Freight (SAR)</th>
                <th className="text-left px-6 py-3 font-medium">Status</th>
                <th className="text-left px-6 py-3 font-medium">Created</th>
                <th className="px-6 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map(s => {
                const result = s.resultJson ? (typeof s.resultJson === 'string' ? JSON.parse(s.resultJson) : s.resultJson) : null
                return (
                  <tr key={s.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <span className="font-mono text-sm font-medium text-blue-600">{s.ref}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-gray-900">
                        {s.originCountry?.code ?? '—'} → {s.destinationCountry?.code ?? '—'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-gray-600">{s.mode}</span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className="text-sm text-gray-700">
                        {result?.weights?.chargeableWeight != null
                          ? `${result.weights.chargeableWeight} kg`
                          : '—'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className="text-sm font-semibold text-gray-900">{fmt(s.totalFreight)}</span>
                    </td>
                    <td className="px-6 py-4">
                      <StatusBadge status={s.status} />
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-xs text-gray-400">
                        {new Date(s.createdAt).toLocaleDateString()}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <Link to={`/shipments/${s.id}`} className="text-gray-400 hover:text-blue-600 transition-colors">
                        <ArrowRight className="w-4 h-4" />
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
