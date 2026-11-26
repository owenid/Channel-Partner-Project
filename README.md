# Channel Partner Portal

React front end + Node/Express back end (backend-for-frontend) for the Giganet channel partner
portal, built from the UI/UX samples and the Confluence design documents.

```
Portal front end (web/)  ── Auth0 login ──►  Auth0 (CIAM)
        │  Bearer access token
        ▼
Portal back end (server/)  /api/v1/...  verifies the token, resolves the partner from Auth0
   ├── Auth0 Management API  user_metadata (org_id, swift_user_id, role…) + organization metadata
   ├── CMS (Drupal JSON:API) newsletters, offers, resources
   ├── GIG / SWIFT           addresses, quotes, quote history, appointments, orders, order comments
   ├── ServiceNow            GN Orders scripted API (order list/detail), live services, support cases
   ├── Confluent ksqlDB      order status updates stream (status bar + update history)
   └── Salesforce            account manager / channel support contacts
```

## Run locally

Requires Node 20+.

```bash
npm install
npm run dev:server   # http://localhost:4000  (health: /health)
npm run dev:web      # http://localhost:5173  (proxies /api to :4000)
```

With no configuration every upstream serves **mock data** and the back end uses a built-in dev
user (a partner admin), so every journey works end to end without credentials.
`GET /health` shows which systems are `mock` vs `live`. To see the partner-user view, start the
server with `DEV_USER_PERMISSIONS=read:own-quotes`.

## Public demo (Render)

`render.yaml` deploys the portal as one web service: the back end serves the built front end.

1. In the Render dashboard choose **New → Blueprint** and pick this repository.
2. When asked, set **`DEMO_PASSWORD`**. Visitors then get a browser sign-in prompt (user `demo`).
   Without Auth0 every visitor is the built-in test admin, so keep the password set on any public URL.
3. Render builds with `npm ci --include=dev && npm run build` and starts with `npm start`.

The demo runs entirely on mock data. Free Render services sleep when idle, so the first request
after a while can take about a minute. Production build locally: `npm run build`, then
`DEMO_PASSWORD=... npm start` (serves on `PORT`, default 4000).

## Design documents implemented

| Design | Portal API (`/api/v1`) | Upstream |
|---|---|---|
| Home Page Menu | `GET /portal/newsletter`, `GET /portal/offers`, `GET /partner/quotes?limit=10&sort=date&order=desc&summary=true`, `GET /portal/profile`, `GET /portal/contacts` | CMS `/drupalwebsite/jsonapi/node/newsletters` + `/offers`; GIG history; Auth0 user metadata; Salesforce |
| Check FTTP Availability | `POST /postcodes/{postcode}`, `POST /partner/quotes` | GIG `POST /api/postcodes/{postcode}`, `POST /api/v1/partner/quotes/` |
| Retrieve Quotes | `GET /partner/quotes` (My Quotes, filters, CSV), `GET /partner/quotes/{quote_ulid}` | GIG `/api/v1/partner/quotes/{swift_user_id}` (partner user) or `/{swift_reseller_id}` (partner admin), `/{quote_ulid}` |
| Engineer Appointments and Reservation | `GET /partner/fttp/appointments`, `POST /partner/fttp/appointments` | GIG `/api/v1/partner/fttp/appointments` |
| Order Placement | `POST /partner/fttp/orders` (reserves the slot, then orders), amend date / contact, cancel | GIG `/api/v1/partner/fttp/orders`, `…/end_customer_contact`, `…/cancel` |
| Orders Placed View | `GET /orders`, `GET /orders/{ref}`, `POST /orders/{id}/comments` | ServiceNow `/api/sn_ind_tmt_orm/orders` (`summary=true/false`), GIG `/api/v1/partner/fttp/orders/comment` |
| Order Status Updates | `GET /order-updates` (+ `/options`), status bar on order detail | ksqlDB `POST /query` on `SERVICENOW_ORDER_UPDATES_STREAM` |

