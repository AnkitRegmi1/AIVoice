import WebSocket from "ws";
import {
  getAppointmentAt,
  getBookedSlotsForDate,
  insertAppointment,
  insertCall,
  searchKnowledge,
} from "../lib/db.js";
import { createCalendarEvent, listCalendarEvents, getGoogleCalendarConflict } from "../lib/google-calendar.js";
import {
  MAX_CALL_DURATION_MS,
  OPENAI_API_KEY,
  OPENAI_REALTIME_VOICE,
  OPENAI_WS_URL,
} from "../lib/config.js";
import { OPENAI_RATE, openAIToTwilio, twilioToOpenAI } from "../lib/audio.js";
import { getSarahInstructions } from "../lib/sarah.js";
import { endTwilioCall } from "../lib/twilio.js";

function buildSessionUpdate(instructions) {
  return {
    type: "session.update",
    session: {
      type: "realtime",
      output_modalities: ["audio"],
      instructions,
      audio: {
        input: {
          format: { type: "audio/pcm", rate: 24000 },
          transcription: {
            model: "whisper-1",
            language: "en",
            prompt: "Caller is speaking English at a US business phone line.",
          },
          turn_detection: {
            type: "server_vad",
            threshold: 0.65,
            prefix_padding_ms: 350,
            silence_duration_ms: 600,
            interrupt_response: false,
          },
        },
        output: {
          format: { type: "audio/pcm", rate: 24000 },
          voice: OPENAI_REALTIME_VOICE,
        },
      },
      tool_choice: "auto",
      tools: [
        {
          type: "function",
          name: "get_booked_slots",
          description:
            "Check the appointment calendar for one day: which times are already taken. Call as soon as the caller names or implies a specific day for booking (e.g. tomorrow, Tuesday, March 10). You MUST pass 'date' as YYYY-MM-DD (e.g. 2026-04-12). Convert the caller's words to that format. Required parameter: date.",
          parameters: {
            type: "object",
            properties: {
              date: {
                type: "string",
                description: "Date in YYYY-MM-DD only, e.g. 2026-03-10. Required.",
              },
            },
            required: ["date"],
            additionalProperties: false,
          },
        },
        {
          type: "function",
          name: "schedule_appointment",
          description:
            "Book an appointment. You MUST pass both full_name (caller's exact name from the conversation) and scheduled_at (ISO 8601, e.g. 2026-03-10T14:00:00). Do not call until you have both from the caller.",
          parameters: {
            type: "object",
            properties: {
              full_name: { type: "string", description: "Caller's full name." },
              scheduled_at: {
                type: "string",
                description:
                  "Appointment date and time in ISO 8601 format (e.g. 2026-03-08T15:00:00).",
              },
            },
            required: ["full_name", "scheduled_at"],
            additionalProperties: false,
          },
        },
        {
          type: "function",
          name: "search_knowledge",
          description:
            "Search uploaded business documents for answers to caller questions about policies, services, FAQs, preparation instructions, membership details, or other clinic-specific information not already obvious from the business info. Pass a short plain-English question.",
          parameters: {
            type: "object",
            properties: {
              question: {
                type: "string",
                description: "Short natural-language question to search for in uploaded documents.",
              },
            },
            required: ["question"],
            additionalProperties: false,
          },
        },
        {
          type: "function",
          name: "save_call_summary",
          description:
            "Save the call. You MUST pass caller_name (the exact full name the caller said; if they never said it use 'Unknown') and summary (1-2 sentences: what was discussed and any appointment with name, date, time). Both required; do not send empty strings.",
          parameters: {
            type: "object",
            properties: {
              caller_name: {
                type: "string",
                description: "The full name the caller gave. Use 'Unknown' only if they never said their name.",
              },
              summary: {
                type: "string",
                description:
                  "1-2 sentence summary: what was discussed and any appointment (name, date, time). Required.",
              },
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
  };
}

function buildGreetingPayload(instructions) {
  return instructions.length > 0
    ? { type: "response.create", response: { instructions } }
    : { type: "response.create" };
}

function timeoutAfter(ms = 2000) {
  return new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), ms));
}

/** Extract "HH:MM" from a Google Calendar ISO dateTime string in its local timezone. */
function extractLocalTime(dateTimeStr) {
  if (!dateTimeStr) return "?";
  const match = dateTimeStr.match(/T(\d{2}:\d{2})/);
  return match ? match[1] : new Date(dateTimeStr).toISOString().slice(11, 16);
}

function parseToolArgs(raw) {
  try {
    return typeof raw === "string" ? (raw ? JSON.parse(raw) : {}) : raw || {};
  } catch {
    return {};
  }
}

async function handleToolCall({
  app,
  event,
  tenantId,
  callSid,
  socket,
  openaiWs,
  closeConnection,
}) {
  const toolName = event.name;
  const callId = event.call_id;
  const args = parseToolArgs(event.arguments);

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
      if (triggerResponse) {
        openaiWs.send(JSON.stringify({ type: "response.create" }));
      }
    }
  };

  if (toolName === "get_booked_slots") {
    const dateStr = String(args.date ?? "").trim();
    app.log.info({ dateStr }, "get_booked_slots called");
    if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      sendOutput(
        'You must pass the date in YYYY-MM-DD format. Example: {"date": "2026-03-10"}. Convert the caller\'s date (e.g. tomorrow, March 10) to that format, then call get_booked_slots again.'
      );
      return;
    }

    let output;
    try {
      const [booked, googleEvents] = await Promise.all([
        Promise.race([getBookedSlotsForDate(tenantId, dateStr), timeoutAfter(2000)]),
        listCalendarEvents(tenantId, dateStr).catch(() => []),
      ]);

      const bookedTimes = booked.map((b) => b.time);
      const googleTimes = googleEvents.map((e) => e.time);
      const allBusyTimes = [...new Set([...bookedTimes, ...googleTimes])].sort();

      const googleSummaries = googleEvents
        .map((e) => `${e.time} – ${e.summary}`)
        .join(", ");

      if (allBusyTimes.length === 0) {
        output = `No appointments or calendar events on ${dateStr}. All times are available. Suggest a few options (e.g. 9 AM, 10 AM, 2 PM, 4 PM) and ask which works. Then call schedule_appointment with their name and the chosen ISO datetime (e.g. ${dateStr}T14:00:00).`;
      } else {
        const bookedStr = bookedTimes.length > 0 ? `Phone bookings: ${bookedTimes.join(", ")}.` : "";
        const gcalStr = googleSummaries ? `Google Calendar events: ${googleSummaries}.` : "";
        const busyStr = `Busy times on ${dateStr}: ${allBusyTimes.join(", ")}.`;
        output = `${busyStr} ${bookedStr} ${gcalStr} Suggest available times that don't conflict. When the caller picks one, call schedule_appointment with their name and that ISO datetime (e.g. ${dateStr}T10:00:00).`.trim();
      }
    } catch (err) {
      app.log.warn({ err, dateStr }, "get_booked_slots failed or timed out");
      output = `Could not reach the calendar. Offer the caller 10 AM, 2 PM, and 4 PM for ${dateStr}. When they pick a time, call schedule_appointment with their full name and the ISO 8601 datetime (e.g. ${dateStr}T14:00:00).`;
    }
    sendOutput(output);
    return;
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
        output =
          "Invalid date or time. Use ISO 8601 (e.g. 2026-03-10T15:00:00). Tell the caller the booking did not go through and ask for date and time again.";
      } else {
        const existing = await getAppointmentAt(tenantId, scheduledAt);
        if (existing) {
          app.log.info({ existing }, "schedule_appointment: slot taken");
          output = `That time is already scheduled for ${existing.caller_name}. Please suggest another time.`;
        } else {
          // Also check Google Calendar so we never double-book over existing events
          const gcalConflict = await getGoogleCalendarConflict(tenantId, scheduledAt).catch(() => null);
          if (gcalConflict) {
            const conflictTime = extractLocalTime(gcalConflict.start);
            const conflictEndTime = extractLocalTime(gcalConflict.end);
            app.log.info({ gcalConflict }, "schedule_appointment: Google Calendar conflict");
            output = `That time conflicts with an existing calendar event from ${conflictTime} to ${conflictEndTime}. Please suggest another time to the caller.`;
          } else {
          const insertedId = await insertAppointment({
            tenantId,
            callerName: fullName,
            scheduledAt: scheduledAt.toISOString(),
            callSid: callSid ?? undefined,
          });
          app.log.info(
            { insertedId, fullName, scheduledAt: scheduledAt.toISOString() },
            "schedule_appointment: saved"
          );
          if (insertedId != null) {
            const endTime = new Date(scheduledAt.getTime() + 30 * 60 * 1000);
            const cal = await createCalendarEvent(tenantId, {
              summary: `Appointment: ${fullName}`,
              start: scheduledAt,
              end: endTime,
            }).catch(() => null);
            if (cal?.id) app.log.info({ eventId: cal.id }, "Google Calendar event created");
          }
          output =
            insertedId != null
              ? `Appointment saved: ${fullName} at ${scheduledAt.toISOString()}. Tell the caller they are confirmed.`
              : "Could not save appointment (database not configured).";
          } // end no gcal conflict
        }
      }
    } else {
      app.log.warn({ fullName, scheduledAtRaw }, "schedule_appointment: missing name or time");
      output =
        'You must pass both full_name and scheduled_at (ISO 8601). Example: {"full_name": "Jane Smith", "scheduled_at": "2026-03-10T14:00:00"}. Get the caller\'s name and chosen date/time, then call again with those values.';
    }
    sendOutput(output);
    return;
  }

  if (toolName === "search_knowledge") {
    const question = String(args.question ?? "").trim();
    app.log.info({ question }, "search_knowledge called");
    if (!question) {
      sendOutput("Please ask the knowledge search again with a short plain-English question.");
      return;
    }

    try {
      const matches = await Promise.race([
        searchKnowledge(tenantId, question, 4),
        timeoutAfter(2000),
      ]);
      if (!matches || matches.length === 0) {
        sendOutput(
          "No uploaded document matched that question closely. Answer using the business info you already have, and if you're unsure, say you don't want to guess."
        );
      } else {
        const snippets = matches
          .map((match, index) => `Source ${index + 1} (${match.filename}): ${String(match.content).trim()}`)
          .join("\n");
        sendOutput(
          `Use the document knowledge below to answer accurately in one or two short sentences. If the snippets do not fully answer the question, say you are not completely sure instead of guessing.\n\n${snippets}`
        );
      }
    } catch (err) {
      app.log.warn({ err, question }, "search_knowledge failed or timed out");
      sendOutput(
        "The uploaded-document search is unavailable right now. Answer from the business info you already have, and if you are still unsure, say so briefly."
      );
    }
    return;
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
    const output =
      insertedId != null
        ? `Saved call summary (id ${insertedId}).`
        : "Call summary not saved (database not configured).";
    sendOutput(output);
    return;
  }

  if (toolName === "end_call") {
    app.log.info({ callId }, "Sarah requested end_call, hanging up");
    sendOutput("Call ended.", { triggerResponse: false });
    if (callSid) endTwilioCall(app, callSid).catch(() => {});
    closeConnection();
    try {
      socket.close();
    } catch {}
  }
}

