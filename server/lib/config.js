export const PORT = Number(process.env.PORT) || 3000;
export const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;
export const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
export const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o-realtime-preview";
export const OPENAI_REALTIME_VOICE = process.env.OPENAI_REALTIME_VOICE || "marin";
export const OPENAI_WS_URL = `wss://api.openai.com/v1/realtime?model=${OPENAI_MODEL}`;
export const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
export const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
export const MAX_CALL_DURATION_MS = 600_000;

export function warnOnMissingConfig() {
  if (!OPENAI_API_KEY) {
    console.warn("Warning: OPENAI_API_KEY is not set. Voice AI will not connect.");
  }
}
