# Voice server only (Twilio + OpenAI Realtime). Dashboard and DB run separately.
FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

COPY server.js ./
COPY lib/ lib/

EXPOSE 3000

ENV NODE_ENV=production
CMD ["node", "server.js"]
