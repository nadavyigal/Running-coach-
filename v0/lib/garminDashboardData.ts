"use client"

import type { HRVMeasurement, Run, SleepData } from "@/lib/db"
import { db } from "@/lib/db"
import { computeGarminAcwrMetrics, type GarminAcwrMetrics } from "@/lib/garminAcwr"
import {
  computeGarminReadiness,
  type GarminReadinessDay,
  type GarminReadinessResult,
} from "@/lib/garminReadinessComputer"
import { extractGarminBodyBatteryTimeseries } from "@/lib/garminBodyBattery"
import {
  extractGarminWellnessDays,
  type GarminDailyMetricsRow,
  type GarminWellnessDay,
} from "@/lib/garminWellnessExtractor"

interface AggregatedDailyRow extends GarminDailyMetricsRow {
  raw_json: Record<string, unknown[]>
}

export interface DailyValuePoint {
  date: string
  value: number | null
  source?: "direct" | "balance" | "none"
  fallbackBalance?: number | null
}

export interface GarminAcwrTimelinePoint {
  date: string
  acute: number
  chronic: number
  acwr: number | null
}

export interface GarminSleepStagePoint {
  date: string
  deep: number
  light: number
  rem: number
  awake: number
  score: number | null
}

export interface GarminStressPoint {
  date: string
  stress: number | null
  activeMinutes: number | null
}

export interface GarminDashboardData {
  endDateIso: string
  lastSyncAt: Date | null
  timeline: GarminDashboardDay[]
  readiness: GarminReadinessResult
  readinessDays: GarminReadinessDay[]
  confidenceBadge: string
  acwr: GarminAcwrMetrics
  acwrTimeline: GarminAcwrTimelinePoint[]
  hrvTrend7d: DailyValuePoint[]
  hrvBaseline28: number | null
  bodyBatteryToday: number | null
  bodyBatteryTodaySource: "direct" | "balance" | "none"
  bodyBatteryTodayBalance: number | null
  bodyBattery7d: DailyValuePoint[]
  sleepStages7d: GarminSleepStagePoint[]
  sleepScoreTrend7d: DailyValuePoint[]
  spo2LastNight: number | null
  spo2Trend7d: DailyValuePoint[]
  stressActive7d: GarminStressPoint[]
}

interface MergedDay {
  date: string
  bodyBattery: number | null
  bodyBatterySource: "direct" | "balance" | "none"
  bodyBatteryBalance: number | null
  spo2: number | null
  hrv: number | null
  sleepScore: number | null
  restingHr: number | null
  stress: number | null
  activeMinutes: number | null
  deepSleep: number | null
  lightSleep: number | null
  remSleep: number | null
  awakeSleep: number | null
}

export type GarminDashboardDay = MergedDay

function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {}
}

function parseJsonRecord(payload: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(payload)
    return asRecord(parsed)
  } catch {
    return null
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function mean(values: number[]): number {
  if (values.length === 0) return 0
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function round(value: number, precision = 2): number {
  const factor = 10 ** precision
  return Math.round(value * factor) / factor
}

function toDateKey(value: Date | string | number): string {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return new Date().toISOString().slice(0, 10)
  }
  return parsed.toISOString().slice(0, 10)
}

function shiftIsoDate(dateIso: string, deltaDays: number): string {
  const base = Date.parse(`${dateIso}T00:00:00.000Z`)
  const dayMs = 24 * 60 * 60 * 1000
  return new Date(base + deltaDays * dayMs).toISOString().slice(0, 10)
}

function buildDateRange(endDateIso: string, days: number): string[] {
  return Array.from({ length: days }, (_, index) => shiftIsoDate(endDateIso, -(days - 1 - index)))
}

function pickFirstNumber(record: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    const value = toNumber(record[key])
    if (value != null) return value
  }
  return null
}

function aggregateSummaryRows(records: Array<{ datasetKey: string; recordedAt: Date; payload: string }>): AggregatedDailyRow[] {
  const byDate = new Map<string, AggregatedDailyRow>()

  for (const record of records) {
    const parsedPayload = parseJsonRecord(record.payload)
    if (!parsedPayload) continue

    const dateKey = toDateKey(record.recordedAt)
    const current = byDate.get(dateKey) ?? {
      date: dateKey,
      body_battery: null,
      hrv: null,
      sleep_score: null,
      resting_hr: null,
      stress: null,
      raw_json: {},
    }

    const list = current.raw_json[record.datasetKey] ?? []
    list.push(parsedPayload)
    current.raw_json[record.datasetKey] = list
    byDate.set(dateKey, current)
  }

  return Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date))
}

