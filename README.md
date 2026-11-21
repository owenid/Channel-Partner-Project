# Channel Partner Portal

React front end + Node/Express back end (backend-for-frontend) for the Giganet channel partner portal.

```
Portal front end (web/)  ──Auth0 login──►  Auth0 (CIAM)
        │  Bearer access token (user_id, org_id, servicenow_account_id)
        ▼
Portal back end (server/)  ── verifies token, scopes every call by the claims
   ├── CMS         newsletters, offers, resource guides
   ├── SWIFT       recent quotes, quote history, product summary
   ├── Salesforce  account profile, account owner / service manager / sales support
   └── ServiceNow  orders, order updates, live services, support cases   (assumed - see below)
```

## Run locally

Requires Node 20+.

```bash
npm install
npm run dev:server   # http://localhost:4000  (health: /health)
npm run dev:web      # http://localhost:5173  (proxies /api to :4000)
```

With no configuration, every upstream system serves **mock data** and the back end uses a
built-in dev user, so the whole portal runs end to end without credentials.
`GET /health` shows which systems are `mock` vs `live`.

## Configuration

Copy `server/.env.example` to `server/.env` and `web/.env.example` to `web/.env`.
Each upstream switches from mock to live as soon as its base URL / credentials are set.
Never commit `.env` files (they are git-ignored).

| System | Settings | Auth |
|---|---|---|
| Auth0 | `AUTH0_DOMAIN`, `AUTH0_AUDIENCE`, `AUTH0_CLAIM_NAMESPACE` (+ `VITE_AUTH0_*` in web) | JWT verified against the tenant JWKS |
| CMS | `CMS_BASE_URL`, `CMS_API_TOKEN` | Bearer token |
| SWIFT | `SWIFT_BASE_URL`, `SWIFT_API_KEY` | Bearer token |
| Salesforce | `SF_INSTANCE_URL`, `SF_CLIENT_ID`, `SF_CLIENT_SECRET`, `SF_SERVICENOW_ACCOUNT_FIELD` | OAuth2 client credentials |
| ServiceNow | `SN_INSTANCE_URL`, `SN_CLIENT_ID`, `SN_CLIENT_SECRET`, `SN_API_PATH` | OAuth2 client credentials |

### Auth0 claims

Add an Auth0 Action (post-login) that puts these on the **access token**, namespaced with
`AUTH0_CLAIM_NAMESPACE` (default `https://portal/`):
`user_id`, `org_id`, `servicenow_account_id` (plus `name`, `email` for display).
`org_id` also falls back to Auth0's standard Organizations claim. Requests missing any of
the three are rejected with 403. Ids sent by the browser are never trusted.

## Assumptions to confirm

Each adapter in `server/src/adapters/` documents the API contract it assumes at the top of
the file. They are the only files to change once the real API specs are available:

- **CMS / SWIFT** - endpoint paths and field names are placeholders.
- **Salesforce** - partner Account is matched on a custom field holding the ServiceNow
  account id; Service Manager and Sales Support Executive are assumed custom User lookups.
- **ServiceNow** - the architecture diagram doesn't name the system of record for orders,
  live services and support cases. Because the token carries `servicenow_account_id`, the
  back end assumes a ServiceNow Scripted REST API that returns portal-shaped JSON and
  enforces account ownership on its side as well.

## Back-end design notes

- One `GET /api/dashboard` call feeds the home page; each widget succeeds or fails
  independently so one slow system doesn't blank the page.
- Upstream calls have timeouts, retries with backoff (network errors, 429, 5xx) and short
  in-memory caching (`server/src/lib`).
- Write actions (amend appointment / contact, cancel order, cease service, comments,
  create case) are validated server-side; cancel/cease reasons come from a fixed list.
- CSV exports (`/api/orders.csv`, `/order-updates.csv`, `/services.csv`, `/cases.csv`)
  respect the current filters and guard against spreadsheet formula injection.

## Screens

Home dashboard · Resources (quick guides / legal / training) · Connections (orders, order
updates, live service, support cases) · Order detail (amend date, amend contact, cancel,
comment) · Live service detail (modify / upgrade-downgrade with effective mode, suspend /
unsuspend, cease, radius session history - each action has a confirmation step) ·
Support case detail (respond) ·
Create support case. Quotes pages are not designed yet and currently route to Home.