Roles: partner users need `read:own-quotes` and see only their own quotes; partner admins have
`read:all-quotes` and see every quote in their organisation (Auth0 RBAC permissions in the token).

The order status bar follows the design's rules (`lib/orderPath.ts`): normal path
(Order placed → Order processing → Installation scheduled → Order completed) plus the rejected,
cancelled, delayed and on-hold paths.

## Configuration

Copy `server/.env.example` to `server/.env` and `web/.env.example` to `web/.env`. Each upstream
switches from mock to live when its URL/credentials are set. `.env` files are git-ignored.

| System | Settings |
|---|---|
| Auth0 | `AUTH0_DOMAIN`, `AUTH0_AUDIENCE`, `AUTH0_MGMT_CLIENT_ID/SECRET` (+ `VITE_AUTH0_*` in web) |
| CMS | `CMS_BASE_URL`, `CMS_API_TOKEN`, `CMS_NEWSLETTERS_PATH`, `CMS_OFFERS_PATH` |
| GIG / SWIFT | `GIG_BASE_URL`, `GIG_API_KEY`, `GIG_USER_HISTORY_PATH`, `GIG_RESELLER_HISTORY_PATH` |
| ServiceNow | `SN_INSTANCE_URL`, `SN_CLIENT_ID`, `SN_CLIENT_SECRET`, `SN_API_PATH` |
| ksqlDB | `KSQL_ENDPOINT`, `KSQL_API_KEY`, `KSQL_API_SECRET`, `KSQL_STREAM` |
| Salesforce | `SF_INSTANCE_URL`, `SF_CLIENT_ID`, `SF_CLIENT_SECRET` |

## Open questions from the designs

1. ~~**ksqlDB `partner_id`**~~ – resolved: it is the partner's **Salesforce account id**
   (`salesforce_account_id` in the Auth0 organization metadata), as the example data shows. The
   Order Status Updates text naming `servicenow_account_id` should be corrected.
2. **GIG history paths** – Retrieve Quotes uses `/api/v1/partner/quotes/{id}` for user history,
   reseller history and quote detail, and the overview mentions `/quotes/history`. Paths are
   configurable until GIG confirms.
3. **Appointments request** – the design sends a GET *with a JSON body*, which HTTP clients can't
   do; the back end sends the same fields as query parameters.
4. **Hide quote** – shown in the My Quotes wireframe but no endpoint is documented; assumed
   `PATCH /api/v1/partner/quotes/{id} { hide_quote }`.
5. **Quote history has no `customer_ip`**, so the "Search IP" filter can't be applied yet.
6. **CMS field names** – the design gives the portal response shape, not Drupal's; the adapter
   accepts plain or `field_`-prefixed JSON:API attributes.
7. **ServiceNow orders response fields** beyond the documented UI mapping are assumed
   (`adapters/orders.ts`). The design also describes a table-API chain
   (customer_account → order → order line → cmn_location → product offering → stage); the
   scripted endpoint is used instead.
8. **Live services and support cases** still have no design; their ServiceNow contract is assumed.
9. The newsletter example uses both `start_date` and `newsletter_start_date`; both are accepted.

## Back-end design notes

- Write calls to GIG (create quote, reserve, place order, cancel) are never retried
  automatically, so a timeout can't create a duplicate order. Read calls retry with backoff.
- GIG business errors (`{ code, reason }`, e.g. "Product not available") are passed to the UI.
- Every upstream call is scoped to the partner resolved from Auth0; ids sent by the browser are
  never trusted. Order and quote lookups double as ownership checks.
- ksqlDB queries escape string literals; CSV exports guard against spreadsheet formula injection.

## Screens

Home · Quotes (New quote, My quotes, quote detail → quote summary → place order) · Connections
(orders, order updates, live service, support cases) · Order detail (status bar, amend date via
appointment slots, amend contact, cancel, comments) · Live service detail (modify, suspend,
cease, session history) · Support case detail · Resources.