function buildHrvMap(hrvMeasurements: HRVMeasurement[]): Map<string, number> {
  const hrvBuckets = new Map<string, number[]>()
  for (const entry of hrvMeasurements) {
    const key = toDateKey(entry.measurementDate)
    const values = hrvBuckets.get(key) ?? []
    values.push(entry.hrvValue)
    hrvBuckets.set(key, values)
  }

  const hrvMap = new Map<string, number>()
  for (const [key, values] of hrvBuckets) {
    hrvMap.set(key, round(mean(values), 2))
  }
  return hrvMap
}

function buildSleepMap(sleepData: SleepData[]): Map<string, SleepData> {
  const sleepMap = new Map<string, SleepData>()
  for (const sleep of sleepData) {
    const key = toDateKey(sleep.sleepDate ?? sleep.date ?? sleep.createdAt)
    const current = sleepMap.get(key)
    const currentScore = current?.sleepScore ?? -1
    const nextScore = sleep.sleepScore ?? -1
    if (!current || nextScore >= currentScore) {
      sleepMap.set(key, sleep)
    }
  }
  return sleepMap
}

function extractActiveMinutesFromSummaries(records: Array<{ datasetKey: string; recordedAt: Date; payload: string }>): Map<string, number> {
  const activeMap = new Map<string, number>()

  for (const record of records) {
    const payload = parseJsonRecord(record.payload)
    if (!payload) continue

    const dateKey = toDateKey(record.recordedAt)
    let totalMinutes = 0

    if (record.datasetKey === "dailies") {
      const moderateSeconds = pickFirstNumber(payload, ["moderateIntensityDurationInSeconds"])
      const vigorousSeconds = pickFirstNumber(payload, ["vigorousIntensityDurationInSeconds"])
      const seconds = (moderateSeconds ?? 0) + (vigorousSeconds ?? 0)
      if (seconds > 0) totalMinutes += seconds / 60
    }

    if (record.datasetKey === "epochs") {
      const activeSeconds = pickFirstNumber(payload, ["activeTimeInSeconds", "activityTimeInSeconds"])
      const moderateSeconds = pickFirstNumber(payload, ["moderateIntensityDurationInSeconds"])
      const vigorousSeconds = pickFirstNumber(payload, ["vigorousIntensityDurationInSeconds"])
      const seconds = activeSeconds ?? ((moderateSeconds ?? 0) + (vigorousSeconds ?? 0))
      if (seconds > 0) totalMinutes += seconds / 60
    }

    if (totalMinutes > 0) {
      const current = activeMap.get(dateKey) ?? 0
      activeMap.set(dateKey, current + totalMinutes)
    }
  }

  return activeMap
}

function extractRunActiveMinutes(runs: Run[]): Map<string, number> {
  const runMap = new Map<string, number>()
  for (const run of runs) {
    if (!run.duration || run.duration <= 0) continue
    const key = toDateKey(run.completedAt)
    const current = runMap.get(key) ?? 0
    runMap.set(key, current + run.duration / 60)
  }
  return runMap
}

function buildMergedDays(params: {
  wellnessDays: GarminWellnessDay[]
  sleepMap: Map<string, SleepData>
  hrvMap: Map<string, number>
  summaryActiveMap: Map<string, number>
  runActiveMap: Map<string, number>
}): Map<string, MergedDay> {
  const { wellnessDays, sleepMap, hrvMap, summaryActiveMap, runActiveMap } = params
  const merged = new Map<string, MergedDay>()

  const createEmptyDay = (date: string): MergedDay => ({
    date,
    bodyBattery: null,
    bodyBatterySource: "none",
    bodyBatteryBalance: null,
    spo2: null,
    hrv: null,
    sleepScore: null,
    restingHr: null,
    stress: null,
    activeMinutes: null,
    deepSleep: null,
    lightSleep: null,
    remSleep: null,
    awakeSleep: null,
  })

  for (const day of wellnessDays) {
    merged.set(day.date, {
      ...createEmptyDay(day.date),
      bodyBattery: day.bodyBattery,
      bodyBatterySource: day.bodyBatterySource,
      bodyBatteryBalance: day.bodyBatteryBalance,
      spo2: day.spo2,
      hrv: day.hrv,
      sleepScore: day.sleepScore,
      restingHr: day.restingHr,
      stress: day.stress,
    })
  }

  for (const [date, sleep] of sleepMap) {
    const existing = merged.get(date) ?? createEmptyDay(date)

    const deep = sleep.deepSleepTime ?? null
    const light = sleep.lightSleepTime ?? null
    const rem = sleep.remSleepTime ?? null
    let awake = sleep.awakeDuration ?? null

    if (awake == null && sleep.totalSleepTime > 0 && deep != null && light != null && rem != null) {
      const remainder = sleep.totalSleepTime - deep - light - rem
      awake = remainder > 0 ? remainder : 0
    }

    merged.set(date, {
      ...existing,
      sleepScore: sleep.sleepScore ?? existing.sleepScore,
      deepSleep: deep,
      lightSleep: light,
      remSleep: rem,
      awakeSleep: awake,
    })
  }

  for (const [date, hrv] of hrvMap) {
    const existing = merged.get(date) ?? createEmptyDay(date)

    merged.set(date, {
      ...existing,
      hrv,
    })
  }

  const allDates = new Set([...summaryActiveMap.keys(), ...runActiveMap.keys()])
  for (const date of allDates) {
    const existing = merged.get(date) ?? createEmptyDay(date)

    const summaryValue = summaryActiveMap.get(date)
    const runValue = runActiveMap.get(date)
    const chosen = summaryValue != null && summaryValue > 0 ? summaryValue : runValue ?? null

    merged.set(date, {
      ...existing,
      activeMinutes: chosen != null ? Math.round(chosen) : null,
    })
  }

  return merged
}

