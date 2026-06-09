import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../lib/api'
import StatusBadge from '../components/StatusBadge'
import { Package, Clock, CheckCircle, XCircle, DollarSign, TrendingUp, ArrowRight, PlusCircle } from 'lucide-react'

function StatCard({ icon: Icon, label, value, sub, color }) {
  return (
    <div className="card p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-500">{label}</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
          {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
        </div>
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${color}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </div>
  )
}

function fmt(n) {
  if (n == null) return '—'
  return new Intl.NumberFormat('en-SA', { style: 'currency', currency: 'SAR', maximumFractionDigits: 0 }).format(n)
}

export default function Dashboard() {
  const [stats, setStats] = useState(null)
  const [recent, setRecent] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([api.getDashboard(), api.listShipments({ limit: 5 })])
      .then(([d, s]) => {
        setStats(d.data)
        const list = s.data?.shipments ?? s.data ?? []
        setRecent(list.slice(0, 5))
      })
      .finally(() => setLoading(false))
  }, [])

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500 text-sm mt-1">Air freight cost overview</p>
        </div>
        <Link to="/shipments/new" className="btn-primary">
          <PlusCircle className="w-4 h-4" />
          New Shipment
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          icon={Package}
          label="Total Shipments"
          value={stats?.shipmentCount ?? '—'}
          color="bg-blue-50 text-blue-600"
        />
        <StatCard
          icon={Clock}
          label="Pending Approval"
          value={stats?.pendingApprovals ?? '—'}
          sub="Requires action"
          color="bg-yellow-50 text-yellow-600"
        />
        <StatCard
          icon={CheckCircle}
          label="Approved"
          value={stats?.approved ?? '—'}
          color="bg-green-50 text-green-600"
        />
        <StatCard
          icon={DollarSign}
          label="Total Freight"
          value={fmt(stats?.totalFreight)}
          sub="SAR, all shipments"
          color="bg-purple-50 text-purple-600"
        />
      </div>

      {/* Recent shipments */}
      <div className="card">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="font-semibold text-gray-900">Recent Shipments</h2>
          <Link to="/shipments" className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1">
            View all <ArrowRight className="w-3 h-3" />
          </Link>
        </div>

        {recent.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <Package className="w-10 h-10 mx-auto mb-3 text-gray-300" />
            <p>No shipments yet</p>
            <Link to="/shipments/new" className="btn-primary mt-4 inline-flex">
              <PlusCircle className="w-4 h-4" /> Create first shipment
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {recent.map(s => (
              <Link
                key={s.id}
                to={`/shipments/${s.id}`}
                className="flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="w-9 h-9 bg-blue-50 rounded-lg flex items-center justify-center">
                    <Package className="w-4 h-4 text-blue-600" />
                  </div>
                  <div>
                    <div className="font-medium text-gray-900 text-sm">{s.ref}</div>
                    <div className="text-xs text-gray-500">
                      {s.originCountry?.code ?? s.originCountryId} → {s.destinationCountry?.code ?? s.destinationCountryId} · {s.mode}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <div className="text-sm font-semibold text-gray-900">{fmt(s.totalFreight)}</div>
                    <div className="text-xs text-gray-400">{new Date(s.createdAt).toLocaleDateString()}</div>
                  </div>
                  <StatusBadge status={s.status} />
                  <ArrowRight className="w-4 h-4 text-gray-300" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
        <Link to="/shipments/new" className="card p-5 hover:shadow-md transition-shadow group">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center group-hover:bg-blue-100 transition-colors">
              <PlusCircle className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <div className="font-medium text-gray-900 text-sm">Calculate Freight</div>
              <div className="text-xs text-gray-500">Create a new shipment quote</div>
            </div>
          </div>
        </Link>
        <Link to="/shipments?status=PENDING" className="card p-5 hover:shadow-md transition-shadow group">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-yellow-50 rounded-lg flex items-center justify-center group-hover:bg-yellow-100 transition-colors">
              <Clock className="w-5 h-5 text-yellow-600" />
            </div>
            <div>
              <div className="font-medium text-gray-900 text-sm">Review Pending</div>
              <div className="text-xs text-gray-500">Approve or reject shipments</div>
            </div>
          </div>
        </Link>
        <Link to="/reference" className="card p-5 hover:shadow-md transition-shadow group">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-50 rounded-lg flex items-center justify-center group-hover:bg-green-100 transition-colors">
              <TrendingUp className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <div className="font-medium text-gray-900 text-sm">Reference Data</div>
              <div className="text-xs text-gray-500">Zones, countries, rates</div>
            </div>
          </div>
        </Link>
      </div>
    </div>
  )
}
