/**
 * Google Calendar helpers: create events and list busy times for a day.
 * Requires GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in env (same as dashboard OAuth).
 */
import { google } from "googleapis";
import { getGoogleTokens } from "./db.js";

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;

/**
 * Create an event on the tenant's Google Calendar. No-op if tokens or env not set.
 * @param {number} tenantId
 * @param {{ summary: string; start: Date; end: Date }} opts
 * @returns {Promise<{ id?: string } | null>}
 */
export async function createCalendarEvent(tenantId, { summary, start, end }) {
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) return null;
  const tokens = await getGoogleTokens(tenantId).catch(() => null);
  if (!tokens?.refresh_token) return null;

  const oauth2Client = new google.auth.OAuth2(
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    "http://localhost" // redirect not used when only refreshing
  );
  oauth2Client.setCredentials({ refresh_token: tokens.refresh_token });

  const calendar = google.calendar({ version: "v3", auth: oauth2Client });
  const calendarId = tokens.calendar_id || "primary";

  try {
    const res = await calendar.events.insert({
      calendarId,
      requestBody: {
        summary,
        start: { dateTime: start.toISOString(), timeZone: "UTC" },
        end: { dateTime: end.toISOString(), timeZone: "UTC" },
      },
    });
    return res.data?.id ? { id: res.data.id } : null;
  } catch (err) {
    console.warn("Google Calendar create event failed:", err.message);
    return null;
  }
}

/**
 * List Google Calendar events for a given date (YYYY-MM-DD).
 * Returns array of { summary, start, end, time } for that day so Sarah can
 * mention existing commitments when suggesting available slots.
 * @param {number} tenantId
 * @param {string} dateStr  YYYY-MM-DD
 * @returns {Promise<Array<{ summary: string; start: string; end: string; time: string }>>}
 */
/**
 * Extract "HH:MM" from a Google Calendar dateTime string like
 * "2026-04-30T14:00:00-05:00" → "14:00" (local time in the event's timezone).
 * Falls back to UTC if the string has no offset.
 */
function extractLocalTime(dateTimeStr) {
  const match = dateTimeStr.match(/T(\d{2}:\d{2})/);
  return match ? match[1] : new Date(dateTimeStr).toISOString().slice(11, 16);
}

/**
 * Extract the local calendar date "YYYY-MM-DD" from a Google dateTime string,
 * respecting the event's own timezone offset (not the server's).
 */
function extractLocalDate(dateTimeStr) {
  // "2026-04-30T14:00:00-05:00" → "2026-04-30"
  return dateTimeStr.slice(0, 10);
}

export async function listCalendarEvents(tenantId, dateStr) {
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) return [];
  const tokens = await getGoogleTokens(tenantId).catch(() => null);
  if (!tokens?.refresh_token) return [];

  const oauth2Client = new google.auth.OAuth2(
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    "http://localhost"
  );
  oauth2Client.setCredentials({ refresh_token: tokens.refresh_token });

  const calendar = google.calendar({ version: "v3", auth: oauth2Client });
  const calendarId = tokens.calendar_id || "primary";

  // Query a 50-hour window centred on local midnight of dateStr so we catch
  // events regardless of the tenant's UTC offset (covers UTC-14 to UTC+14).
  const base = new Date(`${dateStr}T00:00:00.000Z`);
  const timeMin = new Date(base.getTime() - 14 * 60 * 60 * 1000).toISOString();
  const timeMax = new Date(base.getTime() + 38 * 60 * 60 * 1000).toISOString();

  try {
    const res = await calendar.events.list({
      calendarId,
      timeMin,
      timeMax,
      singleEvents: true,
      orderBy: "startTime",
      maxResults: 100,
    });

    return (res.data.items ?? [])
      .filter((e) => {
        if (!e.start?.dateTime) return false; // skip all-day events
        // Only keep events whose local calendar date matches the requested date
        return extractLocalDate(e.start.dateTime) === dateStr;
      })
      .map((e) => ({
        summary: e.summary ?? "Busy",
        start: e.start.dateTime,
        end: e.end?.dateTime ?? e.start.dateTime,
        // Time in the event's own local timezone (what the user actually sees)
        time: extractLocalTime(e.start.dateTime),
        endTime: e.end?.dateTime ? extractLocalTime(e.end.dateTime) : null,
      }));
  } catch (err) {
    console.warn("Google Calendar list events failed:", err.message);
    return [];
  }
}

/**
 * Check whether a proposed booking time overlaps any Google Calendar event.
 * Returns the conflicting event or null if the slot is free.
 * @param {number} tenantId
 * @param {Date} scheduledAt  - proposed start time
 * @param {number} durationMinutes - appointment length (default 30)
 */
export async function getGoogleCalendarConflict(tenantId, scheduledAt, durationMinutes = 30) {
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) return null;
  const tokens = await getGoogleTokens(tenantId).catch(() => null);
  if (!tokens?.refresh_token) return null;

  const oauth2Client = new google.auth.OAuth2(
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    "http://localhost"
  );
  oauth2Client.setCredentials({ refresh_token: tokens.refresh_token });

  const calendar = google.calendar({ version: "v3", auth: oauth2Client });
  const calendarId = tokens.calendar_id || "primary";

  const proposedEnd = new Date(scheduledAt.getTime() + durationMinutes * 60 * 1000);

  try {
    // Use freebusy query — most accurate overlap detection
    const res = await calendar.freebusy.query({
      requestBody: {
        timeMin: scheduledAt.toISOString(),
        timeMax: proposedEnd.toISOString(),
        items: [{ id: calendarId }],
      },
    });

    const busy = res.data.calendars?.[calendarId]?.busy ?? [];
    if (busy.length === 0) return null;

    // Return the conflicting period
    return { start: busy[0].start, end: busy[0].end };
  } catch (err) {
    console.warn("Google Calendar freebusy check failed:", err.message);
    return null; // fail open — don't block booking if check fails
  }
}
