# Analytics AI

Analytics AI is an AI-powered analytics environment that allows users to connect analytics platforms and interact with their data through natural language.

The current version covers Google Analytics 4, Microsoft Clarity, and Vercel Analytics. Humana Analytics is the grounded chat agent: it answers in the user's language (PT-BR or EN) using only tool data from connected sources. Google sign-in is required before the dashboard and chat.

## Objective

Instead of requiring users to navigate multiple analytics platforms and manually combine information, Analytics AI provides a conversational interface where users can ask questions about their website data.

Example:

> How did the website perform this week?

The AI Agent identifies the required data, queries the appropriate analytics source, and presents the result in a clear and contextual way.

## Product Vision

```text
User
  ↓
Analytics AI
  ↓
AI Agent
  ↓
Analytics Tools
  ↓
Data Sources
  ├── Google Analytics
  ├── Microsoft Clarity
  ├── Vercel Analytics
  └── GitHub
```

The project is initially intended for internal use at Humana AI, while its architecture is designed to allow future evolution into a multi-organization SaaS product.

## Initial MVP

### M1 — GA4 + Chat

The first milestone provides:

* Project creation
* Google Analytics connection
* GA4 property selection
* Connection validation
* AI-powered chat
* Analytics Agent
* GA4 analytics tools
* Natural-language questions
* Relative date ranges
* Period comparisons
* Responses based on real GA4 data

### Initial questions

The MVP should support questions such as:

* How many users did we have in the last 7 days?
* How many sessions did we have?
* What were our most visited pages?
* Where did our visitors come from?
* How many times did a specific event occur?
* How did this week compare with the previous week?

## Planned Integrations

| Provider           | Purpose                                  | Status |
| ------------------ | ---------------------------------------- | ------ |
| Google Analytics 4 | Analytics, acquisition, events and pages | Live   |
| Microsoft Clarity  | User behavior and interaction signals    | Live   |
| Vercel Analytics   | Web analytics and traffic sources        | Live   |
| GitHub             | Repository views, clones, stars, release downloads | Live when `GITHUB_TOKEN` and `GITHUB_REPO` are set |

Dashboards and the Humana Analytics agent query these sources when credentials are configured. A disconnected source returns connect guidance instead of mock metrics. Apply `pnpm db:analytics:migrate` before the first sign-in. Moving the Google OAuth client and GA4 service account to the company GCP project is documented in [docs/gcp-oauth-migration.md](docs/gcp-oauth-migration.md). GitHub setup (token scope, daily snapshot, 14-day traffic window, Vercel Cron) is in [docs/github-source.md](docs/github-source.md).

## Architecture

```text
                         USER
                           │
                           ▼
                         CHAT
                           │
                           ▼
                       AI AGENT
                           │
                    ┌──────┴──────┐
                    │             │
                  TOOLS       ANALYSIS
                    │             │
                    └──────┬──────┘
                           ▼
                       REPOSITORY
                           │
              ┌────────────┼────────────┐
              ▼            ▼            ▼
          GA4      CLARITY     VERCEL     GITHUB
         ADAPTER    ADAPTER    ADAPTER    ADAPTER
              │            │            │
              ▼            ▼            ▼
             APIs         APIs         APIs
                           │
                           ▼
                      PostgreSQL
```

## Core Concepts

### Organization

Represents a company or customer.

### Project

Represents a website or analytics property being analyzed.

### Data Source

Represents a connected analytics provider.

Example:

```text
Organization
└── Project: Humana Website
    ├── Google Analytics
    ├── Microsoft Clarity
    ├── Vercel Analytics
    └── GitHub (its own project, not the website property)
```

### AI Agent

The conversational layer responsible for understanding user questions and selecting the appropriate analytics tools.

### Analytics Tool

A controlled capability exposed to the AI Agent.

Initial tools:

```text
getOverview
getTrafficSources
getTopPages
getEvents
comparePeriods
```

## Data Strategy

The initial GA4 MVP can query the GA4 Data API directly.

As the product evolves, selected analytics data will be collected and persisted in PostgreSQL to provide:

* Historical analysis
* Cross-source analysis
* Faster queries
* Period comparisons
* Trend analysis
* Future anomaly detection

Microsoft Clarity requires particular attention to data collection and historical persistence because of API limitations.

## Security

Analytics credentials and API secrets must remain server-side.

Sensitive credentials must:

* Never be exposed to the client
* Never be included in LLM prompts
* Never be returned by API responses
* Never be logged
* Be encrypted when persisted

## Technology

Initial stack:

