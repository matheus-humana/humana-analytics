# GA4 → PostgreSQL

This is the local path to connect Google Analytics 4, persist core reports in
PostgreSQL, and query them later from the analytics agent.

Credentials stay in environment variables. Domain tables live in the isolated
PostgreSQL schema `analytics` (projects, data sources, OAuth credentials).
GA4 report tables are added next to them. Service-account secrets are never
written to `data_source_credentials`.

## What gets synced

Each run requests four GA4 Data API reports and upserts them by day:

| Report            | Dimensions                         | Metrics                                                                 |
| ----------------- | ---------------------------------- | ----------------------------------------------------------------------- |
| Daily overview    | `date`                             | `activeUsers`, `sessions`, `screenPageViews`, `engagementRate`, `newUsers`, `eventCount`, `keyEvents` |
| Pages             | `date`, `pagePath`, `pageTitle`    | `screenPageViews`, `activeUsers`, `engagementRate`                      |
| Events            | `date`, `eventName`                | `eventCount`, `activeUsers`, `keyEvents`                                |
| Traffic sources   | `date`, `sessionSource`, `sessionMedium` | `activeUsers`, `sessions`                                         |

Default range: the last 7 complete UTC days (yesterday and the 6 days before).

## 1. PostgreSQL

Copy the example env file:

```bash
cp .env.example .env.local
```

Point `DATABASE_URL` at the local database you already have, for example:

```bash
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/humana_analytics
```

Create the database if it does not exist yet:

```sql
CREATE DATABASE humana_analytics;
```

If you prefer a disposable local instance:

```bash
docker compose up -d postgres
```

Apply the schema (creates `analytics` plus GA4 report tables):

```bash
pnpm db:migrate
# or: pnpm db:analytics:migrate
```

Tables in schema `analytics`:

- Domain: `projects`, `data_sources`, `data_source_credentials`
- Metrics: `analytics_daily`, `analytics_pages`, `analytics_events`, `analytics_traffic_sources`
- Ops: `analytics_sync_runs`

The first successful sync bootstraps a local project/data source from
`PROJECT_NAME` and `GA4_PROPERTY_ID`.

## 2. Google Cloud and GA4 credentials

You need all of the following. Do not commit key files or paste real secrets
into the repo.

### Google Cloud project

1. Open [Google Cloud Console](https://console.cloud.google.com/).
2. Select or create a project.
3. Enable **Google Analytics Data API**.

### Service account

1. IAM & Admin → Service Accounts → Create service account.
2. Name it something like `ga4-reader`. Roles on the GCP project are not required
   for the Analytics Data API; access is granted on the GA4 property.
3. Keys → Add key → Create new key → JSON.
4. Save the file outside git, for example `secrets/ga4-service-account.json`.

The JSON contains `client_email` and `private_key`. Those are the only secret
fields this app reads.

### Grant the service account access to the GA4 property

1. Open [Google Analytics](https://analytics.google.com/).
2. Admin → Property access management.
3. Add the service-account email (`...@....iam.gserviceaccount.com`).
4. Role: **Viewer** is enough.

If this step is skipped, the API returns `PERMISSION_DENIED`.

### Property ID

Admin → Property details → **Property ID**.

It is numeric, for example `123456789`. You can set either:

```bash
GA4_PROPERTY_ID=123456789
```

or

```bash
GA4_PROPERTY_ID=properties/123456789
```

## 3. Environment variables

Choose **one** credential option.

### Option A — JSON key file (recommended locally)

```bash
GA4_PROPERTY_ID=123456789
GOOGLE_APPLICATION_CREDENTIALS=./secrets/ga4-service-account.json
```

### Option B — JSON string

```bash
GA4_PROPERTY_ID=123456789
GA4_SERVICE_ACCOUNT_JSON={"type":"service_account","project_id":"...","private_key":"-----BEGIN PRIVATE KEY-----\\n...\\n-----END PRIVATE KEY-----\\n","client_email":"...@....iam.gserviceaccount.com"}
```

### Option C — Split fields

```bash
GA4_PROPERTY_ID=123456789
GA4_CLIENT_EMAIL=ga4-reader@your-gcp-project.iam.gserviceaccount.com
GA4_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
GOOGLE_CLOUD_PROJECT=your-gcp-project
```

Optional:

| Variable              | Purpose                                              |
| --------------------- | ---------------------------------------------------- |
| `ORGANIZATION_NAME`   | Local org name used on first sync (default Humana AI) |
| `PROJECT_NAME`        | Local project name (default Humana Website)          |
| `SYNC_SECRET`         | If set, `POST /api/sync/ga4` requires this value     |
| `ALLOW_GA4_FIXTURE`   | Set `true` to allow the HTTP endpoint to load sample data |

## 4. Run the sync

Validate credentials (calls GA4, does not write):

```bash
pnpm ga4:validate
```

Persist the last 7 complete days:

```bash
pnpm ga4:sync
```

Other useful invocations:

```bash
pnpm ga4:sync --days 30
pnpm ga4:sync --start 2026-09-01 --end 2026-09-20
pnpm ga4:sync --dry-run
pnpm ga4:sync --fixture
```

`--fixture` writes `fixtures/ga4-sample.json` into Postgres. Use it to verify
the database path before the Google credentials are ready.

## 5. Query persisted data

Start the app:

```bash
pnpm dev
```

- UI: [http://localhost:3000](http://localhost:3000)
- Metrics JSON: `GET /api/metrics?days=7`
- Manual sync: `POST /api/sync/ga4`

If `SYNC_SECRET` is set:

```bash
curl -X POST http://localhost:3000/api/sync/ga4 \
  -H "content-type: application/json" \
  -H "x-sync-secret: $SYNC_SECRET" \
  -d '{"days":7}'
```

Repository helpers for a later AI agent live in `src/lib/analytics/index.ts`:

- `getOverview`
- `getTrafficSources`
- `getTopPages`
- `getEvents`
- `comparePeriods`

They read PostgreSQL, not the live GA4 API.

## Troubleshooting

| Symptom | Likely cause |
| --- | --- |
| `DATABASE_URL is required` | `.env.local` is missing or the CLI did not load it |
| `GA4_PROPERTY_ID is required` | Property ID not set |
| `Missing GA4 credentials` | None of the three credential options is set |
| `PERMISSION_DENIED` | Service-account email is not a Viewer on the GA4 property, or the Analytics Data API is disabled |
| `Could not read GOOGLE_APPLICATION_CREDENTIALS` | File path is wrong or the JSON is invalid |
| HTTP fixture sync rejected | Set `ALLOW_GA4_FIXTURE=true` or use `pnpm ga4:sync --fixture` |
