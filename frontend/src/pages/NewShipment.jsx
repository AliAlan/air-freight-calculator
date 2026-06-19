import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import CurrencyConverter from '../components/CurrencyConverter'
import { Plus, Trash2, Calculator, Save, AlertCircle, CheckCircle, Info, ChevronDown, ChevronUp } from 'lucide-react'

const MODES = ['Express', 'DangerousGoods', 'Eco']

const DG_SUBTYPES = [
  { code: 'FULL_DG',         name: 'Full DG (IATA class 2/3/4/5/6/8/9)' },
  { code: 'DRY_ICE',         name: 'Dry Ice (UN1845)' },
  { code: 'LI_ION_966',      name: 'Lithium Ion – PI966 Sec II' },
  { code: 'LI_METAL_969',    name: 'Lithium Metal – PI969 Sec II' },
  { code: 'EXC_QTY',         name: 'Excepted Quantities' },
  { code: 'LTD_QTY',         name: 'Limited Quantities (ADR ≤30kg)' },
  { code: 'CONS_COMM',       name: 'Consumer Commodity (ID8000)' },
  { code: 'ADR_LOAD_EXEMPT', name: 'ADR Load Exemptions (1.1.3.6)' },
]

// Optional surcharges grouped for the UI
const OPTIONAL_GROUPS = [
  {
    group: 'Delivery Options',
    items: [
      { code: 'SAT_DEL',    name: 'Saturday Delivery',              detail: '176 SAR flat' },
      { code: 'DED_DEL',    name: 'Dedicated Delivery',             detail: '2.20/kg, min 180' },
      { code: 'DEL_SIG',    name: 'Delivery Signature',             detail: '25 SAR flat' },
      { code: 'DIRECT_SIG', name: 'Direct Signature',               detail: '25 SAR flat' },
      { code: 'VERBAL_NOTIF',name: 'Verbal Delivery Notification',  detail: '25 SAR flat' },
      { code: 'RES_ADDR',   name: 'Residential Address',            detail: '22 SAR flat' },
      { code: 'NEUTRAL_DEL',name: 'Neutral Delivery',               detail: '22 SAR flat' },
    ],
  },
  {
    group: 'Pickup Options',
    items: [
      { code: 'SAT_PU',   name: 'Saturday Pickup',    detail: '132 SAR flat' },
      { code: 'DED_PU',   name: 'Dedicated Pickup',   detail: '2.20/kg, min 132' },
    ],
  },
  {
    group: 'Customs & Clearance',
    items: [
      { code: 'CLEAR_AUTH',   name: 'Clearance Authorization',  detail: '50 SAR flat' },
      { code: 'REL_BROKER',   name: 'Release to Broker',        detail: '200 SAR flat' },
      { code: 'BROKER_NOTIF', name: 'Broker Notification',      detail: '52.80 SAR flat' },
      { code: 'IOR',          name: 'Importer of Record',       detail: '80 SAR flat' },
      { code: 'PERMITS_LIC',  name: 'Permits & Licences',       detail: '198 SAR flat' },
      { code: 'PREF_ORIGIN',  name: 'Preferential Origin',      detail: '44 SAR flat' },
      { code: 'EXPORT_DECL',  name: 'Export Declaration',       detail: '44 SAR flat' },
      { code: 'TEMP_IMP_EXP', name: 'Temporary Import/Export',  detail: '200 SAR flat' },
    ],
  },
  {
    group: 'Duty & Tax',
    items: [
      { code: 'DUTY_TAX_PAID', name: 'Duty Tax Paid',        detail: 'max(2% × declared, 100)' },
      { code: 'DUTY_TAX_PROC', name: 'Duty Tax Processing',  detail: 'max(2% × declared, 110)' },
    ],
  },
  {
    group: 'Insurance & Liability',
    items: [
      { code: 'SHIP_INS', name: 'Shipment Insurance',   detail: 'max(2% × declared, 75)' },
      { code: 'EXT_LIAB', name: 'Extended Liability',   detail: '40 SAR flat' },
    ],
  },
  {
    group: 'Packaging & Preparation',
    items: [
      { code: 'SHIP_PREP', name: 'Shipment Preparation', detail: '110 SAR flat' },
      { code: 'PKG_ITEM',  name: 'Packaging Item',       detail: '15 SAR flat' },
    ],
  },
  {
    group: 'Sustainability',
    items: [
      { code: 'GOGREEN', name: 'GoGreen Plus (CO₂ reduced)', detail: '0.69/kg' },
    ],
  },
]

function emptyItem() {
  return { quantity: 1, lengthCm: 60, widthCm: 40, heightCm: 50, weightKg: 10 }
}

