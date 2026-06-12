import * as XLSX from 'xlsx'

// Parse the stored quote snapshot (resultJson) safely.
function parseResult(s) {
  if (!s?.resultJson) return null
  try {
    return typeof s.resultJson === 'string' ? JSON.parse(s.resultJson) : s.resultJson
  } catch {
    return null
  }
}

// Flatten one shipment into a spreadsheet row with full details.
function toRow(s) {
  const r = parseResult(s)
  const surcharges = r?.surcharges?.lines || []
  // Join surcharge lines into a single readable cell, e.g. "Security: 7.20; Fuel: 183.86"
  const surchargeDetail = surcharges
    .map((l) => `${l.name}: ${Number(l.amount).toFixed(2)}`)
    .join('; ')

  return {
    'Reference': s.ref,
    'Status': s.status,
    'Origin': s.originCountry ? `${s.originCountry.code} – ${s.originCountry.name}` : '',
    'Destination': s.destinationCountry ? `${s.destinationCountry.code} – ${s.destinationCountry.name}` : '',
    'Mode': s.mode,
    'Dangerous Goods': s.dangerousGoods ? 'Yes' : 'No',
    'Remote Area': s.remoteArea ? 'Yes' : 'No',
    'Pieces': s.items?.length ?? 0,
    'Actual Wt (kg)': r?.weights?.actualWeight ?? '',
    'Volumetric Wt (kg)': r?.weights?.volumetricWeight ?? '',
    'Chargeable Wt (kg)': r?.weights?.chargeableWeight ?? s.chargeableWeight ?? '',
    'Zone': r?.zone?.code ?? '',
    'Base Freight (SAR)': r?.freight?.freightSubtotal ?? s.freightSubtotal ?? '',
    'Surcharge Total (SAR)': r?.surcharges?.total ?? s.surchargeTotal ?? '',
    'Surcharge Detail': surchargeDetail,
    'Total Freight (SAR)': s.totalFreight ?? r?.totalFreight ?? '',
    'Total Landed (SAR)': r?.totalLanded ?? '',
    'Declared Value (SAR)': s.declaredValue ?? r?.declaredValue ?? '',
    'Currency': s.currency ?? 'SAR',
    'Created By': s.createdBy?.name ?? '',
    'Created At': s.createdAt ? new Date(s.createdAt).toLocaleString() : '',
  }
}

/**
 * Build and trigger a download of an .xlsx file containing all shipments.
 * @param {Array} shipments  list of shipment records (with resultJson + relations)
 */
export function exportShipmentsToExcel(shipments) {
  const rows = (shipments || []).map(toRow)
  const ws = XLSX.utils.json_to_sheet(rows)

  // Auto-size columns based on the longest value in each.
  const headers = rows.length ? Object.keys(rows[0]) : []
  ws['!cols'] = headers.map((h) => {
    const maxLen = rows.reduce(
      (m, row) => Math.max(m, String(row[h] ?? '').length),
      h.length
    )
    return { wch: Math.min(maxLen + 2, 50) }
  })

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Shipments')

  const stamp = new Date().toISOString().slice(0, 10)
  XLSX.writeFile(wb, `afcc-shipments-${stamp}.xlsx`)
}