function findLatestDateIso(candidates: string[]): string {
  const valid = candidates.filter((value) => /^\d{4}-\d{2}-\d{2}$/.test(value))
  if (valid.length === 0) return new Date().toISOString().slice(0, 10)
  return valid.sort().at(-1) ?? new Date().toISOString().slice(0, 10)
}

function roundOrNull(value: number | null, precision = 2): number | null {
  if (value == null) return null
  return round(value, precision)
}

function buildConfidenceBadge(readinessDays: GarminReadinessDay[], confidence: GarminReadinessResult["confidence"]): string {
  const missingHrv = readinessDays.filter((day) => day.hrv == null).length
  const missingSleep = readinessDays.filter((day) => day.sleepScore == null).length
  const missingRhr = readinessDays.filter((day) => day.restingHr == null).length
  const missingStress = readinessDays.filter((day) => day.stress == null).length

  const missingParts: string[] = []
  if (missingHrv > 0) missingParts.push(`HRV for ${missingHrv} days`)
  if (missingSleep > 0) missingParts.push(`sleep for ${missingSleep} days`)
  if (missingRhr > 0) missingParts.push(`resting HR for ${missingRhr} days`)
  if (missingStress > 0) missingParts.push(`stress for ${missingStress} days`)

  if (missingParts.length === 0) {
    return `Confidence: ${confidence}`
  }

  return `Low confidence: missing ${missingParts.slice(0, 2).join(" and ")}`
}

function buildAcwrTimeline(acwr: GarminAcwrMetrics, dates28: string[]): GarminAcwrTimelinePoint[] {
  const timeline: GarminAcwrTimelinePoint[] = []

  for (let index = 0; index < dates28.length; index += 1) {
    const acuteWindow = acwr.dailyLoads28d.slice(Math.max(0, index - 6), index + 1)
    const chronicWindow = acwr.dailyLoads28d.slice(Math.max(0, index - 27), index + 1)
    const acute = round(mean(acuteWindow), 2)
    const chronic = round(mean(chronicWindow), 2)
    const value = chronic > 0 ? round(acute / chronic, 3) : null

    timeline.push({
      date: dates28[index] ?? shiftIsoDate(dates28[0] ?? new Date().toISOString().slice(0, 10), index),
      acute,
      chronic,
      acwr: value,
    })
  }

  return timeline
}

