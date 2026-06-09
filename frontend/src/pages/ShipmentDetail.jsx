import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { api } from '../lib/api'
import StatusBadge from '../components/StatusBadge'
import {
  ArrowLeft, Package, CheckCircle, XCircle, AlertCircle,
  Info, Weight, MapPin, Layers, DollarSign
} from 'lucide-react'

function fmt(n) {
  if (n == null) return '—'
  return new Intl.NumberFormat('en-SA', { style: 'currency', currency: 'SAR', minimumFractionDigits: 2 }).format(n)
}

function Section({ title, children }) {
  return (
    <div className="card p-6">
      <h3 className="font-semibold text-gray-800 text-sm uppercase tracking-wide mb-4">{title}</h3>
      {children}
    </div>
  )
}

function Row({ label, value, bold }) {
  return (
    <div className="flex justify-between items-center py-1.5 border-b border-gray-100 last:border-0 text-sm">
      <span className="text-gray-500">{label}</span>
      <span className={bold ? 'font-semibold text-gray-900' : 'text-gray-700'}>{value}</span>
    </div>
  )
}

export default function ShipmentDetail() {
  const { id } = useParams()
  const { user } = useAuth()
  const [shipment, setShipment] = useState(null)
  const [loading, setLoading] = useState(true)
  const [deciding, setDeciding] = useState(false)
  const [reason, setReason] = useState('')
  const [decisionError, setDecisionError] = useState('')

  async function load() {
    setLoading(true)
    try {
      const res = await api.getShipment(id)
      setShipment(res.data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [id])

  async function decide(decision) {
    setDecisionError('')
    setDeciding(true)
    try {
      await api.decideShipment(id, decision, reason)
      await load()
      setReason('')
    } catch (err) {
      setDecisionError(err.message)
    } finally {
      setDeciding(false)
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  if (!shipment) return (
    <div className="p-8 text-center text-gray-500">Shipment not found.</div>
  )

  const result = shipment.resultJson
    ? (typeof shipment.resultJson === 'string' ? JSON.parse(shipment.resultJson) : shipment.resultJson)
    : null

  const canDecide = (user?.role === 'APPROVER' || user?.role === 'ADMIN') && shipment.status === 'PENDING'
  const latestApproval = shipment.approvals?.slice(-1)[0]

  return (
    <div className="p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <Link to="/shipments" className="text-gray-400 hover:text-gray-600 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900 font-mono">{shipment.ref}</h1>
            <StatusBadge status={shipment.status} />
          </div>
          <p className="text-gray-500 text-sm mt-1">
            {shipment.originCountry?.name ?? shipment.originCountryId} →{' '}
            {shipment.destinationCountry?.name ?? shipment.destinationCountryId} · {shipment.mode}
          </p>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-blue-700">{fmt(shipment.totalFreight)}</div>
          <div className="text-xs text-gray-400">Total Freight (SAR)</div>
        </div>
      </div>

      {/* Approval action */}
      {canDecide && (
        <div className="card p-6 mb-6 border-l-4 border-yellow-400 bg-yellow-50">
          <div className="flex items-center gap-2 mb-3">
            <AlertCircle className="w-5 h-5 text-yellow-600" />
            <h3 className="font-semibold text-gray-900">Approval Required</h3>
          </div>
          {result?.approval?.reasons?.length > 0 && (
            <ul className="text-sm text-yellow-800 list-disc list-inside mb-4 space-y-0.5">
              {result.approval.reasons.map((r, i) => <li key={i}>{r}</li>)}
            </ul>
          )}
          <div className="mb-3">
            <label className="label text-xs">Reason / Notes (optional)</label>
            <input
              type="text"
              className="input"
              placeholder="Add a note for this decision…"
              value={reason}
              onChange={e => setReason(e.target.value)}
            />
          </div>
          {decisionError && (
            <p className="text-red-600 text-sm mb-3">{decisionError}</p>
          )}
          <div className="flex gap-3">
            <button onClick={() => decide('APPROVED')} disabled={deciding} className="btn-success flex-1 justify-center">
              <CheckCircle className="w-4 h-4" />
              {deciding ? '…' : 'Approve'}
            </button>
            <button onClick={() => decide('REJECTED')} disabled={deciding} className="btn-danger flex-1 justify-center">
              <XCircle className="w-4 h-4" />
              {deciding ? '…' : 'Reject'}
            </button>
          </div>
        </div>
      )}

      {/* Decision history */}
      {latestApproval && shipment.status !== 'PENDING' && (
        <div className={`card p-4 mb-6 border-l-4 ${shipment.status === 'APPROVED' ? 'border-green-400 bg-green-50' : 'border-red-400 bg-red-50'}`}>
          <div className="flex items-center gap-2">
            {shipment.status === 'APPROVED'
              ? <CheckCircle className="w-4 h-4 text-green-600" />
              : <XCircle className="w-4 h-4 text-red-600" />
            }
            <span className="text-sm font-medium text-gray-900">
              {shipment.status === 'APPROVED' ? 'Approved' : 'Rejected'} by {latestApproval.decidedBy?.name ?? 'Unknown'}
            </span>
            {latestApproval.reason && (
              <span className="text-sm text-gray-600">— {latestApproval.reason}</span>
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Shipment info */}
        <Section title="Shipment Info">
          <Row label="Reference" value={<span className="font-mono">{shipment.ref}</span>} />
          <Row label="Mode" value={shipment.mode} />
          <Row label="Origin" value={`${shipment.originCountry?.code} – ${shipment.originCountry?.name}`} />
          <Row label="Destination" value={`${shipment.destinationCountry?.code} – ${shipment.destinationCountry?.name}`} />
          <Row label="Dangerous Goods" value={shipment.dangerousGoods ? 'Yes' : 'No'} />
          <Row label="Remote Area" value={shipment.remoteArea ? 'Yes' : 'No'} />
          <Row label="Declared Value" value={fmt(shipment.declaredValue ?? result?.declaredValue)} />
          <Row label="Created" value={new Date(shipment.createdAt).toLocaleString()} />
          <Row label="Created by" value={shipment.createdBy?.name ?? '—'} />
        </Section>

        {/* Packages */}
        <Section title={`Packages (${shipment.items?.length ?? 0} pieces)`}>
          {shipment.items?.length > 0 ? (
            <div className="space-y-3">
              {shipment.items.map((item, i) => (
                <div key={item.id} className="bg-gray-50 rounded-lg p-3 text-sm">
                  <div className="font-medium text-gray-700 mb-2">Piece {i + 1} × {item.quantity}</div>
                  <div className="grid grid-cols-3 gap-2 text-xs text-gray-500">
                    <span>L: {item.lengthCm} cm</span>
                    <span>W: {item.widthCm} cm</span>
                    <span>H: {item.heightCm} cm</span>
                    <span className="col-span-3 font-medium text-gray-700">Weight: {item.weightKg} kg</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400">No item details stored.</p>
          )}
        </Section>

        {/* Weight analysis */}
        {result?.weights && (
          <Section title="Weight Analysis">
            <Row label="Actual Weight" value={`${result.weights.actualWeight} kg`} />
            <Row label="Volumetric Weight" value={`${result.weights.volumetricWeight} kg`} />
            <Row label="Chargeable Weight" value={`${result.weights.chargeableWeight} kg`} bold />
            {result.weights.volumetricBasis && (
              <Row label="Vol. Basis" value={result.weights.volumetricBasis} />
            )}
          </Section>
        )}

        {/* Zone */}
        {result?.zone && (
          <Section title="Zone">
            <Row label="Zone Code" value={result.zone.code} />
            <Row label="Zone Name" value={result.zone.name} />
          </Section>
        )}

        {/* Cost breakdown */}
        {result && (
          <Section title="Cost Breakdown">
            <Row label="Base Freight" value={fmt(result.freight?.freightSubtotal)} />
            {result.freight?.basis && (
              <div className="text-xs text-gray-400 -mt-1 mb-2">{result.freight.basis}</div>
            )}
            {result.surcharges?.lines?.map(l => (
              <Row key={l.code} label={l.name} value={fmt(l.amount)} />
            ))}
            <div className="mt-2 pt-2 border-t border-gray-200">
              <Row label="Total Freight" value={fmt(result.totalFreight)} bold />
            </div>
          </Section>
        )}

        {/* Exclusions */}
        {result?.exclusions?.length > 0 && (
          <Section title="Exclusions (not in freight)">
            <div className="flex items-center gap-1 text-xs text-gray-400 mb-3">
              <Info className="w-3 h-3" />
              These are estimated costs, shown for reference only
            </div>
            {result.exclusions.map(e => (
              <Row key={e.code} label={e.name} value={fmt(e.amount)} />
            ))}
            <div className="mt-2 pt-2 border-t border-gray-200">
              <Row label="Total Landed (est.)" value={fmt(result.totalLanded)} bold />
            </div>
          </Section>
        )}
      </div>
    </div>
  )
}
