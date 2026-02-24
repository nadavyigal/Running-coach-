// Heart Rate Zone definitions — shared across run-report components

export type HRZone = {
  name: string
  min: number
  max: number
  color: string      // Tailwind bg-* class
  hexColor: string   // Hex for SVG / conic-gradient
  description: string
}

export const DEFAULT_HR_ZONES = [
  { name: 'Z5', min: 172, max: 200, color: 'bg-rose-500',    hexColor: '#f43f5e', description: 'Max / Anaerobic' },
  { name: 'Z4', min: 153, max: 171, color: 'bg-orange-500',  hexColor: '#f97316', description: 'Threshold' },
  { name: 'Z3', min: 134, max: 152, color: 'bg-emerald-500', hexColor: '#10b981', description: 'Aerobic' },
  { name: 'Z2', min: 115, max: 133, color: 'bg-sky-400',     hexColor: '#38bdf8', description: 'Endurance' },
  { name: 'Z1', min: 0,   max: 114, color: 'bg-slate-400',   hexColor: '#94a3b8', description: 'Recovery' },
] satisfies HRZone[]

export type ZoneDistribution = HRZone & { percent: number }

function z(zone: HRZone, percent: number): ZoneDistribution {
  return { name: zone.name, min: zone.min, max: zone.max, color: zone.color, hexColor: zone.hexColor, description: zone.description, percent }
}

const [Z5, Z4, Z3, Z2, Z1] = DEFAULT_HR_ZONES as [HRZone, HRZone, HRZone, HRZone, HRZone]

/** Estimate zone time distribution from avg HR when per-second data is unavailable. */
export function getZoneDistribution(avgHr: number): ZoneDistribution[] {
  if (avgHr > 165) return [z(Z5, 35), z(Z4, 45), z(Z3, 15), z(Z2, 5),  z(Z1, 0)]
  if (avgHr > 145) return [z(Z5, 5),  z(Z4, 25), z(Z3, 50), z(Z2, 15), z(Z1, 5)]
  return                  [z(Z5, 0),  z(Z4, 5),  z(Z3, 20), z(Z2, 60), z(Z1, 15)]
}
