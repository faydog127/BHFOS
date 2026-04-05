export function pqiBadgeClass(pqi) {
  const n = Number(pqi || 0);
  const base = "px-2 py-1 text-xs font-bold rounded";
  if (n >= 80) return `${base} bg-green-100 text-green-900 border border-green-300`;
  if (n >= 60) return `${base} bg-yellow-100 text-yellow-900 border border-yellow-300`;
  return `${base} bg-red-100 text-red-900 border border-red-300`;
}

export function severityChipClass(sev) {
  const n = Number(sev || 0);
  const base = "px-2 py-1 rounded text-xs border inline-block";
  if (n >= 16) return `${base} bg-red-50 border-red-300 text-red-800`;
  if (n >= 8)  return `${base} bg-yellow-50 border-yellow-300 text-yellow-800`;
  return `${base} bg-gray-50 border-gray-300 text-gray-700`;
}