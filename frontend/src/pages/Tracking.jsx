import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import { Truck, Search, Package, CheckCircle, Plane, Clock } from 'lucide-react'

const STATUS_STYLE = {
  'Delivered': 'bg-green-100 text-green-700',
  'On Transit': 'bg-blue-100 text-blue-700',
  'Partially Delivered': 'bg-amber-100 text-amber-700',
  'Pending': 'bg-gray-100 text-gray-600',
}
function StatusPill({ status }) {
  const cls = STATUS_STYLE[status] || 'bg-gray-100 text-gray-600'
  return <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${cls}`}>{status || '—'}</span>
}

const STATUSES = ['', 'Delivered', 'On Transit', 'Partially Delivered', 'Pending']

function Kpi({ icon: Icon, label, value, color }) {
  return (
    <div className="card p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-gray-500">{label}</p>
          <p className="text-2xl font-bold text-gray-900 mt-0.5">{value}</p>
        </div>
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${color}`}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
    </div>
  )
}

const COLS = [
  ['sn', 'SN'], ['awb', 'AWB'], ['supplier', 'Supplier'], ['serviceType', 'Service'],
  ['origin', 'Origin'], ['destination', 'Destination'], ['wh', 'WH'],
  ['cases', 'Cases'], ['chargeableWeight', 'Chg Wt'],
  ['pickupDate', 'Pickup'], ['eta', 'ETA'], ['ata', 'ATA'], ['clearedDate', 'Cleared'],
  ['leadTime', 'L/T'], ['receivedBy', 'Received By'], ['remarks', 'Remarks'],
]

export default function Tracking() {
  const [rows, setRows] = useState([])
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState('')
  const [search, setSearch] = useState('')

  useEffect(() => {
    setLoading(true)
    Promise.all([
      api.getTracking(status ? { status } : {}),
      summary ? Promise.resolve({ data: summary }) : api.getTrackingSummary(),
    ])
      .then(([list, sum]) => {
        setRows(list.data ?? [])
        if (!summary) setSummary(sum.data)
      })
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status])

  const filtered = rows.filter((r) => {
    if (!search) return true
    const q = search.toLowerCase()
    return [r.supplier, r.awb, r.origin, r.destination, r.serviceType, r.invoiceNo, r.receivedBy]
      .some((v) => String(v || '').toLowerCase().includes(q))
  })

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Truck className="w-6 h-6 text-blue-600" /> Shipment Tracking
        </h1>
        <p className="text-gray-500 text-sm mt-1">Operational milestone tracking — pickup, departure, arrival, clearance</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Kpi icon={Package} label="Total Shipments" value={summary?.total ?? '—'} color="bg-blue-50 text-blue-600" />
        <Kpi icon={CheckCircle} label="Delivered" value={summary?.delivered ?? '—'} color="bg-green-50 text-green-600" />
        <Kpi icon={Plane} label="On Transit" value={summary?.inTransit ?? '—'} color="bg-indigo-50 text-indigo-600" />
        <Kpi icon={Clock} label="Pending" value={summary?.pending ?? '—'} color="bg-gray-100 text-gray-600" />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search AWB, supplier, origin…"
            className="input pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-1 flex-wrap">
          {STATUSES.map((s) => (
            <button
              key={s || 'all'}
              onClick={() => setStatus(s)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                status === s ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
              }`}
            >
              {s || 'All'}
            </button>
          ))}
        </div>
        <span className="text-sm text-gray-400 ml-auto">{filtered.length} rows</span>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-gray-500">
            <Truck className="w-10 h-10 mx-auto mb-3 text-gray-300" />
            <p>No tracking records found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm whitespace-nowrap">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-xs text-gray-500 uppercase tracking-wide">
                  {COLS.map(([, label]) => (
                    <th key={label} className="text-left px-4 py-3 font-medium">{label}</th>
                  ))}
                  <th className="text-left px-4 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50">
                    {COLS.map(([key]) => (
                      <td key={key} className={`px-4 py-2.5 ${key === 'awb' ? 'font-mono text-blue-600' : 'text-gray-700'}`}>
                        {key === 'origin'
                          ? `${r.origin || '—'}`
                          : (r[key] === '' || r[key] == null ? '—' : r[key])}
                      </td>
                    ))}
                    <td className="px-4 py-2.5"><StatusPill status={r.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
