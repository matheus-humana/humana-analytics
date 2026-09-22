# Move Google OAuth and GA4 from a personal GCP project to the company project

Use this when the OAuth client and the GA4 service account still live in a personal Google Cloud project and need to move to the Humana company project. Do the work in the company project first, then cut over environment variables. Do not commit keys, client secrets, or service-account JSON.

## Checklist

1. In the company Google Cloud project, enable **Google Analytics Data API**.
2. Configure the OAuth consent screen.
   - Prefer **Internal** if the company uses Google Workspace and only Humana accounts should sign in.
   - Scopes for this app: `openid`, `email`, `profile`, and `https://www.googleapis.com/auth/analytics.readonly`.
   - Login uses OpenID only. The Analytics scope is only for the separate “Connect Google Analytics” flow in Data Sources.
3. Create a **Web application** OAuth client in the company project.
4. Add both authorized redirect URIs (local and production, as needed):
   - `{APP_URL}/api/auth/callback/google` — Auth.js sign-in
   - `{APP_URL}/api/auth/google/callback` — GA4 data-source connection (`GOOGLE_REDIRECT_URI`)
5. Copy the new client id and secret into server environment only:
   - `GOOGLE_CLIENT_ID`
   - `GOOGLE_CLIENT_SECRET`
   - `GOOGLE_REDIRECT_URI`
   - `AUTH_URL` (same origin as `APP_URL`)
   - `AUTH_SECRET` (long random string; do not reuse a token from Google)
6. Create a service account in the company project for GA4 reads.
7. Download the JSON key once. Store it as `GOOGLE_SERVICE_ACCOUNT_JSON` or a file referenced by `GOOGLE_SERVICE_ACCOUNT_KEY_PATH`. Never commit the file.
8. In GA4 Admin, grant that service account **Viewer** on the Humana website property. Set `GA4_PROPERTY_ID` to the numeric property id.
9. Deploy or restart with the new env vars. Sign in with Google, open Data Sources, and confirm GA4, Clarity, and Vercel show the expected connection state.
10. Ask Humana Analytics one question per source (traffic, Clarity friction, Vercel visitors). Answers must cite the period and the source.
11. Remove the old personal OAuth client and service-account key after the company credentials work.
12. In Google Account permissions, revoke the personal app’s access so old refresh tokens stop working.

## What stays out of the client and the model

- OAuth client secret, Auth.js secret, service-account JSON, and API tokens stay in server environment variables.
- User email is stored in Postgres for sign-in and is not returned by the session API or sent to the model.
- GA4 refresh tokens, when used, stay encrypted in `data_source_credentials`. Auth.js does not store Google access or refresh tokens for login.
