# Analytics AI

Analytics AI is an AI-powered analytics environment that allows users to connect analytics platforms and interact with their data through natural language.

The initial version focuses on Google Analytics 4, with Microsoft Clarity and Vercel Analytics planned as additional data sources.

## Local setup

The first working slice persists core GA4 reports in PostgreSQL. Full credential
and property setup is in [docs/GA4.md](docs/GA4.md).

```bash
pnpm install
cp .env.example .env.local
# set DATABASE_URL, GA4_PROPERTY_ID, and one GA4 credential option
pnpm db:migrate
pnpm ga4:validate
pnpm ga4:sync
pnpm dev
# open /dashboard and /data-sources
```

If Google credentials are not ready yet, verify the database path with sample data:

```bash
pnpm ga4:sync --fixture
```

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
  └── Vercel Analytics
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

| Provider           | Purpose                                  | Status  |
| ------------------ | ---------------------------------------- | ------- |
| Google Analytics 4 | Analytics, acquisition, events and pages | MVP     |
| Microsoft Clarity  | User behavior and interaction signals    | Planned |
| Vercel Analytics   | Web analytics and events                 | Planned |

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
             GA4        CLARITY       VERCEL
           ADAPTER       ADAPTER       ADAPTER
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
    └── Vercel Analytics
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

The local collector already persists selected GA4 reports in PostgreSQL. The
chat agent can later read those tables instead of calling GA4 on every question.

As the product evolves, this persisted data supports:

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
* OpenAI API

The application will initially use the Next.js server environment for backend functionality rather than introducing a separate backend service.

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
