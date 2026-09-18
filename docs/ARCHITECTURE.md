# Analytics AI — Architecture

## 1. Architectural Goal

Analytics AI is designed as an independent application that initially serves Humana AI's internal analytics needs and can later evolve into a multi-organization SaaS product.

The application must allow an organization to connect one or more analytics providers and interact with their data through an AI Agent.

## 2. High-Level Architecture

```text
┌──────────────────────────────────────────────┐
│                   FRONTEND                   │
│                                              │
│ Projects • Data Sources • Chat • Settings   │
└───────────────────────┬──────────────────────┘
                        │
                        ▼
┌──────────────────────────────────────────────┐
│                APPLICATION                   │
│                                              │
│ Authentication • Projects • Connections      │
│ Chat API • Data Source Management            │
└───────────────┬──────────────────┬───────────┘
                │                  │
                ▼                  ▼
┌───────────────────────┐   ┌──────────────────┐
│   ANALYTICS LAYER     │   │     AI LAYER     │
│                       │   │                  │
│ Provider Adapters     │   │ Agent            │
│ Repository            │   │ Tools            │
└───────────┬───────────┘   └────────┬─────────┘
            │                        │
            └───────────┬────────────┘
                        ▼
                ┌───────────────┐
                │  PostgreSQL   │
                └───────────────┘
```

## 3. Application Structure

The application uses Next.js App Router.

Proposed structure:

```text
src/
│
├── app/
│   ├── (auth)/
│   ├── projects/
│   ├── chat/
│   │
│   └── api/
│       ├── chat/
│       ├── projects/
│       └── connections/
│
├── components/
│   ├── chat/
│   ├── projects/
│   ├── data-sources/
│   └── ui/
│
├── lib/
│   ├── ai/
│   │   ├── agent.ts
│   │   ├── tools/
│   │   └── prompts/
│   │
│   ├── analytics/
│   │   ├── ga4/
│   │   ├── clarity/
│   │   ├── vercel/
│   │   └── repository/
│   │
│   ├── auth/
│   ├── db/
│   └── utils/
│
└── types/
```

Not every directory should be created immediately. The implementation should grow with each milestone.

## 4. Domain Model

The core relationship is:

```text
User
 │
 ▼
Organization
 │
 ▼
Project
 │
 ▼
Data Source
```

An organization may contain multiple projects.

A project may contain multiple analytics data sources.

Example:

```text
Humana AI
│
└── Humana Website
    ├── Google Analytics
    ├── Microsoft Clarity
    └── Vercel Analytics
```

## 5. Initial Database Model

The initial domain requires:

```text
users
organizations
organization_members
projects
data_sources
data_source_credentials
conversations
messages
```

Analytics-specific tables will be introduced when historical data persistence becomes part of the product.

Potential future structures:

```text
analytics_daily
analytics_pages
analytics_events
analytics_traffic_sources
clarity_metrics
```

The database should store only data required by product functionality rather than attempting to replicate an external analytics platform.

## 6. Data Sources

A data source represents a connection between a project and an external analytics provider.

Conceptually:

```text
data_sources
-------------------------
id
project_id
provider
name
external_id
status
created_at
updated_at
```

Supported providers:

```text
google_analytics
microsoft_clarity
vercel_analytics
```

Credentials are stored separately.

## 7. Provider Adapter Pattern

The Agent must not communicate directly with provider-specific APIs.

Instead:

```text
AI Tool
   ↓
Repository
   ↓
Provider Adapter
   ↓
External API
```

Example:

```text
getOverview()
    ↓
analyticsRepository.getOverview()
    ↓
ga4Adapter.getOverview()
    ↓
Google Analytics Data API
```

This keeps provider-specific implementation isolated.

## 8. AI Agent

The Agent is responsible for:

1. Understanding the user's question.
2. Identifying the required information.
3. Selecting the appropriate tool.
4. Providing required parameters such as date ranges.
5. Receiving tool results.
6. Producing a clear response.

The Agent is not responsible for:

* Direct database access
* Managing credentials
* Implementing provider APIs
* Arbitrary SQL execution
* Inventing unavailable metrics

## 9. Initial Tools

### getOverview

Provides general metrics:

```text
activeUsers
sessions
screenPageViews
engagementRate
```

### getTrafficSources

Provides acquisition information:

```text
sessionSource
sessionMedium
activeUsers
sessions
```

### getTopPages

Provides page performance:

```text
pagePath
pageTitle
screenPageViews
activeUsers
engagementRate
```

### getEvents

Provides event information:

```text
eventName
eventCount
activeUsers
```

### comparePeriods

Compares equivalent periods and calculates changes.

Example:

```text
Current:
2026-09-11 → 2026-09-17

Previous:
2026-09-04 → 2026-09-10
```

## 10. Date Range Handling

Natural-language periods should be converted into a normalized internal representation.

Examples:

```text
yesterday
today
last 7 days
this week
last week
this month
last 30 days
```

become:

```text
{
  startDate,
  endDate
}
```

Date interpretation should be centralized rather than implemented separately by each tool.

## 11. Chat Flow

Example:

```text
User
 │
 │ "How many users did we have this week?"
 ▼
Chat API
 │
 ▼
AI Agent
 │
 ▼
getOverview()
 │
 ▼
Repository
 │
 ▼
GA4 Adapter
 │
 ▼
GA4 API
 │
 ▼
Analytics Result
 │
 ▼
AI Agent
 │
 ▼
Response
```

The response should include the relevant period and, where useful, the source.

## 12. Data Collection

The initial MVP may query GA4 directly.

Later, scheduled collectors will persist selected data:

```text
Scheduler
    ↓
Collector
    ↓
Provider API
    ↓
Normalization
    ↓
PostgreSQL
```

This becomes particularly important for Microsoft Clarity because its API has limited historical access and request volume.

## 13. Security Boundaries

The system must maintain strict boundaries:

```text
Browser
   ✕
   │
   │ no provider secrets
   │
Server
   │
   ├── credentials
   ├── provider APIs
   ├── database
   └── AI Agent
```

Provider credentials and AI API keys remain server-side.

Credentials should be encrypted when persisted.

## 14. Multi-Organization Readiness

The architecture uses:

```text
organization_id
project_id
data_source_id
```

as core ownership boundaries.

Every analytics operation must be scoped to the currently authorized project.

The initial MVP does not require a sophisticated role or billing system.

However, data isolation must be designed correctly from the beginning.

## 15. Architectural Principles

### 1. Simple first

Prefer the simplest architecture capable of solving the current milestone.

### 2. Real data

The Agent must rely on actual analytics data.

### 3. Explicit tools

The Agent uses controlled capabilities rather than unrestricted access.

### 4. Provider isolation

External APIs remain behind adapters.

### 5. Data ownership

Each data source belongs to a project, and each project belongs to an organization.

### 6. Incremental persistence

Do not build a complete analytics warehouse before it is required.

### 7. SaaS-ready

Prepare the domain for multiple organizations without implementing unnecessary SaaS infrastructure.

## 16. Evolution

```text
M1
GA4 → Agent → Chat

M2
Clarity → Collector → PostgreSQL → Agent

M3
Vercel → Agent

M4
Cross-source analysis

M5
Historical trends
Anomaly detection
Automated insights

M6
Internal Marketing demonstration

Future
Multi-tenant SaaS
User management
Roles
Billing
Customer onboarding
Automated reports
Alerts
```
