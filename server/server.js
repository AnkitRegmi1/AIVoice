import "dotenv/config";
import Fastify from "fastify";
import fastifyWebsocket from "@fastify/websocket";
import { pool } from "./lib/db.js";
import { PORT, warnOnMissingConfig } from "./lib/config.js";
import { registerStreamRoute } from "./routes/stream.js";
import { registerVoiceRoutes } from "./routes/voice.js";

warnOnMissingConfig();

const app = Fastify({ logger: true });

app.addContentTypeParser(
  "application/x-www-form-urlencoded",
  { parseAs: "string" },
  (req, body, done) => {
    done(null, body);
  }
);

await app.register(fastifyWebsocket, {
  options: { clientTracking: true },
});

registerVoiceRoutes(app);
registerStreamRoute(app);

app.get("/", async () => {
  return { ok: true, service: "aivoice-voice-engine", phase: 1, provider: "openai-realtime" };
});

await app.listen({ port: PORT, host: "0.0.0.0" });
console.log(`Voice engine listening on http://0.0.0.0:${PORT}`);

if (pool) {
  pool
    .query("SELECT 1")
    .then(() => {
      app.log.info("DB connection pool warmed up");
    })
    .catch((err) => {
      app.log.warn({ err }, "DB warmup query failed (non-fatal)");
    });
}