function fmt(n) {
  if (n == null) return '—'
  return new Intl.NumberFormat('en-SA', { style: 'currency', currency: 'SAR', minimumFractionDigits: 2 }).format(n)
}

function ResultPanel({ result, onSave, saving }) {
  if (!result) return null

  const isError = result.error || result.status === 'REJECTED'
  const requiresApproval = result.approval?.requiresApproval

  return (
    <div className="card mt-6 overflow-hidden">
      <div className={`px-6 py-4 border-b ${isError ? 'bg-red-50 border-red-200' : requiresApproval ? 'bg-yellow-50 border-yellow-200' : 'bg-green-50 border-green-200'}`}>
        <div className="flex items-center gap-2">
          {isError
            ? <AlertCircle className="w-5 h-5 text-red-600" />
            : requiresApproval
            ? <AlertCircle className="w-5 h-5 text-yellow-600" />
            : <CheckCircle className="w-5 h-5 text-green-600" />
          }
          <h3 className="font-semibold text-gray-900">
            {isError ? 'Calculation Error' : requiresApproval ? 'Requires Approval' : 'Auto-Approved'}
          </h3>
        </div>
        {requiresApproval && result.approval?.reasons?.length > 0 && (
          <ul className="mt-2 text-sm text-yellow-800 list-disc list-inside space-y-0.5">
            {result.approval.reasons.map((r, i) => <li key={i}>{r}</li>)}
          </ul>
        )}
        {isError && result.error && (
          <p className="mt-1 text-sm text-red-700">{result.error}</p>
        )}
      </div>

      {!isError && (
        <div className="p-6 space-y-6">
          {/* Weights */}
          <div>
            <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Weight Analysis</h4>
            <div className="grid grid-cols-3 gap-3">
              {[
                ['Actual', `${result.weights?.actualWeight} kg`],
                ['Volumetric', `${result.weights?.volumetricWeight} kg`],
                ['Chargeable', `${result.weights?.chargeableWeight} kg`],
              ].map(([l, v]) => (
                <div key={l} className="bg-gray-50 rounded-lg p-3 text-center">
                  <div className="text-xs text-gray-500">{l}</div>
                  <div className="font-semibold text-gray-900 text-sm mt-0.5">{v}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Zone */}
          <div>
            <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Zone</h4>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-sm font-semibold">
                {result.zone?.code}
              </span>
              <span className="text-sm text-gray-600">{result.zone?.name}</span>
            </div>
          </div>

          {/* Cost breakdown */}
          <div>
            <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Cost Breakdown</h4>
            <div className="space-y-2">
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-600">Base Freight</span>
                <span className="font-medium text-gray-900">{fmt(result.freight?.freightSubtotal)}</span>
              </div>
              <div className="text-xs text-gray-400 -mt-1 mb-1">{result.freight?.basis}</div>

              {result.surcharges?.lines?.map(l => (
                <div key={l.code} className="flex justify-between items-center text-sm">
                  <span className="text-gray-500">{l.name}</span>
                  <span className="text-gray-700">{fmt(l.amount)}</span>
                </div>
              ))}

              <div className="border-t border-gray-200 pt-2 flex justify-between items-center text-sm font-semibold">
                <span>Total Freight</span>
                <span className="text-blue-700 text-base">{fmt(result.totalFreight)}</span>
              </div>

              {result.exclusions?.length > 0 && (
                <>
                  <div className="mt-3 pt-3 border-t border-dashed border-gray-200">
                    <div className="flex items-center gap-1 text-xs text-gray-400 mb-2">
                      <Info className="w-3 h-3" />
                      Excluded from freight (shown for reference)
                    </div>
                    {result.exclusions.map(e => (
                      <div key={e.code} className="flex justify-between items-center text-sm text-gray-400">
                        <span>{e.name}</span>
                        <span>{fmt(e.amount)}</span>
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-between items-center text-sm font-medium text-gray-500 border-t border-gray-100 pt-2">
                    <span>Total Landed (incl. taxes)</span>
                    <span>{fmt(result.totalLanded)}</span>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {!isError && (
        <div className="px-6 pb-6">
          <button
            onClick={onSave}
            disabled={saving}
            className="btn-primary w-full justify-center py-2.5"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Saving…' : 'Save Shipment'}
          </button>
        </div>
      )}
    </div>
  )
}

function OptionalSurchargesSection({ selected, onToggle }) {
  const [open, setOpen] = useState(false)

  return (
    <div className="card p-6">
      <button
        type="button"
        className="flex items-center justify-between w-full"
        onClick={() => setOpen(o => !o)}
      >
        <div>
          <h2 className="font-semibold text-gray-900 text-left">Optional Services</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            {selected.length > 0 ? `${selected.length} selected` : 'None selected — click to expand'}
          </p>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
      </button>

      {open && (
        <div className="mt-4 space-y-5">
          {OPTIONAL_GROUPS.map(grp => (
            <div key={grp.group}>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">{grp.group}</p>
              <div className="space-y-1.5">
                {grp.items.map(s => (
                  <label key={s.code} className="flex items-center gap-3 cursor-pointer group">
                    <input
                      type="checkbox"
                      className="w-4 h-4 text-blue-600 rounded"
                      checked={selected.includes(s.code)}
                      onChange={() => onToggle(s.code)}
                    />
                    <span className="text-sm text-gray-700 group-hover:text-gray-900">{s.name}</span>
                    <span className="text-xs text-gray-400 ml-auto">{s.detail}</span>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function NewShipment() {
  const navigate = useNavigate()
  const [countries, setCountries] = useState([])
  const [form, setForm] = useState({
    originCountry: 'DE',
    destinationCountry: 'SA',
    mode: 'Express',
    dangerousGoods: false,
    dgSubtype: 'FULL_DG',
    nonConveyableIrregular: false,
    nonStackable: false,
    declaredValue: 4200,
    currency: 'SAR',
  })
  const [items, setItems] = useState([emptyItem()])
  const [selectedSurcharges, setSelectedSurcharges] = useState([])
  const [preview, setPreview] = useState(null)
  const [calculating, setCalculating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [fuel, setFuel] = useState(null)

  const isDG = form.dangerousGoods || form.mode === 'DangerousGoods'

  useEffect(() => {
    api.getCountries().then(res => {
      const list = res.data?.countries ?? res.data ?? []
      setCountries(Array.isArray(list) ? list : [])
    })
    api.getFuelRate().then(res => setFuel(res.data)).catch(() => {})
  }, [])

  function setField(field, value) {
    setForm(p => ({ ...p, [field]: value }))
    setPreview(null)
  }

  function updateItem(i, field, value) {
    setItems(prev => prev.map((it, idx) => idx === i ? { ...it, [field]: value } : it))
    setPreview(null)
  }

  function addItem() { setItems(p => [...p, emptyItem()]); setPreview(null) }
  function removeItem(i) { setItems(p => p.filter((_, idx) => idx !== i)); setPreview(null) }

  function toggleSurcharge(code) {
    setSelectedSurcharges(prev =>
      prev.includes(code) ? prev.filter(c => c !== code) : [...prev, code]
    )
    setPreview(null)
  }

  function buildPayload() {
    return {
      ...form,
      dangerousGoods: isDG,
      dgSubtype: isDG ? (form.dgSubtype || 'FULL_DG') : null,
      declaredValue: Number(form.declaredValue),
      selectedSurcharges,
      nonConveyableIrregular: form.nonConveyableIrregular,
      nonStackable: form.nonStackable,
      items: items.map(it => ({
        quantity: Number(it.quantity),
        lengthCm: Number(it.lengthCm),
        widthCm: Number(it.widthCm),
        heightCm: Number(it.heightCm),
        weightKg: Number(it.weightKg),
      })),
    }
  }

  async function calculate() {
    setError('')
    setCalculating(true)
    try {
      const res = await api.previewShipment(buildPayload())
      setPreview(res.data)
    } catch (err) {
      setError(err.message)
    } finally {
      setCalculating(false)
    }
  }

  async function save() {
    setSaving(true)
    setError('')
    try {
      const res = await api.createShipment(buildPayload())
      const id = res.data?.id ?? res.data?.shipment?.id
      navigate(`/shipments/${id}`)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const originOptions = countries.filter(c => c.code !== 'SA')
  const destOptions = countries

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">New Shipment</h1>
          <p className="text-gray-500 text-sm mt-1">Calculate and save a freight cost estimate</p>
        </div>
        {fuel && (
          <div
            className="text-right bg-blue-50 border border-blue-200 rounded-lg px-3 py-2"
            title={fuel.source === 'dhl-live'
              ? `Live from DHL · fetched ${new Date(fuel.fetchedAt).toLocaleString()}`
              : 'Using fallback rate — DHL site unreachable'}
          >
            <div className="text-xs text-blue-500">DHL Air Fuel Surcharge</div>
            <div className="text-lg font-bold text-blue-700 leading-none mt-0.5">
              {fuel.rate}% {fuel.week && <span className="text-xs font-medium text-blue-400">· {fuel.week}</span>}
            </div>
            <div className="text-[10px] text-blue-400 mt-0.5">
              {fuel.source === 'dhl-live' ? 'live · updated weekly' : 'fallback rate'}
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-2 text-red-700 bg-red-50 border border-red-200 rounded-lg px-4 py-3 mb-6 text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: form */}
        <div className="lg:col-span-2 space-y-6">
          {/* Shipment details */}
          <div className="card p-6">
            <h2 className="font-semibold text-gray-900 mb-4">Shipment Details</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Origin Country</label>
                <select className="input" value={form.originCountry}
                  onChange={e => setField('originCountry', e.target.value)}>
                  {originOptions.map(c => (
                    <option key={c.code} value={c.code}>{c.code} – {c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Destination Country</label>
                <select className="input" value={form.destinationCountry}
                  onChange={e => setField('destinationCountry', e.target.value)}>
                  {destOptions.map(c => (
                    <option key={c.code} value={c.code}>{c.code} – {c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Service Mode</label>
                <select className="input" value={form.mode}
                  onChange={e => setField('mode', e.target.value)}>
                  {MODES.map(m => <option key={m}>{m}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Declared Value (SAR)</label>
                <input type="number" className="input" value={form.declaredValue} min={0}
                  onChange={e => setField('declaredValue', e.target.value)} />
              </div>
            </div>

            {/* DG options */}
            <div className="mt-4 space-y-3">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="dg"
                  className="w-4 h-4 text-blue-600 rounded"
                  checked={isDG}
                  onChange={e => setField('dangerousGoods', e.target.checked)}
                />
                <label htmlFor="dg" className="text-sm text-gray-700">Dangerous Goods (DG / IATA)</label>
              </div>

              {isDG && (
                <div className="ml-6">
                  <label className="label">DG Sub-type</label>
                  <select className="input" value={form.dgSubtype}
                    onChange={e => setField('dgSubtype', e.target.value)}>
                    {DG_SUBTYPES.map(d => (
                      <option key={d.code} value={d.code}>{d.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Piece characteristics */}
              <div className="flex flex-col gap-2 pt-1">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="ncIrr"
                    className="w-4 h-4 text-blue-600 rounded"
                    checked={form.nonConveyableIrregular}
                    onChange={e => setField('nonConveyableIrregular', e.target.checked)}
                  />
                  <label htmlFor="ncIrr" className="text-sm text-gray-700">
                    Non-conveyable irregular shape
                    <span className="text-xs text-gray-400 ml-1">(e.g. drums, tyres, odd-shaped)</span>
                  </label>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="nonStack"
                    className="w-4 h-4 text-blue-600 rounded"
                    checked={form.nonStackable}
                    onChange={e => setField('nonStackable', e.target.checked)}
                  />
                  <label htmlFor="nonStack" className="text-sm text-gray-700">
                    Non-stackable pallet
                    <span className="text-xs text-gray-400 ml-1">(pallet must not be stacked)</span>
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* Items */}
          <div className="card p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-900">Packages / Pieces</h2>
              <button onClick={addItem} className="btn-secondary text-xs py-1.5 px-3">
                <Plus className="w-3 h-3" /> Add Piece
              </button>
            </div>

            <div className="space-y-4">
              {items.map((item, i) => (
                <div key={i} className="border border-gray-200 rounded-lg p-4 relative">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Piece {i + 1}</span>
                    {items.length > 1 && (
                      <button onClick={() => removeItem(i)} className="text-red-400 hover:text-red-600 transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-5 gap-3">
                    {[
                      ['Qty', 'quantity', 1],
                      ['L (cm)', 'lengthCm', 1],
                      ['W (cm)', 'widthCm', 1],
                      ['H (cm)', 'heightCm', 1],
                      ['Weight (kg)', 'weightKg', 0.1],
                    ].map(([label, field, step]) => (
                      <div key={field}>
                        <label className="label text-xs">{label}</label>
                        <input
                          type="number"
                          className="input text-sm"
                          value={item[field]}
                          step={step}
                          min={0.01}
                          onChange={e => updateItem(i, field, e.target.value)}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Optional services */}
          <OptionalSurchargesSection selected={selectedSurcharges} onToggle={toggleSurcharge} />

          <button
            onClick={calculate}
            disabled={calculating}
            className="btn-primary w-full justify-center py-3 text-base"
          >
            <Calculator className="w-5 h-5" />
            {calculating ? 'Calculating…' : 'Calculate Freight Cost'}
          </button>
        </div>

        {/* Right: converter + result */}
        <div className="lg:col-span-1">
          <CurrencyConverter onUseSar={(v) => setField('declaredValue', v)} />
          {preview ? (
            <ResultPanel result={preview} onSave={save} saving={saving} />
          ) : (
            <div className="card p-6 text-center text-gray-400">
              <Calculator className="w-10 h-10 mx-auto mb-3 text-gray-200" />
              <p className="text-sm">Fill in the form and click<br /><strong>Calculate</strong> to see results</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
