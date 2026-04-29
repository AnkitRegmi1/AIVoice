## AI Voice Receptionist

This project is a B2B SaaS voice receptionist:

- Incoming phone calls are handled by a **Node.js voice engine** (`server.js`).
- The engine streams audio to an AI provider for live conversational responses.
- Calls, summaries, and appointments are stored in a SQL database.
- A **Next.js dashboard** in `dashboard/` lets business owners see a Smart Inbox, manage business info, and (for you as the operator) manage tenants and phone numbers.

This repo intentionally does **not** include any real credentials, connection strings, or cloud provider details. All sensitive values must be supplied via environment variables on your own machines or hosting provider.

At a high level you will need to:

- Provide environment variables for:
  - The voice provider (e.g. a telephony API key / webhook URL).
  - The AI provider (API key).
  - A SQL database connection URL.
- Run the Node.js voice engine from the `server/` directory.
- Run the Next.js dashboard from the `dashboard/` directory.

Refer to your own private deployment notes for exact environment variable values and hosting details.

