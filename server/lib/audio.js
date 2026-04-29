import alawmulaw from "alawmulaw";
import waveResampler from "wave-resampler";

const { mulaw } = alawmulaw;
const { resample } = waveResampler;

const TWILIO_RATE = 8000;
export const OPENAI_RATE = 24000;

export function twilioToOpenAI(base64Mulaw) {
  const mulawBuffer = Buffer.from(base64Mulaw, "base64");
  const mulawArray = new Uint8Array(mulawBuffer);
  const pcm16_8k = mulaw.decode(mulawArray);
  const float32_8k = new Float32Array(pcm16_8k.length);
  for (let i = 0; i < pcm16_8k.length; i++) float32_8k[i] = pcm16_8k[i] / 32768;
  const float32_24k = resample(float32_8k, TWILIO_RATE, OPENAI_RATE);
  const pcm16_24k = new Int16Array(float32_24k.length);
  for (let i = 0; i < float32_24k.length; i++) {
    const s = Math.max(-1, Math.min(1, float32_24k[i]));
    pcm16_24k[i] = s < 0 ? s * 32768 : s * 32767;
  }
  return Buffer.from(pcm16_24k.buffer, pcm16_24k.byteOffset, pcm16_24k.byteLength).toString("base64");
}

export function openAIToTwilio(base64Pcm) {
  const pcmBuffer = Buffer.from(base64Pcm, "base64");
  const pcm16_24k = new Int16Array(
    pcmBuffer.buffer,
    pcmBuffer.byteOffset,
    pcmBuffer.length / 2
  );
  const float32_24k = new Float32Array(pcm16_24k.length);
  for (let i = 0; i < pcm16_24k.length; i++) float32_24k[i] = pcm16_24k[i] / 32768;
  const float32_8k = resample(float32_24k, OPENAI_RATE, TWILIO_RATE);
  const pcm16_8k = new Int16Array(float32_8k.length);
  for (let i = 0; i < float32_8k.length; i++) {
    const s = Math.max(-1, Math.min(1, float32_8k[i]));
    pcm16_8k[i] = s < 0 ? s * 32768 : s * 32767;
  }
  const mulawArray = mulaw.encode(pcm16_8k);
  return Buffer.from(mulawArray).toString("base64");
}