* Next.js
* React
* TypeScript
* Tailwind CSS
* PostgreSQL
* Drizzle ORM
* OpenAI API (optional when the Analytics Bot bridge is configured)

The application will initially use the Next.js server environment for backend functionality rather than introducing a separate backend service.

## Analytics Bot bridge

Humana Analytics can answer without an in-app LLM key. When `ANALYTICS_BOT_WEBHOOK_URL` is set, Ask AI stores the user message, marks the conversation pending (`Pensando…` / `Thinking…`), and POSTs the question to the external Grok / Analytics Bot. The bot calls back `POST /api/analytics-bot/reply`, which appends the assistant message in Postgres. The chat UI polls until that reply replaces the pending bubble. OpenAI is used only when the webhook URL is empty and `OPENAI_API_KEY` is set. If neither is set, the UI shows a configuration error and does not invent metrics.

Apply `pnpm db:analytics:migrate` so `conversations.assistant_status` and `messages.reply_to_message_id` exist.

Wire the Grok Bot routine with:

1. Webhook URL = `ANALYTICS_BOT_WEBHOOK_URL` (the bot's inbound URL). If you set `ANALYTICS_BOT_WEBHOOK_SECRET`, Humana sends it as `Authorization: Bearer` and `X-Analytics-Bot-Key`.
2. Reply target = `{APP_URL}/api/analytics-bot/reply` (also included as `replyUrl` on each outbound payload). The bot must send `ANALYTICS_BOT_REPLY_SECRET` as `Authorization: Bearer` or `X-Analytics-Bot-Reply-Secret`.
3. `APP_URL` must be the public Humana Analytics origin, not an internal localhost address, when the bot runs outside this machine.

Outbound payload (Humana Analytics → bot):

```json
{
  "conversationId": "...",
  "messageId": "...",
  "userId": "...",
  "organizationId": "...",
  "projectId": "...",
  "locale": "pt-BR",
  "text": "user question",
  "replyUrl": "https://<app-host>/api/analytics-bot/reply",
  "createdAt": "ISO8601",
  "github": {
    "source": "GitHub",
    "connected": false,
    "error": "missing_token"
  }
}
```

`github` is added on the webhook path so the Analytics Bot can cite stored repository metrics the same way the in-app tools can. When the source is disconnected or the collect has not run, the object carries `connected: false` and the real error, and it does not include counts. Views and clones are sums of recorded snapshot days. Unique views and unique clones are GitHub's 14-day totals, not a sum of daily uniques. Stars, forks, watchers and release downloads are the counter recorded that day. The payload never includes stargazer logins.

`text` is redacted (emails, bearer tokens, GA4 property paths) before it leaves the app. The question itself may be Portuguese or English; `locale` is `en` only when the question reads as English or the client sends `locale`.

Inbound payload (bot → Humana Analytics):

```json
{
  "conversationId": "...",
  "messageId": "...",
  "text": "assistant answer",
  "source": "analytics-bot"
}
```

`messageId` is an optional echo of the user message and makes retries idempotent. Optional `userId`, `organizationId`, and `projectId` must match the conversation when present. Optional `imageUrls` (or `attachments[].url`) are https URLs stored under the answer; image files with a png, jpg, gif, or webp extension render in the assistant bubble. The bot may say it used Clarity or GA4. This app does not scrape those sources on the bridge path.

Callback example:

```bash
curl -sS -X POST "$APP_URL/api/analytics-bot/reply" \
  -H "Authorization: Bearer $ANALYTICS_BOT_REPLY_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"conversationId":"CONVERSATION_ID","messageId":"USER_MESSAGE_ID","text":"Resposta do Analytics Bot. Cite a fonte (Clarity ou GA4) e o período; não invente números.","source":"analytics-bot"}'
```

## Development Principles

### Keep the MVP small

Do not introduce infrastructure or abstractions without a concrete requirement.

### Data before interpretation

The AI Agent must use real analytics data rather than inventing or estimating metrics.

### Controlled tools

The Agent interacts with analytics systems through explicitly defined tools rather than unrestricted access.

### Separation of concerns

Analytics providers, repositories, AI tools and UI should remain independently testable.

### SaaS-ready, not SaaS-complete

The architecture should support future multi-organization usage without prematurely implementing billing, complex permissions or other SaaS infrastructure.

## Roadmap

```text
M1  GA4 + Chat
 ↓
M2  Microsoft Clarity
 ↓
M3  Vercel Analytics
 ↓
M4  Cross-source analysis
 ↓
M5  Insights and anomaly detection
 ↓
M6  Marketing demonstration
 ↓
Future SaaS capabilities
```
