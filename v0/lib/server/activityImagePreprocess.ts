export type ActivityImagePreprocessResult = {
  buffer: Buffer
  mimeType: "image/jpeg" | "image/png" | "image/webp"
  steps: string[]
  exifDateIso?: string
}

const toIsoIfDate = (value: unknown) => {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString()
  return undefined
}

export async function preprocessActivityImage(
  input: Buffer,
  inputMimeType: string,
): Promise<ActivityImagePreprocessResult> {
  const steps: string[] = []

  const allowed: ActivityImagePreprocessResult["mimeType"][] = ["image/jpeg", "image/png", "image/webp"]
  const isAllowedMimeType = (value: string): value is ActivityImagePreprocessResult["mimeType"] =>
    allowed.includes(value as ActivityImagePreprocessResult["mimeType"])

  const targetMimeType: ActivityImagePreprocessResult["mimeType"] = isAllowedMimeType(inputMimeType)
    ? inputMimeType
    : "image/jpeg"

  if (process.env.NODE_ENV === "test") {
    return { buffer: input, mimeType: targetMimeType, steps: ["skipped(test)"] }
  }

  const [{ default: sharp }, exifr] = await Promise.all([import("sharp"), import("exifr")])

  let exifDateIso: string | undefined
  try {
    // For photos (typically JPEG), this can provide a much better default completedAt than "now".
    const tags: any = await exifr.parse(input, {
      exif: true,
      tiff: true,
      ifd0: true,
      xmp: true,
    })

    exifDateIso =
      toIsoIfDate(tags?.DateTimeOriginal) ||
      toIsoIfDate(tags?.CreateDate) ||
      toIsoIfDate(tags?.ModifyDate) ||
      undefined
  } catch {
    // EXIF parsing is best-effort.
  }

  let pipeline = sharp(input, { failOnError: false })

  // Rotate based on EXIF orientation.
  pipeline = pipeline.rotate()
  steps.push("rotate(exif)")

  pipeline = pipeline.resize({ width: 1600, withoutEnlargement: true })
  steps.push("resize(1600w)")

  pipeline = pipeline.grayscale()
  steps.push("grayscale")

  pipeline = pipeline.normalize()
  steps.push("normalize")

  pipeline = pipeline.sharpen()
  steps.push("sharpen")

  let buffer: Buffer
  let mimeType: ActivityImagePreprocessResult["mimeType"] = targetMimeType

  if (targetMimeType === "image/png") {
    buffer = await pipeline.png({ compressionLevel: 9 }).toBuffer()
  } else if (targetMimeType === "image/webp") {
    buffer = await pipeline.webp({ quality: 85 }).toBuffer()
  } else {
    mimeType = "image/jpeg"
    buffer = await pipeline.jpeg({ quality: 85, mozjpeg: true }).toBuffer()
  }

  return {
    buffer,
    mimeType,
    steps,
    ...(typeof exifDateIso === "string" ? { exifDateIso } : {}),
  }
}
