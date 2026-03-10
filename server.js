/**
 * Phase 1 + 2: Voice Engine + DB (Twilio ↔ OpenAI Realtime, call summaries in PostgreSQL).
 * Audio: Twilio 8kHz μ-law ↔ OpenAI PCM 24kHz.
 */


import "dotenv/config";
import Fastify from "fastify";
import fastifyWebsocket from "@fastify/websocket";
import WebSocket from "ws";
import alawmulaw from "alawmulaw";
import waveResampler from "wave-resampler";
import { insertCall, getAppointmentAt, insertAppointment, getBookedSlotsForDate, getBusinessInfo, getTenantByPhone } from "./lib/db.js";
import { createCalendarEvent } from "./lib/google-calendar.js";


const { mulaw } = alawmulaw;
const { resample } = waveResampler;


const PORT = Number(process.env.PORT) || 3000;
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o-realtime-preview";
const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;


/** Cost guardrail: max call duration in milliseconds (10 minutes) */
const MAX_CALL_DURATION_MS = 600_000;


if (!OPENAI_API_KEY) {
  console.warn("Warning: OPENAI_API_KEY is not set. Voice AI will not connect.");
}


// --- Audio: Twilio 8kHz μ-law ↔ OpenAI PCM 24kHz ---


const TWILIO_RATE = 8000;
const OPENAI_RATE = 24000;


