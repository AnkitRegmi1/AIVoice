/**
 * Dashboard-side Google Calendar helpers.
 * Reads events for the calendar view so existing commitments are visible
 * alongside phone bookings.
 */
import { google } from "googleapis";
import { getGoogleTokens } from "./db";

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;

export interface GoogleCalendarEvent {
  id: string;
  summary: string;
  start: string;
  end: string;
  allDay: boolean;
}

function makeOAuthClient() {
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) return null;
  return new google.auth.OAuth2(
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    `${process.env.NEXTAUTH_URL ?? "http://localhost:3002"}/api/auth/callback/google`
  );
}

/**
 * Fetch all Google Calendar events for the given month (year + month are
 * 0-indexed like Date.getMonth()).  Returns an empty array if OAuth is not
 * configured or no tokens are stored.
 */
export async function getGoogleCalendarEventsForMonth(
  tenantId: number,
  year: number,
  month: number
): Promise<GoogleCalendarEvent[]> {
  const oauth2Client = makeOAuthClient();
  if (!oauth2Client) return [];

  const tokens = await getGoogleTokens(tenantId);
  if (!tokens?.refresh_token) return [];

  oauth2Client.setCredentials({ refresh_token: tokens.refresh_token });

  const calendar = google.calendar({ version: "v3", auth: oauth2Client });
  const calendarId = tokens.calendar_id || "primary";

  const timeMin = new Date(year, month, 1).toISOString();
  const timeMax = new Date(year, month + 1, 0, 23, 59, 59).toISOString();

  try {
    const res = await calendar.events.list({
      calendarId,
      timeMin,
      timeMax,
      singleEvents: true,
      orderBy: "startTime",
      maxResults: 250,
    });

    return (res.data.items ?? []).map((e) => ({
      id: e.id ?? crypto.randomUUID(),
      summary: e.summary ?? "Busy",
      start: e.start?.dateTime ?? e.start?.date ?? timeMin,
      end: e.end?.dateTime ?? e.end?.date ?? timeMin,
      allDay: !e.start?.dateTime,
    }));
  } catch (err) {
    console.warn("[dashboard/google-calendar] Failed to fetch events:", (err as Error).message);
    return [];
  }
}
