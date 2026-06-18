import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../lib/api'
import StatusBadge from '../components/StatusBadge'
import {
  Package, Clock, CheckCircle, DollarSign, TrendingUp, ArrowRight,
  PlusCircle, Route, Trophy, BarChart3, Truck, Plane,
} from 'lucide-react'

const TRACK_STATUS_STYLE = {
  'Delivered': 'bg-green-100 text-green-700',
  'On Transit': 'bg-blue-100 text-blue-700',
  'Partially Delivered': 'bg-amber-100 text-amber-700',
  'Pending': 'bg-gray-100 text-gray-600',
}
import {
  ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend,
  LineChart, Line, XAxis, YAxis, CartesianGrid, BarChart, Bar,
} from 'recharts'

function fmt(n) {
  if (n == null) return '—'
  return new Intl.NumberFormat('en-SA', { style: 'currency', currency: 'SAR', maximumFractionDigits: 0 }).format(n)
}

const STATUS_COLORS = {
  DRAFT: '#9ca3af',     // gray
  PENDING: '#f59e0b',   // amber
  APPROVED: '#10b981',  // green
  REJECTED: '#ef4444',  // red
}
const MODE_COLORS = ['#3b82f6', '#10b981', '#f97316', '#8b5cf6', '#ec4899']

function StatCard({ icon: Icon, label, value, sub, color }) {
  return (
    <div className="card p-5">
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <p className="text-sm text-gray-500">{label}</p>
          <p className="text-2xl font-bold text-gray-900 mt-1 truncate">{value}</p>
          {sub && <p className="text-xs text-gray-400 mt-0.5 truncate">{sub}</p>}
        </div>
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${color}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </div>
  )
}

function ChartCard({ title, icon: Icon, children, empty }) {
  return (
    <div className="card p-6">
      <div className="flex items-center gap-2 mb-4">
        {Icon && <Icon className="w-4 h-4 text-gray-400" />}
        <h2 className="font-semibold text-gray-900 text-sm">{title}</h2>
      </div>
      {empty ? (
        <div className="h-64 flex items-center justify-center text-sm text-gray-400">
          No data yet
        </div>
      ) : (
        <div className="h-64">{children}</div>
      )}
    </div>
  )
}

