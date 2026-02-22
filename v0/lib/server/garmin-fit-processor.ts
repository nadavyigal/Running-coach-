import 'server-only'

// eslint-disable-next-line @typescript-eslint/no-require-imports
const FitParserConstructor = require('fit-file-parser').default as new (
  options: Record<string, unknown>
) => {
  parseAsync(buffer: Buffer): Promise<FitData>
}

// ─── Raw FIT types (from fit-file-parser output) ─────────────────────────────

interface FitData {
  sessions?: RawSession[]
  laps?: RawLap[]
  records?: RawRecord[]
  events?: Record<string, unknown>[]
  device_infos?: Record<string, unknown>[]
}

interface RawSession {
  sport?: string
  sub_sport?: string
  start_time?: Date
  total_distance?: number
  total_elapsed_time?: number
  avg_heart_rate?: number
  max_heart_rate?: number
  avg_cadence?: number
  total_calories?: number
  total_ascent?: number
  total_descent?: number
  max_speed?: number
  laps?: RawLap[]
}

interface RawLap {
  start_time?: Date
  total_distance?: number
  total_elapsed_time?: number
  avg_heart_rate?: number
  max_heart_rate?: number
  avg_cadence?: number
  avg_speed?: number
  total_ascent?: number
  records?: RawRecord[]
}

interface RawRecord {
  timestamp?: Date
  heart_rate?: number
  cadence?: number
  speed?: number
  distance?: number
  altitude?: number
  enhanced_altitude?: number
  position_lat?: number
  position_long?: number
  elapsed_time?: number
}

// ─── Public types ─────────────────────────────────────────────────────────────

export interface FitLap {
  lapNumber: number
  startTime: string | null   // ISO string
  totalDistanceM: number
  totalElapsedS: number
  avgHeartRate: number | null
  maxHeartRate: number | null
  avgCadenceSpm: number | null  // doubled: FIT stores strides/min, we want steps/min
  avgSpeedMps: number | null
  totalAscentM: number | null
}

export interface FitKmSplit {
  splitKm: number       // 1, 2, 3 …
  paceSPerKm: number    // seconds per km
  avgHr: number | null
  avgCadenceSpm: number | null
  elevationGainM: number | null
}

export interface FitRecord {
  timestampMs: number
  heartRate: number | null
  cadenceSpm: number | null  // doubled
  speedMps: number | null
  distanceM: number | null
  altitudeM: number | null
  lat: number | null
  lng: number | null
}

export interface ParsedFitActivity {
  session: {
    sportType: string | null
    startTime: string | null   // ISO
    totalDistanceM: number | null
    totalElapsedS: number | null
    avgHeartRate: number | null
    maxHeartRate: number | null
    avgCadenceSpm: number | null
    totalCalories: number | null
    totalAscent: number | null
    totalDescent: number | null
    maxSpeedMps: number | null
  }
  laps: FitLap[]
  kmSplits: FitKmSplit[]
  records: FitRecord[]    // downsampled to every 5th point to fit JSONB limits
}

// ─── Download ─────────────────────────────────────────────────────────────────

/**
 * Download binary FIT file from Garmin Activity API using OAuth2 Bearer token.
 * The callbackURL is provided in the `activityFiles` webhook push payload.
 */
export async function downloadFitFile(
  callbackUrl: string,
  accessToken: string
): Promise<Buffer> {
  const response = await fetch(callbackUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!response.ok) {
    throw new Error(`FIT download failed: ${response.status} ${response.statusText}`)
  }
  const arrayBuffer = await response.arrayBuffer()
  return Buffer.from(arrayBuffer)
}

// ─── Parse ────────────────────────────────────────────────────────────────────

/**
 * Parse a FIT binary buffer into structured activity data.
 */
export async function parseFitBuffer(buffer: Buffer): Promise<ParsedFitActivity> {
  const parser = new FitParserConstructor({
    force: true,
    speedUnit: 'm/s',      // keep native m/s for consistency
    lengthUnit: 'm',
    temperatureUnit: 'celsius',
    elapsedRecordField: true,
    mode: 'cascade',       // laps contain their own records array
  })

  const data: FitData = await parser.parseAsync(buffer)
  return transformFitData(data)
}

// ─── Transform ────────────────────────────────────────────────────────────────