export async function loadGarminDashboardData(userId: number): Promise<GarminDashboardData> {
  const now = new Date()
  const startDate = new Date(now)
  startDate.setDate(startDate.getDate() - 120)

  const [summaryRecords, sleepData, hrvMeasurements, runs, device] = await Promise.all([
    db.garminSummaryRecords
      .where("userId")
      .equals(userId)
      .and((record) => record.recordedAt >= startDate)
      .toArray(),
    db.sleepData
      .where("userId")
      .equals(userId)
      .and((sleep) => (sleep.sleepDate ?? sleep.date ?? sleep.createdAt) >= startDate)
      .toArray(),
    db.hrvMeasurements
      .where("userId")
      .equals(userId)
      .and((hrv) => hrv.measurementDate >= startDate)
      .toArray(),
    db.runs
      .where("userId")
      .equals(userId)
      .and((run) => run.completedAt >= startDate)
      .toArray(),
    db.wearableDevices
      .where("[userId+type]")
      .equals([userId, "garmin"] as [number, string])
      .first(),
  ])

  const rows = aggregateSummaryRows(summaryRecords)
  const wellnessDays = extractGarminWellnessDays(rows)
  const bodyBatterySamples = extractGarminBodyBatteryTimeseries(rows)

  const sleepMap = buildSleepMap(sleepData)
  const hrvMap = buildHrvMap(hrvMeasurements)
  const summaryActiveMap = extractActiveMinutesFromSummaries(summaryRecords)
  const runActiveMap = extractRunActiveMinutes(runs)
  const mergedDays = buildMergedDays({
    wellnessDays,
    sleepMap,
    hrvMap,
    summaryActiveMap,
    runActiveMap,
  })

  const sampleDates = [
    ...Array.from(mergedDays.keys()),
    ...runs.map((run) => toDateKey(run.completedAt)),
    ...bodyBatterySamples.map((sample) => sample.timestamp.slice(0, 10)),
  ]
  const endDateIso = findLatestDateIso(sampleDates)
  const dates7 = buildDateRange(endDateIso, 7)
  const dates28 = buildDateRange(endDateIso, 28)

  const bodyBatteryByDay = new Map<string, { timestamp: string; value: number }>()
  for (const sample of bodyBatterySamples) {
    const key = sample.timestamp.slice(0, 10)
    const current = bodyBatteryByDay.get(key)
    if (!current || sample.timestamp > current.timestamp) {
      bodyBatteryByDay.set(key, { timestamp: sample.timestamp, value: sample.value })
    }
  }

  const bodyBattery7d = dates7.map((date) => {
    const mergedDay = mergedDays.get(date)
    const sampleValue = bodyBatteryByDay.get(date)?.value
    const fallbackValue = mergedDay?.bodyBattery ?? null
    const hasDirectValue = sampleValue != null || fallbackValue != null
    const source = hasDirectValue ? "direct" : (mergedDay?.bodyBatterySource ?? "none")
    return {
      date,
      value: sampleValue ?? fallbackValue,
      source,
      fallbackBalance: mergedDay?.bodyBatteryBalance ?? null,
    }
  })

  const bodyBatteryToday = bodyBattery7d.at(-1)?.value ?? null
  const bodyBatteryTodaySource = bodyBattery7d.at(-1)?.source ?? "none"
  const bodyBatteryTodayBalance = bodyBattery7d.at(-1)?.fallbackBalance ?? null

  const sleepStages7d: GarminSleepStagePoint[] = dates7.map((date) => {
    const day = mergedDays.get(date)
    return {
      date,
      deep: day?.deepSleep ?? 0,
      light: day?.lightSleep ?? 0,
      rem: day?.remSleep ?? 0,
      awake: day?.awakeSleep ?? 0,
      score: day?.sleepScore ?? null,
    }
  })

  const sleepScoreTrend7d: DailyValuePoint[] = dates7.map((date) => ({
    date,
    value: mergedDays.get(date)?.sleepScore ?? null,
  }))

  const hrvTrend7d: DailyValuePoint[] = dates7.map((date) => ({
    date,
    value: mergedDays.get(date)?.hrv ?? null,
  }))

  const hrvBaselineValues = dates28
    .map((date) => mergedDays.get(date)?.hrv)
    .filter((value): value is number => value != null)
  const hrvBaseline28 = hrvBaselineValues.length > 0 ? round(mean(hrvBaselineValues), 2) : null

  const spo2Trend7d: DailyValuePoint[] = dates7.map((date) => ({
    date,
    value: mergedDays.get(date)?.spo2 ?? null,
  }))
  const spo2LastNight = spo2Trend7d.at(-1)?.value ?? null

  const stressActive7d: GarminStressPoint[] = dates7.map((date) => {
    const day = mergedDays.get(date)
    return {
      date,
      stress: day?.stress ?? null,
      activeMinutes: day?.activeMinutes ?? null,
    }
  })

  const readinessDays: GarminReadinessDay[] = dates28.map((date) => {
    const day = mergedDays.get(date)
    return {
      date,
      hrv: day?.hrv ?? null,
      sleepScore: day?.sleepScore ?? null,
      restingHr: day?.restingHr ?? null,
      stress: day?.stress ?? null,
    }
  })

  const readiness = computeGarminReadiness({
    days: readinessDays,
    endDate: endDateIso,
  })

  const acwr = computeGarminAcwrMetrics({
    activities: runs.map((run) => ({
      startTime: run.completedAt,
      durationSeconds: run.duration,
      averageHeartRate: run.heartRate ?? null,
      distanceMeters: run.distance ? run.distance * 1000 : null,
    })),
    endDate: endDateIso,
  })

  const acwrTimeline = buildAcwrTimeline(acwr, dates28)
  const timeline = Array.from(mergedDays.values()).sort((a, b) => a.date.localeCompare(b.date))

  return {
    endDateIso,
    lastSyncAt: device?.lastSync ?? null,
    timeline,
    readiness,
    readinessDays,
    confidenceBadge: buildConfidenceBadge(readinessDays, readiness.confidence),
    acwr,
    acwrTimeline,
    hrvTrend7d: hrvTrend7d.map((point) => ({ ...point, value: roundOrNull(point.value, 2) })),
    hrvBaseline28,
    bodyBatteryToday,
    bodyBatteryTodaySource,
    bodyBatteryTodayBalance,
    bodyBattery7d,
    sleepStages7d,
    sleepScoreTrend7d,
    spo2LastNight,
    spo2Trend7d,
    stressActive7d,
  }
}

