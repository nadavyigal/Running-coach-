export type ParsedActivityFromText = {
  distanceKm?: number
  durationSeconds?: number
  paceSecondsPerKm?: number
  calories?: number
  completedAtIso?: string
}

export const parseLocaleNumber = (value: unknown) => {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value !== "string") return undefined

  const cleaned = value.trim()
  if (!cleaned) return undefined

  const match = cleaned.match(/-?[\d.,]+/)
  if (!match) return undefined

  let numeric = match[0]
  const lastDot = numeric.lastIndexOf(".")
  const lastComma = numeric.lastIndexOf(",")

  if (lastDot !== -1 && lastComma !== -1) {
    const decimalSeparator = lastDot > lastComma ? "." : ","
    const thousandsSeparator = decimalSeparator === "." ? "," : "."
    numeric = numeric.split(thousandsSeparator).join("")
    if (decimalSeparator === ",") numeric = numeric.replace(",", ".")
  } else if (lastComma !== -1 && lastDot === -1) {
    numeric = numeric.replace(",", ".")
  }

  const parsed = Number.parseFloat(numeric)
  return Number.isFinite(parsed) ? parsed : undefined
}

export const parseDurationStringToSeconds = (duration: string) => {
  const trimmed = duration.trim()
  if (!trimmed) return undefined

  if (/^\d+$/.test(trimmed)) {
    const numeric = Number.parseInt(trimmed, 10)
    return Number.isFinite(numeric) ? numeric : undefined
  }

  const parts = trimmed.split(":").map((part) => Number.parseInt(part, 10))
  if (parts.some((part) => !Number.isFinite(part))) return undefined

  if (parts.length === 2) {
    const [minutes, seconds] = parts
    return minutes * 60 + seconds
  }

  if (parts.length === 3) {
    const [hours, minutes, seconds] = parts
    return hours * 3600 + minutes * 60 + seconds
  }

  return undefined
}

export const parsePaceToSecondsPerKm = (pace: unknown) => {
  if (typeof pace === "number" && Number.isFinite(pace)) {
    return pace <= 30 ? Math.round(pace * 60) : Math.round(pace)
  }

  if (typeof pace !== "string") return undefined

  const normalized = pace
    .trim()
    .replace(/min\/km|\/km|km\/min/gi, "")
    .replace(/[’']/g, ":")
    .replace(/[”"]/g, "")

  const mmSsMatch = normalized.match(/(\d{1,2})\s*:\s*(\d{1,2})/)
  if (mmSsMatch) {
    const minutes = Number.parseInt(mmSsMatch[1], 10)
    const seconds = Number.parseInt(mmSsMatch[2], 10)
    if (Number.isFinite(minutes) && Number.isFinite(seconds)) return minutes * 60 + seconds
  }

  const msMatch = normalized.match(/(\d{1,2})\s*m\s*(\d{1,2})\s*s/i)
  if (msMatch) {
    const minutes = Number.parseInt(msMatch[1], 10)
    const seconds = Number.parseInt(msMatch[2], 10)
    if (Number.isFinite(minutes) && Number.isFinite(seconds)) return minutes * 60 + seconds
  }

  const numericPace = parseLocaleNumber(normalized)
  if (typeof numericPace === "number") {
    return numericPace <= 30 ? Math.round(numericPace * 60) : Math.round(numericPace)
  }

  return undefined
}

const parseDistanceKmFromText = (text: string) => {
  const kmMatch = text.match(/(\d{1,3}(?:[.,]\d{1,3})?)\s*(?:km|kilometers?|kilometres?)\b/i)
  if (kmMatch) return parseLocaleNumber(kmMatch[1])

  const miMatch = text.match(/(\d{1,3}(?:[.,]\d{1,3})?)\s*(?:mi|miles?)\b/i)
  if (miMatch) {
    const miles = parseLocaleNumber(miMatch[1])
    return typeof miles === "number" ? miles * 1.60934 : undefined
  }

  return undefined
}

const parseDurationSecondsFromText = (text: string) => {
  const labelMatch = text.match(
    /\b(?:time|duration|elapsed|moving time|total time)\b[^0-9]{0,10}(\d{1,2}:\d{2}(?::\d{2})?)/i,
  )
  if (labelMatch) return parseDurationStringToSeconds(labelMatch[1])

  const anyTime = text.match(/\b(\d{1,2}:\d{2}(?::\d{2})?)\b/)
  if (anyTime) return parseDurationStringToSeconds(anyTime[1])

  return undefined
}

const parseCaloriesFromText = (text: string) => {
  const kcalMatch = text.match(/\b(\d{2,5})\s*(?:kcal|calories?)\b/i)
  if (!kcalMatch) return undefined
  const parsed = Number.parseInt(kcalMatch[1], 10)
  return Number.isFinite(parsed) ? parsed : undefined
}

const parsePaceSecondsFromText = (text: string) => {
  const paceMatch = text.match(
    /\b(?:pace|avg pace|average pace)\b[^0-9]{0,10}(\d{1,2}[:’']\d{2})/i,
  )
  if (paceMatch) return parsePaceToSecondsPerKm(paceMatch[1])

  const any = text.match(/\b(\d{1,2}[:’']\d{2})\s*(?:min\/km|\/km)\b/i)
  if (any) return parsePaceToSecondsPerKm(any[1])

  return undefined
}

export const parseActivityFromText = (text: string): ParsedActivityFromText => {
  const normalized = text.replace(/\r\n/g, "\n")
  return {
    distanceKm: parseDistanceKmFromText(normalized),
    durationSeconds: parseDurationSecondsFromText(normalized),
    paceSecondsPerKm: parsePaceSecondsFromText(normalized),
    calories: parseCaloriesFromText(normalized),
  }
}