function transformFitData(data: FitData): ParsedFitActivity {
  // In cascade mode, session contains laps which contain records.
  // In some files, laps / records appear at top level too.
  const rawSessions = data.sessions ?? []
  const rawSession: RawSession = rawSessions[0] ?? {}

  // Prefer laps nested in session, fall back to top-level laps
  const rawLaps: RawLap[] = (rawSession.laps ?? data.laps ?? [])

  // Flatten all per-second records across laps
  const allRawRecords: RawRecord[] = rawLaps.flatMap((lap) => lap.records ?? [])
  // If no records in laps, try top-level
  const rawRecords: RawRecord[] = allRawRecords.length > 0
    ? allRawRecords
    : (data.records ?? [])

  const session = {
    sportType: getString(rawSession.sport) ?? getString(rawSession.sub_sport),
    startTime: rawSession.start_time instanceof Date
      ? rawSession.start_time.toISOString()
      : null,
    totalDistanceM: getNumber(rawSession.total_distance),
    totalElapsedS: getNumber(rawSession.total_elapsed_time),
    avgHeartRate: getNumber(rawSession.avg_heart_rate),
    maxHeartRate: getNumber(rawSession.max_heart_rate),
    avgCadenceSpm: doubleIfPresent(getNumber(rawSession.avg_cadence)),
    totalCalories: getNumber(rawSession.total_calories),
    totalAscent: getNumber(rawSession.total_ascent),
    totalDescent: getNumber(rawSession.total_descent),
    maxSpeedMps: getNumber(rawSession.max_speed),
  }

  const laps: FitLap[] = rawLaps.map((lap, i) => ({
    lapNumber: i + 1,
    startTime: lap.start_time instanceof Date ? lap.start_time.toISOString() : null,
    totalDistanceM: getNumber(lap.total_distance) ?? 0,
    totalElapsedS: getNumber(lap.total_elapsed_time) ?? 0,
    avgHeartRate: getNumber(lap.avg_heart_rate),
    maxHeartRate: getNumber(lap.max_heart_rate),
    avgCadenceSpm: doubleIfPresent(getNumber(lap.avg_cadence)),
    avgSpeedMps: getNumber(lap.avg_speed),
    totalAscentM: getNumber(lap.total_ascent),
  }))

  const kmSplits = deriveKmSplits(rawRecords)
  const records = downsample(rawRecords.map(normalizeRecord), 5)

  return { session, laps, kmSplits, records }
}

function normalizeRecord(r: RawRecord): FitRecord {
  const ts = r.timestamp instanceof Date ? r.timestamp.getTime() : 0
  return {
    timestampMs: ts,
    heartRate: getNumber(r.heart_rate),
    cadenceSpm: doubleIfPresent(getNumber(r.cadence)),
    speedMps: getNumber(r.speed),
    distanceM: getNumber(r.distance),
    altitudeM: getNumber(r.altitude) ?? getNumber(r.enhanced_altitude),
    lat: getNumber(r.position_lat),
    lng: getNumber(r.position_long),
  }
}

function deriveKmSplits(records: RawRecord[]): FitKmSplit[] {
  const splits: FitKmSplit[] = []
  let prevDistM = 0
  let prevElapsedS = 0
  let splitHrSum = 0
  let splitHrCount = 0
  let splitCadSum = 0
  let splitCadCount = 0
  let prevAlt: number | null = null
  let elevGain = 0

  for (const r of records) {
    const dist = getNumber(r.distance) ?? 0
    const elapsed = getNumber(r.elapsed_time) ?? 0
    const hr = getNumber(r.heart_rate)
    const cad = getNumber(r.cadence)
    const alt = getNumber(r.altitude) ?? getNumber(r.enhanced_altitude)

    if (hr != null) { splitHrSum += hr; splitHrCount++ }
    if (cad != null) { splitCadSum += cad; splitCadCount++ }
    if (alt != null && prevAlt != null && alt > prevAlt) elevGain += alt - prevAlt
    prevAlt = alt ?? prevAlt

    const targetKm = (splits.length + 1) * 1000
    if (dist >= targetKm) {
      const splitDistM = dist - prevDistM
      const splitElapsedS = elapsed - prevElapsedS
      const paceSPerKm = splitDistM > 0
        ? Math.round((splitElapsedS / splitDistM) * 1000)
        : 0

      splits.push({
        splitKm: splits.length + 1,
        paceSPerKm,
        avgHr: splitHrCount > 0 ? Math.round(splitHrSum / splitHrCount) : null,
        avgCadenceSpm: splitCadCount > 0
          ? Math.round((splitCadSum / splitCadCount) * 2)   // double for steps/min
          : null,
        elevationGainM: Math.round(elevGain),
      })

      prevDistM = dist
      prevElapsedS = elapsed
      splitHrSum = 0; splitHrCount = 0
      splitCadSum = 0; splitCadCount = 0
      prevAlt = alt ?? null
      elevGain = 0
    }
  }

  return splits
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function downsample<T>(items: T[], everyN: number): T[] {
  return items.filter((_, i) => i % everyN === 0)
}

function doubleIfPresent(v: number | null): number | null {
  return v != null ? v * 2 : null
}

function getString(v: unknown): string | null {
  return typeof v === 'string' && v.trim().length > 0 ? v.trim() : null
}

function getNumber(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string') {
    const n = Number(v)
    return Number.isFinite(n) ? n : null
  }
  return null
}