export default function Dashboard() {
  const [stats, setStats] = useState(null)
  const [recent, setRecent] = useState([])
  const [tracking, setTracking] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      api.getDashboard(),
      api.listShipments({ limit: 5 }),
      api.getTrackingSummary().catch(() => ({ data: null })),
    ])
      .then(([d, s, t]) => {
        setStats(d.data)
        const list = s.data?.shipments ?? s.data ?? []
        setRecent(list.slice(0, 5))
        setTracking(t.data)
      })
      .finally(() => setLoading(false))
  }, [])

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  const statusData = (stats?.statusCounts ?? []).filter(d => d.count > 0)
  const modeData = stats?.freightByMode ?? []
  const trendData = stats?.freightTrend ?? []
  const routeData = stats?.topRoutes ?? []
  const hasAny = (stats?.shipmentCount ?? 0) > 0

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

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
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
          icon={DollarSign}
          label="Total Freight"
          value={fmt(stats?.totalFreight)}
          sub={`Avg ${fmt(stats?.avgFreight)} / shipment`}
          color="bg-purple-50 text-purple-600"
        />
        <StatCard
          icon={CheckCircle}
          label="Approved"
          value={stats?.approved ?? '—'}
          sub={`${stats?.rejected ?? 0} rejected`}
          color="bg-green-50 text-green-600"
        />
      </div>

      {/* Highlight KPI cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        <StatCard
          icon={Route}
          label="Most Used Route"
          value={stats?.mostUsedRoute?.route ?? '—'}
          sub={stats?.mostUsedRoute ? `${stats.mostUsedRoute.count} shipments · ${fmt(stats.mostUsedRoute.freight)}` : ''}
          color="bg-indigo-50 text-indigo-600"
        />
        <StatCard
          icon={Trophy}
          label="Most Expensive Shipment"
          value={stats?.mostExpensive?.ref ?? '—'}
          sub={stats?.mostExpensive ? `${fmt(stats.mostExpensive.totalFreight)} · ${stats.mostExpensive.route} · ${stats.mostExpensive.mode}` : ''}
          color="bg-rose-50 text-rose-600"
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Status pie */}
        <ChartCard title="Shipments by Status" icon={Package} empty={!hasAny}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={statusData}
                dataKey="count"
                nameKey="status"
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={85}
                paddingAngle={2}
                label={({ status, count }) => `${status}: ${count}`}
                labelLine={false}
              >
                {statusData.map((d) => (
                  <Cell key={d.status} fill={STATUS_COLORS[d.status] || '#9ca3af'} />
                ))}
              </Pie>
              <Tooltip formatter={(v) => [`${v} shipments`, '']} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Freight by mode pie */}
        <ChartCard title="Freight Cost by Service Mode" icon={DollarSign} empty={!hasAny}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={modeData}
                dataKey="value"
                nameKey="mode"
                cx="50%"
                cy="50%"
                outerRadius={85}
                paddingAngle={2}
                label={({ mode }) => mode}
                labelLine={false}
              >
                {modeData.map((d, i) => (
                  <Cell key={d.mode} fill={MODE_COLORS[i % MODE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(v) => [fmt(v), 'Freight']} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Freight trend line */}
        <ChartCard title="Freight Cost Over Time" icon={TrendingUp} empty={!hasAny}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={trendData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(d) => d.slice(5)} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${v / 1000}k`} />
              <Tooltip formatter={(v) => [fmt(v), 'Freight']} labelFormatter={(l) => `Date: ${l}`} />
              <Line type="monotone" dataKey="freight" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Top routes bar */}
        <ChartCard title="Top Routes by Volume" icon={BarChart3} empty={!hasAny}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={routeData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="route" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v, n) => [n === 'count' ? `${v} shipments` : fmt(v), n === 'count' ? 'Shipments' : 'Freight']} />
              <Bar dataKey="count" fill="#6366f1" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Shipment tracking */}
      {tracking && (
        <div className="card mb-8">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
            <h2 className="font-semibold text-gray-900 flex items-center gap-2">
              <Truck className="w-4 h-4 text-blue-600" /> Shipment Tracking
            </h2>
            <Link to="/tracking" className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1">
              View all <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          {/* mini stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-gray-100 border-b border-gray-100">
            {[
              ['Total', tracking.total, Package, 'text-blue-600'],
              ['Delivered', tracking.delivered, CheckCircle, 'text-green-600'],
              ['On Transit', tracking.inTransit, Plane, 'text-indigo-600'],
              ['Pending', tracking.pending, Clock, 'text-gray-500'],
            ].map(([label, value, Icon, color]) => (
              <div key={label} className="px-6 py-3 flex items-center gap-3">
                <Icon className={`w-4 h-4 ${color}`} />
                <div>
                  <div className="text-lg font-bold text-gray-900 leading-none">{value}</div>
                  <div className="text-xs text-gray-400 mt-0.5">{label}</div>
                </div>
              </div>
            ))}
          </div>

          {/* recent tracked shipments */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm whitespace-nowrap">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-xs text-gray-500 uppercase tracking-wide">
                  <th className="text-left px-6 py-2.5 font-medium">AWB</th>
                  <th className="text-left px-6 py-2.5 font-medium">Supplier</th>
                  <th className="text-left px-6 py-2.5 font-medium">Route</th>
                  <th className="text-left px-6 py-2.5 font-medium">Service</th>
                  <th className="text-right px-6 py-2.5 font-medium">Cases</th>
                  <th className="text-left px-6 py-2.5 font-medium">ETA</th>
                  <th className="text-left px-6 py-2.5 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {(tracking.recent ?? []).map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="px-6 py-2.5 font-mono text-blue-600">{r.awb || '—'}</td>
                    <td className="px-6 py-2.5 text-gray-700">{r.supplier || '—'}</td>
                    <td className="px-6 py-2.5 text-gray-700">{(r.origin || '—')} → {(r.destination || '—')}</td>
                    <td className="px-6 py-2.5 text-gray-600">{r.serviceType || '—'}</td>
                    <td className="px-6 py-2.5 text-right text-gray-700">{r.cases}</td>
                    <td className="px-6 py-2.5 text-gray-500">{r.eta || '—'}</td>
                    <td className="px-6 py-2.5">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${TRACK_STATUS_STYLE[r.status] || 'bg-gray-100 text-gray-600'}`}>
                        {r.status || '—'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

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
    </div>
  )
}
