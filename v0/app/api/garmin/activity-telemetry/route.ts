import { NextRequest, NextResponse } from 'next/server'
import { lookbackStartIso, readGarminExportRows } from '@/lib/server/garmin-export-store'
import { getGarminOAuthState } from '@/lib/server/garmin-oauth-store'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

interface GarminLapLike {
  index: number
  distanceKm: number | null
  durationSec: number | null
  paceSecPerKm: number | null
  avgHr: number | null
  avgCadence: number | null
  elevationGainM: number | null
}

interface GarminSamplePoint {
  timestampSec: number
  timerSec: number | null
  distanceM: number | null
  heartRate: number | null
  cadenceSpm: number | null
  elevationM: number | null
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {}
}

function asRecordArray(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) return []
  return value
    .map((entry) => asRecord(entry))
    .filter((entry) => Object.keys(entry).length > 0)
}

function getString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null
}

function getNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

function getNestedValue(record: Record<string, unknown>, path: string[]): unknown {
  let current: unknown = record
  for (const key of path) {
    if (!current || typeof current !== 'object') return null
    current = (current as Record<string, unknown>)[key]
  }
  return current
}

function pickNumber(record: Record<string, unknown>, paths: string[][]): number | null {
  for (const path of paths) {
    const value = getNumber(getNestedValue(record, path))
    if (value != null) return value
  }
  return null
}

