/**
 * Text to speech for voice cues on the OpenAI Realtime API.
 *
 * Why: OpenAI shuts down tts-1, tts-1-hd and gpt-4o-mini-tts on 2027-01-06,
 * which are all the models of POST /v1/audio/speech. The listed replacement,
 * gpt-realtime-2.1-mini, only runs on the Realtime API (WebSocket). Checked on
 * developers.openai.com on 2026-11-25.
 *
 * Flow (GA event names): session.created -> session.update -> an out-of-band
 * response.create with the cue text -> response.output_audio.delta (base64
 * PCM16, 24 kHz, mono) ... -> response.done. The PCM is wrapped in a WAV
 * header, which AVAudioPlayer(data:) on iOS plays without an app change.
 *
 * The Realtime model is conversational, and the docs say instructions are not
 * guaranteed. So the spoken transcript is compared with the cue text, and a
 * cue that was not read as written is never returned: a safety cue ("stop and
 * consult a professional") must not come out changed.
 */

export const REALTIME_TTS_INSTRUCTIONS =
  "You are a text-to-speech voice for a running coach. Read the user's text aloud exactly as written, " +
  "word for word, in the language it is written in. Do not add, remove, translate or change any words. " +
  "Do not answer it or comment on it. Calm, encouraging coach tone."

const SAMPLE_RATE = 24_000

export interface RealtimeTtsOptions {
  apiKey: string
  model: string
  voice: string
  speed?: number
  timeoutMs?: number
  /** Injected in tests. Defaults to the global WebSocket (Node 22+, undici). */
  WebSocketImpl?: WebSocketLike
}

export interface RealtimeTtsResult {
  wav: ArrayBuffer
  transcript: string
  audioSeconds: number
  latencyMs: number
  audioOutputTokens: number | null
  textOutputTokens: number | null
}

type MessageHandler = (event: { data: unknown }) => void
interface SocketLike {
  onmessage: MessageHandler | null
  onerror: ((event: unknown) => void) | null
  onclose: ((event: unknown) => void) | null
  send(data: string): void
  close(): void
}
export type WebSocketLike = new (url: string, init?: { headers?: Record<string, string> }) => SocketLike

/** Wrap raw PCM16 mono samples in a 44-byte WAV header. */
export function pcm16ToWav(pcm: Uint8Array, sampleRate = SAMPLE_RATE): ArrayBuffer {
  const header = new ArrayBuffer(44)
  const view = new DataView(header)
  const write = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i += 1) view.setUint8(offset + i, text.charCodeAt(i))
  }
  write(0, "RIFF")
  view.setUint32(4, 36 + pcm.byteLength, true)
  write(8, "WAVE")
  write(12, "fmt ")
  view.setUint32(16, 16, true) // fmt chunk size
  view.setUint16(20, 1, true) // PCM
  view.setUint16(22, 1, true) // mono
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * 2, true) // byte rate
  view.setUint16(32, 2, true) // block align
  view.setUint16(34, 16, true) // bits per sample
  write(36, "data")
  view.setUint32(40, pcm.byteLength, true)
  const out = new Uint8Array(44 + pcm.byteLength)
  out.set(new Uint8Array(header), 0)
  out.set(pcm, 44)
  return out.buffer
}

function normalizeWords(text: string): string[] {
  return text
    .toLowerCase()
    .normalize("NFKC")
    .replace(/[֑-ׇ]/g, "") // Hebrew vowel points
    .replace(/[^\p{L}\p{N}\s.]/gu, " ")
    .replace(/(?<!\d)\.|\.(?!\d)/g, " ")
    .split(/\s+/)
    .filter(Boolean)
}

/**
 * True when the transcript says the same words as the cue, in order.
 * Punctuation and case are ignored. Every number in the cue must be spoken.
 */
export function transcriptMatches(cue: string, transcript: string, minRatio = 0.9): boolean {
  const a = normalizeWords(cue)
  const b = normalizeWords(transcript)
  if (a.length === 0 || b.length === 0) return false
  const numbersInCue = a.filter((w) => /\d/.test(w))
  if (numbersInCue.some((n) => !b.includes(n))) return false
  // Longest common subsequence of words, over the longer of the two.
  const dp: number[] = new Array(b.length + 1).fill(0)
  for (let i = 1; i <= a.length; i += 1) {
    let prev = 0
    for (let j = 1; j <= b.length; j += 1) {
      const tmp = dp[j]
      dp[j] = a[i - 1] === b[j - 1] ? prev + 1 : Math.max(dp[j], dp[j - 1])
      prev = tmp
    }
  }
  return dp[b.length] / Math.max(a.length, b.length) >= minRatio
}

function base64ToBytes(b64: string): Uint8Array {
  return new Uint8Array(Buffer.from(b64, "base64"))
}

