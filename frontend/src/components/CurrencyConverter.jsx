import { useState } from 'react'
import { ArrowRightLeft, DollarSign, Check } from 'lucide-react'

// SAR is pegged to the USD at 3.75 (official rate since 1986).
const PEG_RATE = 3.75

/**
 * Compact USD <-> SAR converter for the New Shipment screen.
 * Bidirectional; rate editable (defaults to the official peg).
 * @param {(sar:number)=>void} [onUseSar] optional — push the SAR amount into the form.
 */
export default function CurrencyConverter({ onUseSar }) {
  const [usd, setUsd] = useState('100')
  const [sar, setSar] = useState((100 * PEG_RATE).toFixed(2))
  const [rate, setRate] = useState(String(PEG_RATE))
  const [used, setUsed] = useState(false)

  const r = parseFloat(rate) || 0

  function changeUsd(v) {
    setUsd(v)
    const n = parseFloat(v)
    setSar(Number.isFinite(n) ? (n * r).toFixed(2) : '')
    setUsed(false)
  }
  function changeSar(v) {
    setSar(v)
    const n = parseFloat(v)
    setUsd(Number.isFinite(n) && r ? (n / r).toFixed(2) : '')
    setUsed(false)
  }
  function changeRate(v) {
    setRate(v)
    const nr = parseFloat(v)
    const nu = parseFloat(usd)
    if (Number.isFinite(nr) && Number.isFinite(nu)) setSar((nu * nr).toFixed(2))
    setUsed(false)
  }

  const sarValue = parseFloat(sar)

  return (
    <div className="card p-5 mb-6">
      <div className="flex items-center gap-2 mb-3">
        <ArrowRightLeft className="w-4 h-4 text-emerald-600" />
        <h3 className="font-semibold text-gray-900 text-sm">USD &harr; SAR Converter</h3>
      </div>

      <div className="space-y-3">
        <div>
          <label className="label text-xs">US Dollar (USD)</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
            <input type="number" min="0" className="input pl-7" value={usd}
              onChange={(e) => changeUsd(e.target.value)} />
          </div>
        </div>

        <div>
          <label className="label text-xs">Saudi Riyal (SAR)</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">SAR</span>
            <input type="number" min="0" className="input pl-11" value={sar}
              onChange={(e) => changeSar(e.target.value)} />
          </div>
        </div>

        <div className="flex items-center justify-between gap-2">
          <label className="text-xs text-gray-500">Rate (1 USD =)</label>
          <input type="number" step="0.01" min="0" className="input w-24 text-sm py-1"
            value={rate} onChange={(e) => changeRate(e.target.value)} />
        </div>
        <p className="text-[11px] text-gray-400 -mt-1">
          SAR is pegged to USD at {PEG_RATE}. Edit the rate if needed.
        </p>

        {onUseSar && (
          <button
            type="button"
            onClick={() => { if (Number.isFinite(sarValue)) { onUseSar(Math.round(sarValue)); setUsed(true) } }}
            disabled={!Number.isFinite(sarValue)}
            className="btn-secondary w-full justify-center text-xs py-2 disabled:opacity-50"
          >
            {used ? <><Check className="w-3.5 h-3.5" /> Set as Declared Value</> : <><DollarSign className="w-3.5 h-3.5" /> Use as Declared Value</>}
          </button>
        )}
      </div>
    </div>
  )
}
