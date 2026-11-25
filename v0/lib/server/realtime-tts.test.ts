import { describe, expect, it } from "vitest"
import {
  pcm16ToWav,
  resolveTtsConfig,
  synthesizeWithRealtime,
  transcriptMatches,
  type WebSocketLike,
} from "./realtime-tts"

function fakeSocket(script: (send: (e: object) => void, sent: any[]) => void): { Impl: WebSocketLike; sent: any[]; urls: string[]; headers: any[] } {
  const sent: any[] = []
  const urls: string[] = []
  const headers: any[] = []
  class Fake {
    onmessage: ((e: { data: unknown }) => void) | null = null
    onerror: ((e: unknown) => void) | null = null
    onclose: ((e: unknown) => void) | null = null
    constructor(url: string, init?: { headers?: Record<string, string> }) {
      urls.push(url)
      headers.push(init?.headers)
      queueMicrotask(() => this.emit({ type: "session.created" }))
    }
    emit(e: object) {
      this.onmessage?.({ data: JSON.stringify(e) })
    }
    send(data: string) {
      const parsed = JSON.parse(data)
      sent.push(parsed)
      if (parsed.type === "response.create") script((e) => this.emit(e), sent)
    }
    close() {}
  }
  return { Impl: Fake as unknown as WebSocketLike, sent, urls, headers }
}

const pcmB64 = Buffer.from(new Uint8Array(4800)).toString("base64") // 0.1 s of silence

describe("resolveTtsConfig", () => {
  it("defaults to gpt-realtime-2.1-mini with the marin voice", () => {
    expect(resolveTtsConfig({})).toEqual({ model: "gpt-realtime-2.1-mini", voice: "marin", realtime: true })
  })
  it("OPENAI_TTS_MODEL=tts-1 rolls back to the Speech API with nova", () => {
    expect(resolveTtsConfig({ OPENAI_TTS_MODEL: "tts-1" })).toEqual({ model: "tts-1", voice: "nova", realtime: false })
    expect(resolveTtsConfig({ OPENAI_TTS_VOICE: "cedar" }).voice).toBe("cedar")
  })
})

describe("pcm16ToWav", () => {
  it("writes a 44-byte header describing 24 kHz mono PCM16", () => {
    const wav = new DataView(pcm16ToWav(new Uint8Array(48000)))
    const tag = (o: number) => String.fromCharCode(...[0, 1, 2, 3].map((i) => wav.getUint8(o + i)))
    expect(tag(0)).toBe("RIFF")
    expect(tag(8)).toBe("WAVE")
    expect(wav.getUint16(22, true)).toBe(1)
    expect(wav.getUint32(24, true)).toBe(24000)
    expect(wav.getUint16(34, true)).toBe(16)
    expect(wav.getUint32(40, true)).toBe(48000)
    expect(wav.byteLength).toBe(44 + 48000)
  })
})

describe("transcriptMatches", () => {
  it("ignores punctuation and case", () => {
    expect(transcriptMatches("Ease back: pace 6.2 vs 5.8.", "ease back pace 6.2 vs 5.8")).toBe(true)
  })
  it("rejects a dropped number or a changed safety cue", () => {
    expect(transcriptMatches("Heart rate 176. Ease off now.", "Heart rate high. Ease off now.")).toBe(false)
    expect(transcriptMatches("If it hurts, stop and consult a professional.", "Keep going, you are doing great.")).toBe(false)
  })
  it("rejects a single dropped or changed word in a safety cue", () => {
    expect(
      transcriptMatches(
        "If you feel pain stop running and consult a professional.",
        "If you feel pain running and consult a professional."
      )
    ).toBe(false)
    expect(transcriptMatches("Do not run through the pain.", "Do run through the pain.")).toBe(false)
  })
  it("handles Hebrew", () => {
    expect(transcriptMatches("אם כואב לך, תעצור עכשיו ותתייעץ עם איש מקצוע.", "אם כואב לך תעצור עכשיו ותתייעץ עם איש מקצוע")).toBe(true)
    expect(transcriptMatches("אם כואב לך, תעצור עכשיו.", "תמשיך לרוץ, אתה מעולה.")).toBe(false)
  })
})

describe("synthesizeWithRealtime", () => {
  it("sends session.update + an out-of-band response and returns WAV audio", async () => {
    const fake = fakeSocket((emit) => {
      emit({ type: "response.output_audio.delta", delta: pcmB64 })
      emit({ type: "response.output_audio.delta", delta: pcmB64 })
      emit({ type: "response.output_audio_transcript.done", transcript: "Settle in." })
      emit({ type: "response.done", response: { status: "completed", usage: { output_token_details: { audio_tokens: 40, text_tokens: 10 } } } })
    })
    const r = await synthesizeWithRealtime("Settle in.", { apiKey: "k", model: "gpt-realtime-2.1-mini", voice: "marin", speed: 0.95, WebSocketImpl: fake.Impl })
    expect(fake.urls[0]).toBe("wss://api.openai.com/v1/realtime?model=gpt-realtime-2.1-mini")
    expect(fake.headers[0]).toEqual({ Authorization: "Bearer k" })
    const update = fake.sent[0]
    expect(update.type).toBe("session.update")
    expect(update.session).toMatchObject({ type: "realtime", output_modalities: ["audio"], audio: { output: { format: { type: "audio/pcm", rate: 24000 }, voice: "marin", speed: 0.95 } } })
    expect(fake.sent[1]).toMatchObject({ type: "response.create", response: { conversation: "none", input: [{ content: [{ type: "input_text", text: "Settle in." }] }] } })
    expect(r.transcript).toBe("Settle in.")
    expect(r.wav.byteLength).toBe(44 + 9600)
    expect(r.audioSeconds).toBeCloseTo(0.2)
    expect(r.audioOutputTokens).toBe(40)
  })

  it("rejects on an error event, a failed response, or no audio", async () => {
    const err = fakeSocket((emit) => emit({ type: "error", error: { code: "model_not_found", message: "nope" } }))
    await expect(synthesizeWithRealtime("x", { apiKey: "k", model: "m", voice: "marin", WebSocketImpl: err.Impl })).rejects.toThrow("model_not_found")
    const failed = fakeSocket((emit) => emit({ type: "response.done", response: { status: "failed" } }))
    await expect(synthesizeWithRealtime("x", { apiKey: "k", model: "m", voice: "marin", WebSocketImpl: failed.Impl })).rejects.toThrow("response failed")
    const silent = fakeSocket((emit) => emit({ type: "response.done", response: { status: "completed" } }))
    await expect(synthesizeWithRealtime("x", { apiKey: "k", model: "m", voice: "marin", WebSocketImpl: silent.Impl })).rejects.toThrow("no audio")
  })

  it("times out", async () => {
    const hang = fakeSocket(() => {})
    await expect(synthesizeWithRealtime("x", { apiKey: "k", model: "m", voice: "marin", timeoutMs: 20, WebSocketImpl: hang.Impl })).rejects.toThrow("timeout")
  })
})