export async function synthesizeWithRealtime(text: string, options: RealtimeTtsOptions): Promise<RealtimeTtsResult> {
  const Impl = options.WebSocketImpl ?? (globalThis as unknown as { WebSocket: WebSocketLike }).WebSocket
  if (!Impl) throw new Error("realtime_tts: WebSocket is not available in this runtime")
  const started = Date.now()

  return new Promise<RealtimeTtsResult>((resolve, reject) => {
    const chunks: Uint8Array[] = []
    let transcript = ""
    let settled = false
    const ws = new Impl(`wss://api.openai.com/v1/realtime?model=${encodeURIComponent(options.model)}`, {
      headers: { Authorization: `Bearer ${options.apiKey}` },
    })
    const finish = (err: Error | null, result?: RealtimeTtsResult) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      try {
        ws.close()
      } catch {
        // already closed
      }
      if (err) reject(err)
      else resolve(result as RealtimeTtsResult)
    }
    const timer = setTimeout(() => finish(new Error("realtime_tts: timeout")), options.timeoutMs ?? 15_000)

    ws.onerror = () => finish(new Error("realtime_tts: socket error"))
    ws.onclose = () => finish(new Error("realtime_tts: socket closed before the response finished"))
    ws.onmessage = (message) => {
      let event: Record<string, any>
      try {
        event = JSON.parse(String(message.data))
      } catch {
        return
      }
      switch (event.type) {
        case "session.created":
          ws.send(
            JSON.stringify({
              type: "session.update",
              session: {
                type: "realtime",
                output_modalities: ["audio"],
                audio: {
                  output: {
                    format: { type: "audio/pcm", rate: SAMPLE_RATE },
                    voice: options.voice,
                    ...(options.speed ? { speed: options.speed } : {}),
                  },
                },
                instructions: REALTIME_TTS_INSTRUCTIONS,
              },
            })
          )
          ws.send(
            JSON.stringify({
              type: "response.create",
              response: {
                conversation: "none",
                output_modalities: ["audio"],
                input: [{ type: "message", role: "user", content: [{ type: "input_text", text }] }],
              },
            })
          )
          break
        case "response.output_audio.delta":
          if (typeof event.delta === "string") chunks.push(base64ToBytes(event.delta))
          break
        case "response.output_audio_transcript.done":
          transcript = String(event.transcript ?? "")
          break
        case "error":
          finish(new Error(`realtime_tts: ${event.error?.code ?? "error"}: ${event.error?.message ?? ""}`.trim()))
          break
        case "response.done": {
          const status = event.response?.status
          if (status !== "completed") {
            finish(new Error(`realtime_tts: response ${status ?? "unknown"}`))
            break
          }
          const total = chunks.reduce((n, c) => n + c.byteLength, 0)
          if (total === 0) {
            finish(new Error("realtime_tts: no audio"))
            break
          }
          const pcm = new Uint8Array(total)
          let offset = 0
          for (const c of chunks) {
            pcm.set(c, offset)
            offset += c.byteLength
          }
          const details = event.response?.usage?.output_token_details ?? {}
          finish(null, {
            wav: pcm16ToWav(pcm),
            transcript,
            audioSeconds: total / 2 / SAMPLE_RATE,
            latencyMs: Date.now() - started,
            audioOutputTokens: typeof details.audio_tokens === "number" ? details.audio_tokens : null,
            textOutputTokens: typeof details.text_tokens === "number" ? details.text_tokens : null,
          })
          break
        }
        default:
          break
      }
    }
  })
}

export interface TtsConfig {
  model: string
  voice: string
  realtime: boolean
}

/**
 * OPENAI_TTS_MODEL picks the speech model (default gpt-realtime-2.1-mini).
 * Set it to tts-1 to roll back to the Speech API; that works only until
 * 2027-01-06. OPENAI_TTS_VOICE overrides the voice (Realtime has no "nova";
 * the docs recommend marin or cedar).
 */
export function resolveTtsConfig(env: Record<string, string | undefined> = process.env): TtsConfig {
  const model = env.OPENAI_TTS_MODEL?.trim() || "gpt-realtime-2.1-mini"
  const realtime = model.startsWith("gpt-realtime")
  const voice = env.OPENAI_TTS_VOICE?.trim() || (realtime ? "marin" : "nova")
  return { model, voice, realtime }
}

/** USD per 1M tokens for gpt-realtime-2.1-mini output (model page, 2026-11-25). */
const REALTIME_AUDIO_OUT_PER_MTOK = 20
const REALTIME_TEXT_OUT_PER_MTOK = 2.4
const REALTIME_TEXT_IN_PER_MTOK = 0.6

/** Rough cost of one Realtime cue; ~120 instruction + cue tokens in. */
export function estimateRealtimeCostUsd(result: Pick<RealtimeTtsResult, "audioOutputTokens" | "textOutputTokens" | "audioSeconds">): number {
  // ~20 audio tokens per second of speech when usage is missing (observed 2026-11-25).
  const audio = result.audioOutputTokens ?? Math.ceil(result.audioSeconds * 20)
  const text = result.textOutputTokens ?? 60
  return (audio * REALTIME_AUDIO_OUT_PER_MTOK + text * REALTIME_TEXT_OUT_PER_MTOK + 120 * REALTIME_TEXT_IN_PER_MTOK) / 1_000_000
}