function parseUserId(value: string | null): number | null {
  if (!value) return null
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

function parseFiniteNumber(value: string | null): number | null {
  if (!value) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function normalizeLapLikeRow(entry: Record<string, unknown>, index: number): GarminLapLike {
  const distanceMeters = pickNumber(entry, [
    ['distanceInMeters'],
    ['distanceMeters'],
    ['distance_m'],
    ['distance'],
  ])
  const durationSec = pickNumber(entry, [
    ['durationInSeconds'],
    ['durationSeconds'],
    ['duration_s'],
    ['duration'],
  ])
  const averageSpeedMps = pickNumber(entry, [
    ['averageSpeedInMetersPerSecond'],
    ['avgSpeedMps'],
    ['averageSpeed'],
  ])
  const paceSecFromSpeed =
    averageSpeedMps != null && averageSpeedMps > 0 ? 1000 / averageSpeedMps : null
  const paceSecFromDuration =
    durationSec != null && distanceMeters != null && distanceMeters > 0
      ? durationSec / (distanceMeters / 1000)
      : null

  return {
    index: index + 1,
    distanceKm: distanceMeters != null ? Number((distanceMeters / 1000).toFixed(2)) : null,
    durationSec: durationSec != null ? Math.round(durationSec) : null,
    paceSecPerKm:
      paceSecFromDuration != null
        ? Math.round(paceSecFromDuration)
        : paceSecFromSpeed != null
          ? Math.round(paceSecFromSpeed)
          : null,
    avgHr: pickNumber(entry, [
      ['averageHeartRateInBeatsPerMinute'],
      ['avg_hr'],
      ['averageHR'],
    ]),
    avgCadence: pickNumber(entry, [
      ['averageRunCadenceInStepsPerMinute'],
      ['averageCadenceInStepsPerMinute'],
      ['avg_cadence_spm'],
      ['averageCadence'],
    ]),
    elevationGainM: pickNumber(entry, [
      ['totalElevationGainInMeters'],
      ['elevationGain'],
      ['elevation_gain_m'],
    ]),
  }
}

function average(values: Array<number | null | undefined>): number | null {
  const valid = values.filter((value): value is number => value != null && Number.isFinite(value))
  if (valid.length === 0) return null
  return valid.reduce((sum, value) => sum + value, 0) / valid.length
}

function stdDev(values: number[]): number | null {
  if (values.length === 0) return null
  const avg = values.reduce((sum, value) => sum + value, 0) / values.length
  const variance = values.reduce((sum, value) => sum + (value - avg) ** 2, 0) / values.length
  return Math.sqrt(variance)
}

function splitHalfPace(values: GarminLapLike[]): { firstHalfSec: number | null; secondHalfSec: number | null } {
  const paces = values.map((entry) => entry.paceSecPerKm).filter((value): value is number => value != null)
  if (paces.length < 2) return { firstHalfSec: null, secondHalfSec: null }
  const mid = Math.floor(paces.length / 2)
  const first = paces.slice(0, mid)
  const second = paces.slice(mid)
  return {
    firstHalfSec: average(first),
    secondHalfSec: average(second),
  }
}

function toNumberArray(values: Array<number | null | undefined>): number[] {
  return values.filter((value): value is number => value != null && Number.isFinite(value))
}

function normalizeSamplePoints(rows: Record<string, unknown>[]): GarminSamplePoint[] {
  const normalized: GarminSamplePoint[] = []

  for (const row of rows) {
    const timestampSec = pickNumber(row, [['startTimeInSeconds'], ['timestamp'], ['timeInSeconds']])
    if (timestampSec == null) continue

    normalized.push({
      timestampSec: Math.round(timestampSec),
      timerSec: pickNumber(row, [['timerDurationInSeconds'], ['elapsedDurationInSeconds'], ['clockDurationInSeconds']]),
      distanceM: pickNumber(row, [['totalDistanceInMeters'], ['distanceInMeters'], ['distanceMeters'], ['distance_m']]),
      heartRate: pickNumber(row, [['heartRate'], ['heartRateInBeatsPerMinute'], ['hr']]),
      cadenceSpm: pickNumber(row, [['stepsPerMinute'], ['averageRunCadenceInStepsPerMinute'], ['cadence']]),
      elevationM: pickNumber(row, [['elevationInMeters'], ['altitudeInMeters'], ['elevation']]),
    })
  }

  return normalized.sort((a, b) => a.timestampSec - b.timestampSec)
}

function resolveSampleTimer(sample: GarminSamplePoint, baseTimestampSec: number): number {
  if (sample.timerSec != null && Number.isFinite(sample.timerSec)) return sample.timerSec
  return Math.max(0, sample.timestampSec - baseTimestampSec)
}

function computeElevationGainFromSamples(samples: GarminSamplePoint[]): number | null {
  if (samples.length < 2) return null
  let gain = 0
  let previous: number | null = null

  for (const sample of samples) {
    if (sample.elevationM == null) continue
    if (previous != null && sample.elevationM > previous) {
      gain += sample.elevationM - previous
    }
    previous = sample.elevationM
  }

  return gain > 0 ? Number(gain.toFixed(1)) : null
}

function summarizeSampleSegment(samples: GarminSamplePoint[], index: number): GarminLapLike | null {
  if (samples.length < 2) return null
  const firstSample = samples.at(0)
  const lastSample = samples.at(-1)
  if (!firstSample || !lastSample) return null

  const baseTimestamp = firstSample.timestampSec
  const firstWithDistance = samples.find((sample) => sample.distanceM != null) ?? firstSample
  const lastWithDistance = [...samples].reverse().find((sample) => sample.distanceM != null) ?? lastSample

  const startDistance = firstWithDistance.distanceM
  const endDistance = lastWithDistance.distanceM
  const distanceMeters =
    startDistance != null && endDistance != null && endDistance >= startDistance
      ? endDistance - startDistance
      : null
  const distanceKm = distanceMeters != null ? Number((distanceMeters / 1000).toFixed(2)) : null

  const startTimer = resolveSampleTimer(firstSample, baseTimestamp)
  const endTimer = resolveSampleTimer(lastSample, baseTimestamp)
  const durationSec = endTimer >= startTimer ? Math.round(endTimer - startTimer) : null

  const paceSecPerKm =
    durationSec != null && distanceKm != null && distanceKm > 0 ? Math.round(durationSec / distanceKm) : null

  const avgHr = average(samples.map((sample) => sample.heartRate))
  const avgCadence = average(samples.map((sample) => sample.cadenceSpm))
  const elevationGainM = computeElevationGainFromSamples(samples)

  return {
    index,
    distanceKm,
    durationSec,
    paceSecPerKm,
    avgHr: avgHr != null ? Math.round(avgHr) : null,
    avgCadence: avgCadence != null ? Number(avgCadence.toFixed(1)) : null,
    elevationGainM,
  }
}

function deriveSplitsFromSamples(samples: GarminSamplePoint[]): GarminLapLike[] {
  if (samples.length < 2) return []

  const withDistance = samples.filter((sample) => sample.distanceM != null)
  const lastWithDistance = withDistance.at(-1)
  const maxDistance = lastWithDistance?.distanceM ?? 0
  if (maxDistance < 1000) return []

  const boundaries: number[] = []
  for (let next = 1000; next <= maxDistance; next += 1000) {
    boundaries.push(next)
  }
  if (boundaries.length === 0) return []

  const firstSample = samples.at(0)
  if (!firstSample) return []
  const baseTimestamp = firstSample.timestampSec
  const splits: GarminLapLike[] = []
  let previousBoundary = 0
  let previousBoundaryTimer = 0

  for (const boundary of boundaries) {
    const boundarySample = withDistance.find((sample) => (sample.distanceM ?? -1) >= boundary)
    if (!boundarySample) continue

    const boundaryTimer = resolveSampleTimer(boundarySample, baseTimestamp)
    const segmentSamples = samples.filter((sample) => {
      const distance = sample.distanceM
      if (distance == null) return false
      return distance >= previousBoundary && distance <= boundary
    })
    const distanceKm = Number(((boundary - previousBoundary) / 1000).toFixed(2))
    const durationSec = Math.max(0, Math.round(boundaryTimer - previousBoundaryTimer))
    const avgHr = average(segmentSamples.map((sample) => sample.heartRate))
    const avgCadence = average(segmentSamples.map((sample) => sample.cadenceSpm))

    splits.push({
      index: splits.length + 1,
      distanceKm,
      durationSec,
      paceSecPerKm: distanceKm > 0 ? Math.round(durationSec / distanceKm) : null,
      avgHr: avgHr != null ? Math.round(avgHr) : null,
      avgCadence: avgCadence != null ? Number(avgCadence.toFixed(1)) : null,
      elevationGainM: computeElevationGainFromSamples(segmentSamples),
    })

    previousBoundary = boundary
    previousBoundaryTimer = boundaryTimer
  }

  return splits
}

function deriveLapsFromSamples(
  samples: GarminSamplePoint[],
  lapMarkers: Record<string, unknown>[]
): GarminLapLike[] {
  if (samples.length < 2 || lapMarkers.length === 0) return []
  const lastSample = samples.at(-1)
  if (!lastSample) return []
  const markers = lapMarkers
    .map((marker) => pickNumber(marker, [['startTimeInSeconds'], ['timestamp']]))
    .filter((value): value is number => value != null && Number.isFinite(value))
    .map((value) => Math.round(value))
    .sort((a, b) => a - b)

  if (markers.length === 0) return []

  const laps: GarminLapLike[] = []
  for (let index = 0; index < markers.length; index += 1) {
    const start = markers[index]
    if (start == null) continue
    const end = markers[index + 1] ?? lastSample.timestampSec + 1
    const segmentSamples = samples.filter((sample) => sample.timestampSec >= start && sample.timestampSec < end)
    const lap = summarizeSampleSegment(segmentSamples, laps.length + 1)
    if (lap) laps.push(lap)
  }

  return laps
}

function isEmptyLapLike(value: GarminLapLike): boolean {
  return (
    value.distanceKm == null &&
    value.durationSec == null &&
    value.paceSecPerKm == null &&
    value.avgHr == null &&
    value.avgCadence == null &&
    value.elevationGainM == null
  )
}

function extractActivityIdFromPayload(payload: Record<string, unknown>): string | null {
  const direct = getString(payload.activityId)
  if (direct) return direct
  const summary = asRecord(payload.summary)
  return getString(summary.activityId)
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const userId = parseUserId(searchParams.get('userId'))
  const activityId = searchParams.get('activityId')?.trim() ?? ''
  const date = searchParams.get('date')?.trim() ?? ''
  const expectedDistanceKm = parseFiniteNumber(searchParams.get('distanceKm'))
  const expectedDurationSec = parseFiniteNumber(searchParams.get('durationSec'))
  const completedAtIso = searchParams.get('completedAt')?.trim() ?? ''

  if (!userId) {
    return NextResponse.json({ error: 'Valid userId is required' }, { status: 400 })
  }

  if (!activityId && !date) {
    return NextResponse.json({ error: 'Either activityId or date is required' }, { status: 400 })
  }

  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const oauthState = await getGarminOAuthState(userId)
  if (!oauthState) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Older Garmin connections may not have auth_user_id backfilled yet.
  if (oauthState.authUserId && oauthState.authUserId !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const admin = createAdminClient()

  let query = admin
    .from('garmin_activities')
    .select(
      'activity_id,start_time,sport,duration_s,distance_m,avg_hr,max_hr,avg_pace,elevation_gain_m,elevation_loss_m,max_speed_mps,avg_cadence_spm,max_cadence_spm,calories,lap_summaries,split_summaries,interval_summaries,telemetry_json,raw_json,updated_at'
    )
    .eq('user_id', userId)
    .order('start_time', { ascending: false })
    .order('updated_at', { ascending: false })
    .limit(activityId ? 5 : 60)

  if (activityId) {
    query = query.eq('activity_id', activityId)
  } else if (date) {
    query = query.gte('start_time', `${date}T00:00:00.000Z`).lte('start_time', `${date}T23:59:59.999Z`)
  }

  const { data, error } = await query

  if (error) {
    console.error('[api/garmin/activity-telemetry] Query failed:', error)
    return NextResponse.json({ error: 'Failed to fetch Garmin telemetry' }, { status: 500 })
  }

  if (!data || data.length === 0) {
    return NextResponse.json({ telemetry: null })
  }

  const scored = data
    .map((entry) => asRecord(entry))
    .map((row) => {
      let score = 0
      const distanceMeters = getNumber(row.distance_m)
      const duration = getNumber(row.duration_s)
      const rowStart = getString(row.start_time)

      if (expectedDistanceKm != null && distanceMeters != null) {
        score += Math.abs(distanceMeters / 1000 - expectedDistanceKm) * 2
      }
      if (expectedDurationSec != null && duration != null) {
        score += Math.abs(duration - expectedDurationSec) / 120
      }
      if (completedAtIso && rowStart) {
        const completedTs = Date.parse(completedAtIso)
        const rowTs = Date.parse(rowStart)
        if (Number.isFinite(completedTs) && Number.isFinite(rowTs)) {
          score += Math.abs(completedTs - rowTs) / (1000 * 60 * 30)
        }
      }

      return { row, score }
    })
    .sort((a, b) => a.score - b.score)

  const row = scored[0]?.row
  if (!row) {
    return NextResponse.json({ telemetry: null })
  }

  const rawJson = asRecord(row.raw_json)
  const telemetryJson = asRecord(row.telemetry_json)
  let merged: Record<string, unknown> = { ...rawJson, ...telemetryJson }

  const mergedSamples = asRecordArray(merged.samples ?? merged.sampleSummaries)
  if (mergedSamples.length === 0 && oauthState.garminUserId) {
    try {
      const exportRows = await readGarminExportRows({
        garminUserId: oauthState.garminUserId,
        sinceIso: lookbackStartIso(56),
      })

      if (exportRows.ok && exportRows.rows.length > 0) {
        const requestedActivityId = activityId || getString(row.activity_id)
        const detailCandidates = exportRows.rows
          .filter((entry) => entry.datasetKey === 'activityDetails')
          .map((entry) => asRecord(entry.payload))
          .filter((payload) => Object.keys(payload).length > 0)

        const scoredDetails = detailCandidates
          .map((payload) => {
            const summary = asRecord(payload.summary)
            const candidateActivityId = extractActivityIdFromPayload(payload)
            const distanceMeters =
              pickNumber(summary, [['distanceInMeters'], ['distanceMeters']]) ??
              pickNumber(payload, [['distanceInMeters'], ['distanceMeters']])
            const durationSec =
              pickNumber(summary, [['durationInSeconds'], ['durationinseconds']]) ??
              pickNumber(payload, [['durationInSeconds'], ['durationinseconds']])
            const startSeconds =
              pickNumber(summary, [['startTimeInSeconds']]) ??
              pickNumber(payload, [['startTimeInSeconds']])
            const startIso =
              startSeconds != null
                ? new Date(startSeconds * 1000).toISOString()
                : getString(summary.startTimeGMT) ?? getString(payload.startTimeGMT)

            let score = 0
            if (requestedActivityId && candidateActivityId) {
              score += requestedActivityId === candidateActivityId ? -10_000 : 500
            }
            if (expectedDistanceKm != null && distanceMeters != null) {
              score += Math.abs(distanceMeters / 1000 - expectedDistanceKm) * 3
            }
            if (expectedDurationSec != null && durationSec != null) {
              score += Math.abs(durationSec - expectedDurationSec) / 90
            }
            if (completedAtIso && startIso) {
              const completedTs = Date.parse(completedAtIso)
              const startTs = Date.parse(startIso)
              if (Number.isFinite(completedTs) && Number.isFinite(startTs)) {
                score += Math.abs(completedTs - startTs) / (1000 * 60 * 20)
              }
            }

            return { payload, score }
          })
          .sort((a, b) => a.score - b.score)

        const bestDetail = scoredDetails[0]?.payload
        if (bestDetail) {
          const summary = asRecord(bestDetail.summary)
          merged = { ...merged, ...summary, ...bestDetail }
        }
      }
    } catch (detailError) {
      console.warn('[api/garmin/activity-telemetry] Failed to load activityDetails fallback:', detailError)
    }
  }

  const lapRows = asRecordArray(row.lap_summaries).length
    ? asRecordArray(row.lap_summaries)
    : asRecordArray(merged.lapSummaries ?? merged.laps)
  const splitRows = asRecordArray(row.split_summaries).length
    ? asRecordArray(row.split_summaries)
    : asRecordArray(merged.splitSummaries ?? merged.splits)
  const intervalRows = asRecordArray(row.interval_summaries).length
    ? asRecordArray(row.interval_summaries)
    : asRecordArray(merged.intervalSummaries ?? merged.intervals)

  const samplePoints = normalizeSamplePoints(asRecordArray(merged.samples ?? merged.sampleSummaries))
  const lapMarkers = asRecordArray(merged.laps)

  let laps = lapRows.map((entry, index) => normalizeLapLikeRow(entry, index))
  let splits = splitRows.map((entry, index) => normalizeLapLikeRow(entry, index))
  let intervals = intervalRows.map((entry, index) => normalizeLapLikeRow(entry, index))

  if ((laps.length === 0 || laps.every((entry) => isEmptyLapLike(entry))) && samplePoints.length > 1) {
    const derivedLaps = deriveLapsFromSamples(samplePoints, lapMarkers)
    if (derivedLaps.length > 0) laps = derivedLaps
  }

  if ((splits.length === 0 || splits.every((entry) => isEmptyLapLike(entry))) && samplePoints.length > 1) {
    const derivedSplits = deriveSplitsFromSamples(samplePoints)
    if (derivedSplits.length > 0) splits = derivedSplits
  }

  if (
    (intervals.length === 0 || intervals.every((entry) => isEmptyLapLike(entry))) &&
    laps.length >= 3 &&
    laps.length <= 20
  ) {
    intervals = laps
  }

  const paceSource = splits.length > 0 ? splits : laps
  const cadenceSource = splits.length > 0 ? splits : laps

  const paceValues = paceSource
    .map((entry) => entry.paceSecPerKm)
    .filter((value): value is number => value != null && Number.isFinite(value))
  const cadenceValues = cadenceSource
    .map((entry) => entry.avgCadence)
    .filter((value): value is number => value != null && Number.isFinite(value))

  const firstThirdCadence =
    cadenceValues.length >= 3 ? average(cadenceValues.slice(0, Math.ceil(cadenceValues.length / 3))) : null
  const lastThirdCadence =
    cadenceValues.length >= 3 ? average(cadenceValues.slice(-Math.ceil(cadenceValues.length / 3))) : null
  const cadenceDriftPct =
    firstThirdCadence != null && lastThirdCadence != null && firstThirdCadence > 0
      ? Number((((lastThirdCadence - firstThirdCadence) / firstThirdCadence) * 100).toFixed(1))
      : null

  const halfPace = splitHalfPace(paceSource)
  const intervalPaces = intervals
    .map((entry) => entry.paceSecPerKm)
    .filter((value): value is number => value != null && Number.isFinite(value))
  const intervalFastest = intervalPaces.length ? Math.min(...intervalPaces) : null
  const intervalSlowest = intervalPaces.length ? Math.max(...intervalPaces) : null
  const intervalStd = stdDev(intervalPaces)
  const intervalConsistencyPct =
    intervalPaces.length >= 2 && intervalStd != null
      ? Math.max(0, Math.min(100, Math.round(100 - (intervalStd / Math.max(1, average(intervalPaces) ?? 1)) * 100)))
      : null

  const sampleHrValues = toNumberArray(samplePoints.map((sample) => sample.heartRate))
  const sampleCadenceValues = toNumberArray(samplePoints.map((sample) => sample.cadenceSpm))
  const firstSamplePoint = samplePoints.at(0)
  const lastSamplePoint = samplePoints.at(-1)
  const sampleDistanceMeters = lastSamplePoint?.distanceM ?? null
  const sampleBaseTimestamp = firstSamplePoint?.timestampSec ?? 0
  const sampleDurationSec =
    firstSamplePoint && lastSamplePoint && samplePoints.length > 1
      ? Math.max(
          0,
          Math.round(
            resolveSampleTimer(lastSamplePoint, sampleBaseTimestamp) -
              resolveSampleTimer(firstSamplePoint, sampleBaseTimestamp)
          )
        )
      : null

  const mergedAveragePaceSec =
    getNumber(merged.averagePace) ??
    (() => {
      const minutesPerKm = pickNumber(merged, [['averagePaceInMinutesPerKilometer']])
      return minutesPerKm != null ? Math.round(minutesPerKm * 60) : null
    })()

  return NextResponse.json({
    telemetry: {
      activityId: getString(row.activity_id),
      startTime: getString(row.start_time),
      sport: getString(row.sport),
      distanceKm:
        getNumber(row.distance_m) != null
          ? Number((Number(getNumber(row.distance_m)) / 1000).toFixed(2))
          : sampleDistanceMeters != null
            ? Number((sampleDistanceMeters / 1000).toFixed(2))
            : null,
      durationSec:
        getNumber(row.duration_s) != null
          ? Math.round(Number(getNumber(row.duration_s)))
          : sampleDurationSec,
      avgHr:
        getNumber(row.avg_hr) ??
        getNumber(merged.averageHR) ??
        getNumber(merged.averageHeartRateInBeatsPerMinute) ??
        (sampleHrValues.length > 0 ? average(sampleHrValues) : null),
      maxHr:
        getNumber(row.max_hr) ??
        getNumber(merged.maxHR) ??
        getNumber(merged.maxHeartRateInBeatsPerMinute) ??
        (sampleHrValues.length > 0 ? Math.max(...sampleHrValues) : null),
      avgPaceSecPerKm: getNumber(row.avg_pace) ?? mergedAveragePaceSec,
      avgCadenceSpm:
        getNumber(row.avg_cadence_spm) ??
        getNumber(merged.averageCadence) ??
        getNumber(merged.averageRunCadenceInStepsPerMinute) ??
        (sampleCadenceValues.length > 0 ? average(sampleCadenceValues) : null),
      maxCadenceSpm:
        getNumber(row.max_cadence_spm) ??
        getNumber(merged.maxCadence) ??
        getNumber(merged.maxRunCadenceInStepsPerMinute) ??
        (sampleCadenceValues.length > 0 ? Math.max(...sampleCadenceValues) : null),
      elevationGainM:
        getNumber(row.elevation_gain_m) ??
        getNumber(merged.elevationGain) ??
        getNumber(merged.totalElevationGainInMeters) ??
        computeElevationGainFromSamples(samplePoints),
      elevationLossM:
        getNumber(row.elevation_loss_m) ??
        getNumber(merged.elevationLoss) ??
        getNumber(merged.totalElevationLossInMeters),
      maxSpeedMps: getNumber(row.max_speed_mps) ?? getNumber(merged.maxSpeedMps),
      calories: getNumber(row.calories) ?? getNumber(merged.calories),
      laps,
      splits,
      intervals,
      analytics: {
        pacing: {
          count: paceValues.length,
          variabilitySecPerKm: stdDev(paceValues),
          firstHalfPaceSecPerKm: halfPace.firstHalfSec,
          secondHalfPaceSecPerKm: halfPace.secondHalfSec,
          splitDeltaSecPerKm:
            halfPace.firstHalfSec != null && halfPace.secondHalfSec != null
              ? halfPace.secondHalfSec - halfPace.firstHalfSec
              : null,
        },
        cadence: {
          avgSpm: average(cadenceValues),
          maxSpm:
            cadenceValues.length > 0 ? Math.max(...cadenceValues) : getNumber(row.max_cadence_spm) ?? null,
          driftPct: cadenceDriftPct,
        },
        intervals: {
          count: intervals.length,
          fastestPaceSecPerKm: intervalFastest,
          slowestPaceSecPerKm: intervalSlowest,
          consistencyPct: intervalConsistencyPct,
        },
      },
    },
  })
}
