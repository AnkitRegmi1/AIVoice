/**
 * Create a Google Calendar event using the tenant's stored refresh token.
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
