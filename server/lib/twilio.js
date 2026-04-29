import { BASE_URL, TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN } from "./config.js";

export function buildStreamUrl(tenantId) {
  return `${BASE_URL.replace(/^https?/, "wss")}/stream?tenantId=${tenantId}`;
}

export function buildVoiceTwiml(tenantId) {
  const streamUrl = buildStreamUrl(tenantId);
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <Stream url="${streamUrl}" />
  </Connect>
</Response>`;
}

export async function endTwilioCall(app, callSid) {
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !callSid) return;
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
