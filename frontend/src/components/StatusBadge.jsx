const config = {
  DRAFT:    { cls: 'bg-gray-100 text-gray-700',   label: 'Draft' },
  PENDING:  { cls: 'bg-yellow-100 text-yellow-800', label: 'Pending' },
  APPROVED: { cls: 'bg-green-100 text-green-800',  label: 'Approved' },
  REJECTED: { cls: 'bg-red-100 text-red-800',      label: 'Rejected' },
}

export default function StatusBadge({ status }) {
  const { cls, label } = config[status] ?? { cls: 'bg-gray-100 text-gray-600', label: status }
  return <span className={`badge ${cls}`}>{label}</span>
}