function handleLegacyEndCall({ app, event, openaiWs, callSid, closeConnection, socket }) {
  if (
    event.type === "response.output_item.added" &&
    event.item?.type === "function_call" &&
    event.item?.name === "end_call"
  ) {
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
    if (callSid) endTwilioCall(app, callSid).catch(() => {});
    closeConnection();
    try {
      socket.close();
    } catch {}
  }
}

export function registerStreamRoute(app) {
  app.get("/stream", { websocket: true }, (socket, request) => {
    const tenantId = Number(request.query.tenantId) || 1;
    let streamSid = null;
    let callSid = null;
    let openaiWs = null;
    let maxDurationTimer = null;
    let isCancelling = false;
    let activeResponseId = null;
    let currentOutputItemId = null;
    let audioSentMs = 0;
    let isAudioStreaming = false;
    let greetingSent = false;
    let greetingFallbackTimer = null;
    let sarahInstructionsForCall = "";

    function clearMaxDurationTimer() {
      if (maxDurationTimer) {
        clearTimeout(maxDurationTimer);
        maxDurationTimer = null;
      }
    }

    function clearGreetingFallback() {
      if (greetingFallbackTimer) {
        clearTimeout(greetingFallbackTimer);
        greetingFallbackTimer = null;
      }
    }

    function triggerGreeting(reason) {
      if (greetingSent) return;
      greetingSent = true;
      clearGreetingFallback();
      if (openaiWs && openaiWs.readyState === WebSocket.OPEN) {
        app.log.info(
          { reason, instructionChars: sarahInstructionsForCall.length },
          "Triggering greeting (response.create)"
        );
        openaiWs.send(JSON.stringify(buildGreetingPayload(sarahInstructionsForCall)));
      }
    }

    function closeConnection() {
      clearMaxDurationTimer();
      clearGreetingFallback();
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
            if (callSid) await endTwilioCall(app, callSid);
            closeConnection();
            try {
              socket.close();
            } catch {}
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
            sarahInstructionsForCall = await getSarahInstructions(app, tenantId);
            openaiWs.send(JSON.stringify(buildSessionUpdate(sarahInstructionsForCall)));
            greetingFallbackTimer = setTimeout(() => {
              greetingFallbackTimer = null;
              triggerGreeting("fallback:no_session.updated_within_2p5s");
            }, 2500);
          });

          openaiWs.on("message", async (data) => {
            try {
              const event = JSON.parse(data.toString());

              if (event.type === "session.updated") {
                triggerGreeting("session.updated");
              }

              if (event.type === "response.created") {
                isCancelling = false;
                activeResponseId = event.response?.id ?? null;
                currentOutputItemId = null;
                audioSentMs = 0;
                isAudioStreaming = false;
              }

              if (
                event.type === "response.output_item.added" &&
                event.item?.type === "message" &&
                event.item?.role === "assistant"
              ) {
                currentOutputItemId = event.item.id;
                audioSentMs = 0;
                isAudioStreaming = false;
              }

              if (event.type === "response.output_item.done" && event.item?.id === currentOutputItemId) {
                isAudioStreaming = false;
              }

              if (event.type === "input_audio_buffer.speech_started") {
                const assistantIsAudible = isAudioStreaming === true;
                if (assistantIsAudible) {
                  app.log.info(
                    { activeResponseId, currentOutputItemId, audioSentMs, isAudioStreaming },
                    "Caller interrupted"
                  );
                  isCancelling = true;

                  if (openaiWs && openaiWs.readyState === WebSocket.OPEN) {
                    if (currentOutputItemId && isAudioStreaming) {
                      openaiWs.send(
                        JSON.stringify({
                          type: "conversation.item.truncate",
                          item_id: currentOutputItemId,
                          content_index: 0,
                          audio_end_ms: Math.floor(audioSentMs),
                        })
                      );
                    }
                    if (activeResponseId) {
                      openaiWs.send(JSON.stringify({ type: "response.cancel" }));
                    }
                  }

                  if (streamSid) {
                    socket.send(JSON.stringify({ event: "clear", streamSid }));
                  }

                  currentOutputItemId = null;
                  audioSentMs = 0;
                  isAudioStreaming = false;
                }
              }

              if (
                (event.type === "response.output_audio.delta" || event.type === "response.audio.delta") &&
                event.delta &&
                streamSid &&
                !isCancelling
              ) {
                isAudioStreaming = true;
                const mulawBase64 = openAIToTwilio(event.delta);
                socket.send(
                  JSON.stringify({
                    event: "media",
                    streamSid,
                    media: { payload: mulawBase64 },
                  })
                );
                const pcmBytes = Buffer.from(event.delta, "base64").length;
                audioSentMs += (pcmBytes / 2 / OPENAI_RATE) * 1000;
              }

              if (event.type === "response.function_call_arguments.done") {
                await handleToolCall({
                  app,
                  event,
                  tenantId,
                  callSid,
                  socket,
                  openaiWs,
                  closeConnection,
                });
              }

              if (event.type === "error") {
                app.log.error({ err: event.error ?? event }, "OpenAI Realtime error event");
              }

              handleLegacyEndCall({
                app,
                event,
                openaiWs,
                callSid,
                closeConnection,
                socket,
              });
            } catch (parseErr) {
              app.log.warn({ err: parseErr }, "OpenAI message parse/handler error");
            }
          });

          openaiWs.on("error", (err) => {
            app.log.error({ err }, "OpenAI WebSocket error");
          });

          openaiWs.on("close", () => {
            clearGreetingFallback();
            openaiWs = null;
          });
          break;

        case "media":
          if (msg.media?.track !== "inbound" || !openaiWs || openaiWs.readyState !== WebSocket.OPEN) break;
          try {
            const pcmBase64 = twilioToOpenAI(msg.media.payload);
            openaiWs.send(JSON.stringify({ type: "input_audio_buffer.append", audio: pcmBase64 }));
          } catch (e) {
            app.log.warn({ err: e }, "Twilio->OpenAI audio convert");
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
}
