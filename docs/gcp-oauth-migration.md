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
9. Deploy or restart with the new env vars. Sign in with a company Google account, open Data Sources, and confirm GA4, GitHub, and the SEO/GEO crawl show the expected connection state. Clarity and Vercel are not part of the product UI.
10. Ask Humana Analytics one question about GA4 traffic. The answer must cite the period and Google Analytics 4.
11. Remove the old personal OAuth client and service-account key after the company credentials work.
12. In Google Account permissions, revoke the personal app’s access so old refresh tokens stop working.

## What stays out of the client and the model

- OAuth client secret, Auth.js secret, service-account JSON, and API tokens stay in server environment variables.
- User email is stored in Postgres for sign-in and is not returned by the session API or sent to the model.
- GA4 refresh tokens, when used, stay encrypted in `data_source_credentials`. Auth.js does not store Google access or refresh tokens for login.

## Team sign-in

The app does not know how the Google Cloud consent screen is configured. These are the cases, not a statement of the current project.

Sign-in allows a verified Google email whose domain is in `AUTH_ALLOWED_DOMAINS`. When that variable is unset, the domains are `humana.ai` and `humana-ai.com`. A new user is created in Postgres and attached to the Humana organization and its website project. Accounts outside those domains see “access denied” and are not created.

1. Open the company Google Cloud project → **APIs & Services** → **OAuth consent screen**.
2. **User type**
   - **Internal**: only people in that Google Workspace can pass Google’s screen. Use this when every colleague (both `humana.ai` and `humana-ai.com`, if they are the same Workspace or a trusted domain) is in that Workspace. People outside the Workspace cannot sign in, even if the app would have allowed the domain. There is no test-user list and no “publish” step.
   - **External**: any Google account can reach the app, and the app then rejects domains that are not allowed. While the app is in **Testing**, only **Test users** listed on the consent screen can sign in (100 users). Add each colleague’s Google address, or **Publish** the app so the test-user list is not required. Publishing an app that only asks for `openid`, `email` and `profile` usually does not need Google’s verification review. The separate GA4 connect flow uses `analytics.readonly`; if that scope is on the same consent screen, publishing can require verification. Login itself does not request that scope.
3. **Authorized redirect URIs** on the Web client, for each origin you use:
   - `https://humana-analytics.vercel.app/api/auth/callback/google`
   - `https://humana-analytics.vercel.app/api/auth/google/callback` (GA4 connect, not login)
   - the same two paths on `http://localhost:3000` if you sign in locally
4. Confirm `AUTH_URL` is the public origin (`https://humana-analytics.vercel.app`) and `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` (or `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET`) match this client.
5. Ask a colleague to open the app, choose their company Google account, and land on the Humana workspace. An account such as Gmail should see the denied message on the login card.

