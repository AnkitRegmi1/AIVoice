import { getTenantByPhone } from "../lib/db.js";
import { buildVoiceTwiml } from "../lib/twilio.js";

export function registerVoiceRoutes(app) {
  app.get("/voice", async (request, reply) => {
    const twiml = buildVoiceTwiml(1);
    reply.type("application/xml").send(twiml);
  });

  app.post("/voice", async (request, reply) => {
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
      // Fall back to tenant 1 on any parsing/DB error.
    }

    const twiml = buildVoiceTwiml(tenantId);
    reply.type("application/xml").send(twiml);
  });
}