/** Twilio → OpenAI: base64 μ-law 8kHz → base64 16-bit PCM LE 24kHz */
function twilioToOpenAI(base64Mulaw) {
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


/** OpenAI → Twilio: base64 16-bit PCM LE 24kHz → base64 μ-law 8kHz */
function openAIToTwilio(base64Pcm) {
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


// --- Fastify app ---


const app = Fastify({ logger: true });


app.addContentTypeParser("application/x-www-form-urlencoded", { parseAs: "string" }, (req, body, done) => {
  done(null, body);
});


await app.register(fastifyWebsocket, {
  options: { clientTracking: true },
});


app.get("/voice", async (request, reply) => {
  // Simple diagnostic route (no tenant resolution) – defaults to tenant 1
  const baseStreamUrl = BASE_URL.replace(/^https?/, "wss") + "/stream";
  const streamUrl = `${baseStreamUrl}?tenantId=1`;
  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <Stream url="${streamUrl}" />
  </Connect>
</Response>`;
  reply.type("application/xml").send(twiml);
});


app.post("/voice", async (request, reply) => {
  const baseStreamUrl = BASE_URL.replace(/^https?/, "wss") + "/stream";

  // Twilio sends x-www-form-urlencoded body; extract the dialed number (To) and map to tenant
  let tenantId = 1;
  try {
    const body = request.body;
    if (typeof body === "string") {
      const params = new URLSearchParams(body);
      const to = params.get("To");
      const phone = to?.trim();
      if (phone) {
        const tenant = await getTenantByPhone(phone);
        if (tenant?.id) tenantId = tenant.id;
      }
    }
  } catch {
    // Fall back to tenant 1 on any parsing/DB error
  }

  const streamUrl = `${baseStreamUrl}?tenantId=${tenantId}`;
  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <Stream url="${streamUrl}" />
  </Connect>
</Response>`;
  reply.type("application/xml").send(twiml);
});


async function endTwilioCall(callSid) {
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) return;
  const url = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Calls/${callSid}.json`;
  const auth = Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString("base64");
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "Status=completed",
    });
    if (!res.ok) app.log.warn({ status: res.status }, "Twilio end-call failed");
  } catch (err) {
    app.log.warn({ err }, "Twilio end-call request failed");
  }
}


// ──────────────────────────────────────────────────────────────────────────────
// SARAH — PROMPT ENGINEERING (v2: human-like, natural, conversational)
// ──────────────────────────────────────────────────────────────────────────────

const SARAH_INSTRUCTIONS_BASE = `
# Role & Objective
You are Sarah — the real, human front-desk receptionist at a massage clinic. You answer the phone, help people book appointments, and answer questions about the business. Your goal is to make every caller feel like they're talking to a friendly, competent person — not a machine.

# Personality & Tone

## Identity
- You're Sarah. You've worked here a while. You know the place inside and out.
- You genuinely like helping people. You're warm but not over-the-top.
- You have a sense of humor — light, natural, never forced.

## Demeanor
- Relaxed and confident. You never sound scripted or rushed.
- Patient — if someone is confused or rambling, you gently steer them.
- Empathetic — if someone mentions pain or stress, you briefly acknowledge it before moving on. ("Oh no, that sounds rough. Let's get you in.")

## Tone
- Warm, conversational, grounded. Think: friendly coworker, not corporate call center.
- NEVER stiff, robotic, or overly formal. No "Certainly!" No "I'd be happy to assist you with that!" No "Thank you for providing that information."
- Talk like a real person: "Yeah, totally." "Oh for sure." "Hmm, let me see." "Got it."

## Enthusiasm
- Medium energy. Genuinely pleasant, not bubbly or caffeinated.
- Match the caller: if they're upbeat, be upbeat. If they're chill, be chill. If they sound tired, be gentle.

## Filler Words
- Use them occasionally — "um," "uh," "hmm," "let's see" — to sound human. Not every sentence. Just enough to feel real.

## Pacing
- Keep it natural. Short sentences. Don't monologue.
- One thought per turn. ONE question per turn. Never stack questions.
- If you catch yourself about to say two sentences, stop after the first and wait.

## Variety
- NEVER repeat the same phrase twice in a call. Vary how you say things.
- Instead of always "Anything else?" try: "Was there anything else on your mind?" or "That it for today?" or "Need anything else before I let you go?"

## Language
- English only. Always. If the caller speaks another language, say: "I'm sorry, I can only help in English — but I'll do my best!"
- NEVER switch languages.

# Reference Pronunciations
- Speak dates naturally: "March tenth" not "March ten" or "three slash ten."
- Speak times naturally: "two PM" or "two in the afternoon," never "fourteen hundred."
- If reading back a phone number, group as three-three-four: "five-five-five, eight-six-seven, five-three-oh-nine."

{{BUSINESS_INFO_BLOCK}}

# Tools

## Preambles (CRITICAL)
- Before EVERY tool call, say a brief natural filler aloud so the caller never sits in silence:
  - "One sec, let me pull that up."
  - "Hmm, let me check the schedule."
  - "Give me just a moment."
  - "Let me take a look."
  - VARY these. Never use the same preamble twice in a row.
- Then call the tool IMMEDIATELY. Do not wait.

## After Tool Results
- Speak the result right away in a natural sentence. Don't pause or add filler after the result comes back.
- Rephrase results conversationally — don't read them like a database readout.

## Tool-Specific Rules
- NEVER say the words "tool," "function," or "system" to the caller. They don't know those exist.
- If a tool fails or times out, stay cool: "Hmm, the system's being a little slow — let me try something." Then offer reasonable times manually.

# Instructions / Rules

## Booking Flow (natural order)
1. Caller wants to book → Ask what day. Keep it casual: "Sure thing — what day works for you?" or "Yeah, when were you thinking?"
2. They give a date → Say a quick filler ("One sec, checking that day..."), then call get_booked_slots with YYYY-MM-DD.
3. Results come back → Tell them what's open in a natural way: "Looks like I've got ten, two, and four open — any of those work?" If everything's open: "That day's wide open, actually. What time's best for you?"
4. They pick a time → NOW ask for their name. Not before. "Perfect, and what's your name?" or "Great choice. Can I get your name?"
5. If the name sounds tricky or unusual → "Could you spell the last name for me?" Then read it back letter by letter: "So that's K-A-C-Z-M-A-R-E-K?" Confirm before proceeding.
6. Name and time confirmed → Brief filler ("One moment, booking that for you..."), then call schedule_appointment with their full name and ISO 8601 datetime.
7. Tool confirms → Short, warm confirmation: "All set — you're booked for two PM on the tenth, [Name]." or "You're good to go. See you [day] at [time]."
8. Then ask once: "Is there anything else I can help you with?" If they say no → say "Have a good day!" then call save_call_summary, then call end_call.

## General Inquiries (hours, services, location, etc.)
- Answer in one or two short, natural sentences using the business info.
- Then ask once: "Is there anything else I can help you with?"
- If they say no → say "Have a good day!" then call save_call_summary (use "Unknown" for caller_name if they never said it), then call end_call.

## Handling Unclear Audio
- If you didn't catch something, be natural about it:
  - "Sorry, I missed that — say that again?"
  - "I didn't quite get that, one more time?"
  - "Little hard to hear you — could you repeat that?"
- NEVER ignore unclear input. ALWAYS ask for clarification.

## Handling Off-Topic / Weird Requests
- Stay friendly but redirect: "Ha, I wish I could help with that! But I'm really just here for scheduling and clinic questions. What can I do for you?"
- If a caller is rude or aggressive, stay calm and professional. Don't match their energy. "I understand you're frustrated. Let me see what I can do."

## Call Ending Rules
- After every interaction (booking, inquiry, anything), ALWAYS ask exactly once: "Is there anything else I can help you with?" Use natural variations — "Need anything else?" or "Anything else I can do for you?" — but only ask ONCE.
- If the caller says no, nothing, that's all, goodbye, or similar: say "Have a good day!" (exactly this, keep it short and warm), then IMMEDIATELY call save_call_summary, then call end_call. Do not add anything after "Have a good day!"
- NEVER call end_call without first calling save_call_summary.
- NEVER call save_call_summary or end_call mid-conversation — only after the caller says they are done.

## Absolute Don'ts
- NEVER list out multiple time slots as a bulleted menu. Speak them naturally.
- NEVER say "Is there anything else I can assist you with today?" — too robotic.
- NEVER start your greeting with "Thank you for calling [business name], my name is Sarah, how may I assist you?" — that's the exact robot script we're avoiding. Just be natural: "Hey, this is Sarah! What can I do for you?" or "Hi there, you've reached [clinic]. This is Sarah."
- NEVER over-confirm. Don't say: "So just to confirm, you'd like March tenth at two PM, is that correct?" Just say: "March tenth at two — got it."
- NEVER use corporate phrases: "I appreciate your patience," "Thank you for that information," "Let me assist you with that."
- NEVER volunteer information the caller didn't ask for. Don't list all services unprompted.

# Conversation Flow

## 1) Greeting
- Short, warm, natural. Set the tone immediately.
- Sample phrases (vary these — never the same greeting twice):
  - "Hey, this is Sarah! How can I help?"
  - "Hi there, thanks for calling! What's going on?"
  - "Hey! Sarah here. What can I do for you?"

## 2) Discover Intent
- Listen to what they need. Don't interrupt.
- If unclear, ask ONE clarifying question: "Are you looking to book, or did you have a question?"

## 3) Handle Request
- Booking → Follow the booking flow above.
- General question → Answer briefly, check if they need more.
- Something you can't help with → Say so honestly, suggest they call back or visit the website.

## 4) Wrap-Up
- Check: "Anything else?" (varied phrasing)
- If done → Brief goodbye, save summary, end call.

# Safety & Escalation
- If the caller asks for medical advice, say: "I'm not qualified to give medical advice, but our therapists can definitely talk through that with you at your appointment."
- If the caller seems to be in an emergency, say: "That sounds serious — I'd say call 911 right away. We're here when you're ready to book."
- If the caller asks to speak to a manager or a real person, say: "I totally understand. Unfortunately I can't transfer calls, but I can take down your number and have someone call you back. Would that work?"
`;


const DEFAULT_BUSINESS_INFO = `# Context (Business Info)
- Hours: Monday through Friday, nine to six. Saturday ten to four. Closed Sundays.
- Services: Swedish massage, deep tissue, sports massage, and relaxation massage. We do gift cards too.
- Location: One-twenty-three Main Street. (If they need the full address, give it; otherwise just say "We're on Main Street.")
- Booking: They can book right now with you, or call back anytime.`;


function buildBusinessInfoBlock(info) {
  if (!info) return DEFAULT_BUSINESS_INFO;
  const lines = ["# Context (Business Info)"];
  if (info.business_hours) lines.push(`- Hours: ${info.business_hours}`);
  if (info.services) lines.push(`- Services: ${info.services}`);
  if (info.address) lines.push(`- Location: ${info.address}`);
  if (info.phone) lines.push(`- Phone: ${info.phone}`);
  if (info.extra_notes) lines.push(`- Booking / other: ${info.extra_notes}`);
  if (lines.length === 1) return DEFAULT_BUSINESS_INFO;
  return lines.join("\n");
}


async function getSarahInstructions(tenantId = 1) {
  const info = await getBusinessInfo(tenantId).catch(() => null);
  const block = buildBusinessInfoBlock(info);
  let instructions = SARAH_INSTRUCTIONS_BASE.replace("{{BUSINESS_INFO_BLOCK}}", block);
  if (info?.custom_instructions?.trim()) {
    instructions += "\n\nADDITIONAL RULES / KNOWLEDGE BASE (follow these):\n" + info.custom_instructions.trim();
  }
  return instructions;
}


const OPENAI_WS_URL = `wss://api.openai.com/v1/realtime?model=${OPENAI_MODEL}`;


app.get("/stream", { websocket: true }, (socket, request) => {
  const tenantId = Number(request.query.tenantId) || 1;
  let streamSid = null;
  let callSid = null;
  let openaiWs = null;
  let maxDurationTimer = null;
  let isCancelling = false;       // true only between barge-in cancel and the next response.created
  let activeResponseId = null;   // used only for truncation — which response we're currently in
  let currentOutputItemId = null; // item_id of the assistant's current audio output item
  let audioSentMs = 0;            // cumulative ms of audio forwarded to Twilio for current item
  let isAudioStreaming = false;   // true only while audio deltas are actively arriving (not after item finishes)


  function clearMaxDurationTimer() {
    if (maxDurationTimer) {
      clearTimeout(maxDurationTimer);
      maxDurationTimer = null;
    }
  }


  function closeConnection() {
    clearMaxDurationTimer();
    if (openaiWs && openaiWs.readyState === WebSocket.OPEN) {
      openaiWs.close();
      openaiWs = null;
    }
  }


  socket.on("message", (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return;
    }


    switch (msg.event) {
      case "connected":
        break;


      case "start":
        streamSid = msg.start?.streamSid ?? msg.streamSid;
        if (!streamSid) streamSid = msg.streamSid;
        callSid = msg.start?.callSid ?? null;


        maxDurationTimer = setTimeout(async () => {
          maxDurationTimer = null;
          app.log.info({ callSid }, "Max call duration (10 min) reached; ending call");
          if (callSid) await endTwilioCall(callSid);
          closeConnection();
          try { socket.close(); } catch (_) {}
        }, MAX_CALL_DURATION_MS);


        if (!OPENAI_API_KEY) {
          socket.send(
            JSON.stringify({
              event: "media",
              streamSid,
              media: { payload: Buffer.from([0xff]).toString("base64") },
            })
          );
          return;
        }


        openaiWs = new WebSocket(OPENAI_WS_URL, {
          headers: { Authorization: `Bearer ${OPENAI_API_KEY}` },
        });


        openaiWs.on("open", async () => {
          app.log.info("OpenAI Realtime WebSocket connected, sending session.update");
          const instructions = await getSarahInstructions(tenantId);
          openaiWs.send(
            JSON.stringify({
              type: "session.update",
              session: {
                modalities: ["text", "audio"],
                instructions,
                voice: "alloy",
                input_audio_format: "pcm16",
                output_audio_format: "pcm16",
                input_audio_transcription: {
                  model: "whisper-1",
                  language: "en",
                },
                turn_detection: {
                  type: "server_vad",
                  threshold: 0.5,
                  prefix_padding_ms: 300,
                  silence_duration_ms: 500,
                },
                tool_choice: "auto",
                tools: [
                  {
                    type: "function",
                    name: "get_booked_slots",
                    description: "Get already-booked times for a date. You MUST pass 'date' as YYYY-MM-DD (e.g. 2026-03-10). Convert the caller's words (tomorrow, March 10) to this format. Required parameter: date.",
                    parameters: {
                      type: "object",
                      properties: {
                        date: { type: "string", description: "Date in YYYY-MM-DD only, e.g. 2026-03-10. Required." },
                      },
                      required: ["date"],
                      additionalProperties: false,
                    },
                  },
                  {
                    type: "function",
                    name: "schedule_appointment",
                    description: "Book an appointment. You MUST pass both full_name (caller's exact name from the conversation) and scheduled_at (ISO 8601, e.g. 2026-03-10T14:00:00). Do not call until you have both from the caller.",
                    parameters: {
                      type: "object",
                      properties: {
                        full_name: { type: "string", description: "Caller's full name." },
                        scheduled_at: { type: "string", description: "Appointment date and time in ISO 8601 format (e.g. 2026-03-08T15:00:00)." },
                      },
                      required: ["full_name", "scheduled_at"],
                      additionalProperties: false,
                    },
                  },
                  {
                    type: "function",
                    name: "save_call_summary",
                    description: "Save the call. You MUST pass caller_name (the exact full name the caller said; if they never said it use 'Unknown') and summary (1-2 sentences: what was discussed and any appointment with name, date, time). Both required; do not send empty strings.",
                    parameters: {
                      type: "object",
                      properties: {
                        caller_name: { type: "string", description: "The full name the caller gave. Use 'Unknown' only if they never said their name." },
                        summary: { type: "string", description: "1-2 sentence summary: what was discussed and any appointment (name, date, time). Required." },
                        transcript: { type: "string", description: "Optional key points." },
                      },
                      required: ["caller_name", "summary"],
                      additionalProperties: false,
                    },
                  },
                  {
                    type: "function",
                    name: "end_call",
                    description: "End the phone call. Call only after saying goodbye and after calling save_call_summary.",
                    parameters: { type: "object", properties: {}, additionalProperties: false },
                  },
                ],
              },
            })
          );
          // response.create is now triggered on session.updated event for faster, reliable greeting
        });


        openaiWs.on("message", async (data) => {
          try {
            const event = JSON.parse(data.toString());


            // Fire greeting as soon as session is confirmed ready
            if (event.type === "session.updated") {
              app.log.info("session.updated received — triggering greeting");
              if (openaiWs && openaiWs.readyState === WebSocket.OPEN) {
                openaiWs.send(JSON.stringify({ type: "response.create" }));
              }
            }


            // New response started — stop blocking audio (clears any barge-in cancel state)
            if (event.type === "response.created") {
              isCancelling = false;
              activeResponseId = event.response?.id ?? null;
              currentOutputItemId = null;
              audioSentMs = 0;
              isAudioStreaming = false;
            }

            // Track the assistant's audio output item ID (needed for truncation on barge-in)
            if (
              event.type === "response.output_item.added" &&
              event.item?.type === "message" &&
              event.item?.role === "assistant"
            ) {
              currentOutputItemId = event.item.id;
              audioSentMs = 0;
              isAudioStreaming = false;
            }

            // When the audio item finishes, mark streaming as done so barge-in won't truncate a completed item
            if (event.type === "response.output_item.done" && event.item?.id === currentOutputItemId) {
              isAudioStreaming = false;
            }

            // Barge-in: caller started speaking — truncate Sarah mid-sentence only if actively playing
            if (event.type === "input_audio_buffer.speech_started") {
              app.log.info({ activeResponseId, currentOutputItemId, audioSentMs, isAudioStreaming }, "Caller interrupted");
              isCancelling = true; // block audio until the next response.created arrives

              if (openaiWs && openaiWs.readyState === WebSocket.OPEN) {
                // Only truncate if Sarah is actively mid-speech — NOT if she already finished speaking
                if (currentOutputItemId && isAudioStreaming) {
                  openaiWs.send(JSON.stringify({
                    type: "conversation.item.truncate",
                    item_id: currentOutputItemId,
                    content_index: 0,
                    audio_end_ms: Math.floor(audioSentMs),
                  }));
                }
                openaiWs.send(JSON.stringify({ type: "response.cancel" }));
              }

              // Flush any audio already buffered in Twilio's queue
              if (streamSid) {
                socket.send(JSON.stringify({ event: "clear", streamSid }));
              }

              currentOutputItemId = null;
              audioSentMs = 0;
              isAudioStreaming = false;
            }

            // Forward audio unless we're in a barge-in cancel window
            if (event.type === "response.audio.delta" && event.delta && streamSid && !isCancelling) {
              isAudioStreaming = true;
              const mulawBase64 = openAIToTwilio(event.delta);
              socket.send(
                JSON.stringify({
                  event: "media",
                  streamSid,
                  media: { payload: mulawBase64 },
                })
              );
              // Track ms of audio sent for truncation accuracy
              const pcmBytes = Buffer.from(event.delta, "base64").length;
              audioSentMs += (pcmBytes / 2 / OPENAI_RATE) * 1000;
            }
            // OpenAI Realtime API streams function call args; the full JSON is in response.function_call_arguments.done (not in output_item.added)
            if (event.type === "response.function_call_arguments.done") {
              const toolName = event.name;
              const callId = event.call_id;
              let args = {};
              try {
                const raw = event.arguments;
                args = typeof raw === "string" ? (raw ? JSON.parse(raw) : {}) : raw || {};
              } catch (_) {}
              const sendOutput = (output, { triggerResponse = true } = {}) => {
                if (callId && openaiWs && openaiWs.readyState === WebSocket.OPEN) {
                  openaiWs.send(
                    JSON.stringify({
                      type: "conversation.item.create",
                      item: {
                        type: "function_call_output",
                        call_id: callId,
                        output,
                      },
                    })
                  );
                  // Tell OpenAI to speak the result immediately after receiving tool output
                  if (triggerResponse) {
                    openaiWs.send(JSON.stringify({ type: "response.create" }));
                  }
                }
              };


              if (toolName === "get_booked_slots") {
                const dateStr = String(args.date ?? "").trim();
                app.log.info({ dateStr }, "get_booked_slots called");
                if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
                  sendOutput(`You must pass the date in YYYY-MM-DD format. Example: {"date": "2026-03-10"}. Convert the caller's date (e.g. tomorrow, March 10) to that format, then call get_booked_slots again.`);
                } else {
                  // Run DB query with a tight 2-second timeout to minimise silence
                  let output;
                  try {
                    const booked = await Promise.race([
                      getBookedSlotsForDate(tenantId, dateStr),
                      new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), 2000)),
                    ]);
                    if (booked.length === 0) {
                      output = `No appointments booked yet for ${dateStr}. All times are available. Suggest a few options (e.g. 9 AM, 10 AM, 2 PM, 4 PM) and ask which works. Then call schedule_appointment with their name and the chosen ISO datetime (e.g. ${dateStr}T14:00:00).`;
                    } else {
                      const times = booked.map((b) => b.time).join(", ");
                      output = `Already booked on ${dateStr}: ${times}. Suggest other available times. When they pick one, call schedule_appointment with their name and that ISO datetime (e.g. ${dateStr}T10:00:00).`;
                    }
                  } catch (err) {
                    app.log.warn({ err, dateStr }, "get_booked_slots failed or timed out");
                    output = `Could not reach the calendar. Offer the caller 10 AM, 2 PM, and 4 PM for ${dateStr}. When they pick a time, call schedule_appointment with their full name and the ISO 8601 datetime (e.g. ${dateStr}T14:00:00).`;
                  }
                  sendOutput(output);
                }
              }


              if (toolName === "schedule_appointment") {
                const fullName = String(args.full_name ?? "").trim();
                const scheduledAtRaw = String(args.scheduled_at ?? "").trim();
                app.log.info({ fullName, scheduledAtRaw }, "schedule_appointment called");
                let output = "Database not configured.";
                if (fullName && scheduledAtRaw) {
                  const scheduledAt = new Date(scheduledAtRaw);
                  if (isNaN(scheduledAt.getTime())) {
                    app.log.warn({ scheduledAtRaw }, "schedule_appointment: invalid date, not saved");
                    output = "Invalid date or time. Use ISO 8601 (e.g. 2026-03-10T15:00:00). Tell the caller the booking did not go through and ask for date and time again.";
                  } else {
                    const existing = await getAppointmentAt(tenantId, scheduledAt);
                    if (existing) {
                      app.log.info({ existing }, "schedule_appointment: slot taken");
                      output = `That time is already scheduled for ${existing.caller_name}. Please suggest another time.`;
                    } else {
                      const insertedId = await insertAppointment({
                        tenantId,
                        callerName: fullName,
                        scheduledAt: scheduledAt.toISOString(),
                        callSid: callSid ?? undefined,
                      });
                      app.log.info({ insertedId, fullName, scheduledAt: scheduledAt.toISOString() }, "schedule_appointment: saved");
                      if (insertedId != null) {
                        const endTime = new Date(scheduledAt.getTime() + 30 * 60 * 1000);
                        const cal = await createCalendarEvent(tenantId, {
                          summary: `Appointment: ${fullName}`,
                          start: scheduledAt,
                          end: endTime,
                        }).catch(() => null);
                        if (cal?.id) app.log.info({ eventId: cal.id }, "Google Calendar event created");
                      }
                      output = insertedId != null
                        ? `Appointment saved: ${fullName} at ${scheduledAt.toISOString()}. Tell the caller they are confirmed.`
                        : "Could not save appointment (database not configured).";
                    }
                  }
                } else {
                  app.log.warn({ fullName, scheduledAtRaw }, "schedule_appointment: missing name or time");
                  output = "You must pass both full_name and scheduled_at (ISO 8601). Example: {\"full_name\": \"Jane Smith\", \"scheduled_at\": \"2026-03-10T14:00:00\"}. Get the caller's name and chosen date/time, then call again with those values.";
                }
                sendOutput(output);
              }


              if (toolName === "save_call_summary") {
                let callerName = String(args.caller_name ?? "").trim();
                let summary = String(args.summary ?? "").trim();
                const transcript = String(args.transcript ?? "").trim();
                if (!callerName) callerName = "Unknown";
                if (!summary) summary = `Call from ${callerName}. No summary provided by assistant.`;
                app.log.info({ callerName, summaryLen: summary.length }, "save_call_summary called");
                const insertedId = await insertCall({
                  tenantId,
                  callSid: callSid ?? undefined,
                  callerName,
                  summary,
                  transcript: transcript || null,
                });
                const output = insertedId != null ? `Saved call summary (id ${insertedId}).` : "Call summary not saved (database not configured).";
                sendOutput(output);
              }


              if (toolName === "end_call") {
                app.log.info({ callId }, "Sarah requested end_call, hanging up");
                sendOutput("Call ended.", { triggerResponse: false });
                if (callSid) endTwilioCall(callSid).catch(() => {});
                closeConnection();
                try { socket.close(); } catch (_) {}
              }
            }


            // Legacy: also handle output_item.added for end_call only (in case .done is not sent for empty-arg tools)
            if (event.type === "response.output_item.added" && event.item?.type === "function_call" && event.item?.name === "end_call") {
              const callId = event.item?.call_id ?? event.item?.id;
              app.log.info({ callId }, "Sarah requested end_call (from output_item), hanging up");
              if (callId && openaiWs && openaiWs.readyState === WebSocket.OPEN) {
                openaiWs.send(
                  JSON.stringify({
                    type: "conversation.item.create",
                    item: {
                      type: "function_call_output",
                      call_id: callId,
                      output: "Call ended.",
                    },
                  })
                );
              }
              if (callSid) endTwilioCall(callSid).catch(() => {});
              closeConnection();
              try { socket.close(); } catch (_) {}
            }
          } catch (_) {}
        });


        openaiWs.on("error", (err) => {
          app.log.error({ err }, "OpenAI WebSocket error");
        });


        openaiWs.on("close", () => {
          openaiWs = null;
        });
        break;


      case "media":
        if (msg.media?.track !== "inbound" || !openaiWs || openaiWs.readyState !== WebSocket.OPEN) break;
        try {
          const pcmBase64 = twilioToOpenAI(msg.media.payload);
          openaiWs.send(JSON.stringify({ type: "input_audio_buffer.append", audio: pcmBase64 }));
        } catch (e) {
          app.log.warn({ err: e }, "Twilio→OpenAI audio convert");
        }
        break;


      case "stop":
        clearMaxDurationTimer();
        if (openaiWs && openaiWs.readyState === WebSocket.OPEN) {
          openaiWs.close();
          openaiWs = null;
        }
        break;
    }
  });


  socket.on("close", () => {
    closeConnection();
  });
});


app.get("/", async (request, reply) => {
  return { ok: true, service: "aivoice-voice-engine", phase: 1, provider: "openai-realtime" };
});


await app.listen({ port: PORT, host: "0.0.0.0" });
console.log(`Voice engine listening on http://0.0.0.0:${PORT}`);

import("./lib/db.js").then(({ pool }) => {
  if (pool) {
    pool.query("SELECT 1").then(() => {
      app.log.info("DB connection pool warmed up");
    }).catch((err) => {
      app.log.warn({ err }, "DB warmup query failed (non-fatal)");
    });
  }
});