export function getReadinessTone(score: number): {
  label: string
  chip: string
  accent: string
  panel: string
} {
  if (score >= 80) {
    return {
      label: "Ready to train",
      chip: "bg-emerald-100 text-emerald-800 border-emerald-200",
      accent: "text-emerald-700",
      panel: "border-emerald-200 bg-emerald-50/60",
    }
  }

  if (score >= 60) {
    return {
      label: "Train with caution",
      chip: "bg-amber-100 text-amber-800 border-amber-200",
      accent: "text-amber-700",
      panel: "border-amber-200 bg-amber-50/60",
    }
  }

  return {
    label: "Prioritize recovery",
    chip: "bg-rose-100 text-rose-800 border-rose-200",
    accent: "text-rose-700",
    panel: "border-rose-200 bg-rose-50/60",
  }
}

export function formatShortDate(isoDate: string): string {
  const parsed = new Date(`${isoDate}T00:00:00.000Z`)
  if (Number.isNaN(parsed.getTime())) return isoDate
  return parsed.toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

export function formatRelativeTime(date: Date | null): string {
  if (!date) return "never"
  const diffMs = Date.now() - new Date(date).getTime()
  const diffMinutes = Math.max(0, Math.floor(diffMs / 60000))

  if (diffMinutes < 1) return "just now"
  if (diffMinutes < 60) return `${diffMinutes}m ago`

  const diffHours = Math.floor(diffMinutes / 60)
  if (diffHours < 24) return `${diffHours}h ago`

  const diffDays = Math.floor(diffHours / 24)
  return `${diffDays}d ago`
}

export function getDataCoverageLabel(days: GarminReadinessDay[], windowDays = 28): string {
  const withSignals = days.filter(
    (day) => day.hrv != null || day.sleepScore != null || day.restingHr != null || day.stress != null
  ).length
  return `based on ${withSignals}/${windowDays} days of data`
}

export function buildReadinessWhyLine(input: {
  sleepScore: number | null
  todayHrv: number | null
  baselineHrv: number | null
  restingHr: number | null
  restingHrBaseline: number | null
}): string {
  const sleepText = input.sleepScore != null ? `Sleep ${Math.round(input.sleepScore)}` : "Sleep n/a"

  let hrvText = "HRV n/a"
  if (input.todayHrv != null && input.baselineHrv != null && input.baselineHrv > 0) {
    const delta = round(((input.todayHrv - input.baselineHrv) / input.baselineHrv) * 100, 0)
    hrvText = delta >= 0 ? `HRV +${delta}%` : `HRV ${delta}%`
  }

  let rhrText = "RHR n/a"
  if (input.restingHr != null && input.restingHrBaseline != null) {
    const delta = Math.round(input.restingHr - input.restingHrBaseline)
    if (delta < 0) {
      rhrText = `RHR ${Math.abs(delta)} bpm lower`
    } else if (delta > 0) {
      rhrText = `RHR +${delta} bpm`
    } else {
      rhrText = "RHR steady"
    }
  }

  return `${sleepText} · ${hrvText} · ${rhrText}`
}

export function getLatestValue(points: DailyValuePoint[]): number | null {
  return points.at(-1)?.value ?? null
}

export function getAverageValue(points: DailyValuePoint[]): number | null {
  const values = points.map((point) => point.value).filter((value): value is number => value != null)
  if (values.length === 0) return null
  return round(mean(values), 2)
}

export function getRestingHrBaseline(readinessDays: GarminReadinessDay[]): number | null {
  const values = readinessDays.map((day) => day.restingHr).filter((value): value is number => value != null)
  if (values.length === 0) return null
  return round(mean(values), 2)
}

export function clampScore(value: number | null): number {
  if (value == null) return 0
  return clamp(Math.round(value), 0, 100)
}
