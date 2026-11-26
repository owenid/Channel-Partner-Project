# Auth0 setup for the partner portal demo

This connects the portal to Auth0 (CIAM) as the architecture describes: partners sign in with
Auth0, and the back end verifies every access token and scopes each call by the partner ids in it.
It takes about 15 minutes in the Auth0 dashboard. Order matters only for step 7, which needs the
public URL from Render.

## 1. Tenant

Sign up at auth0.com (free plan is enough) and note the tenant **domain**, e.g.
`your-tenant.uk.auth0.com`.

## 2. API (what the access token is for)

**Applications → APIs → Create API**
- Name: `Partner Portal API` · Identifier: `https://partner-portal-api` (this is the **audience**) · Signing: RS256
- **Settings → RBAC Settings:** turn on **Enable RBAC** and **Add Permissions in the Access Token**
- **Settings → Access Settings:** turn on **Allow Offline Access** (the portal uses refresh tokens)
- **Permissions tab:** add `read:own-quotes` (partner user) and `read:all-quotes` (partner admin)

## 3. Roles

**User Management → Roles**
- `Partner user` → permission `read:own-quotes`
- `Partner admin` → permissions `read:own-quotes` and `read:all-quotes`

## 4. Application (the portal front end)

**Applications → Applications → Create Application → Single Page Web Applications**
- Note the **Client ID**
- **Settings → Refresh Token Rotation:** turn on **Rotation**
- Callback / logout / web-origin URLs: see step 7

## 5. Login Action (adds the partner ids to the token)

**Actions → Library → Create Action → Build from scratch**, trigger **Login / Post Login**, paste
this, **Deploy**, then drag it into the **Login** flow and **Apply**.

```js
exports.onExecutePostLogin = async (event, api) => {
  const ns = 'https://portal/';                       // must match AUTH0_CLAIM_NAMESPACE
  const user = event.user.user_metadata || {};
  const app = event.user.app_metadata || {};
  // Prefer the Auth0 Organization (as in the design); fall back to app_metadata for a simple demo
  const org = event.organization || {};
  const orgMeta = org.metadata || app;
  const set = (k, v) => { if (v !== undefined && v !== null && v !== '') api.accessToken.setCustomClaim(ns + k, String(v)); };

  set('org_id', org.id || user.org_id || app.org_id);
  set('swift_user_id', user.swift_user_id || app.swift_user_id);
  set('servicenow_account_id', orgMeta.servicenow_account_id);
  set('swift_reseller_id', orgMeta.swift_reseller_id);
  set('salesforce_account_id', orgMeta.salesforce_account_id);
  set('partner_name', org.display_name || orgMeta.partner_name);
  set('name', event.user.given_name || event.user.name);
  set('given_name', event.user.given_name);
  set('family_name', event.user.family_name);
  set('email', event.user.email);
  set('role', user.role);
  set('department', user.department);
};
```

## 6. Demo users

**User Management → Users → Create user** (Username-Password-Authentication). For each user:
- **Roles tab:** assign `Partner admin` or `Partner user`
- **Details → Metadata.** Use these values so the user sees the portal's mock data:

`user_metadata`
```json
{ "swift_user_id": "456", "role": "Account Manager", "department": "Accounts" }
```

`app_metadata` (partner ids; or put them on an Auth0 Organization's metadata instead)
```json
{
  "org_id": "org_demo",
  "partner_name": "XYZ Comms",
  "servicenow_account_id": "SN-ACC-0001",
  "swift_reseller_id": "123",
  "salesforce_account_id": "7806000005iLi4XYZ"
}
```

Use `"swift_user_id": "456"` for your main test user. In the mock data, quotes belong to user `456`
and a colleague `457` in reseller `123`, so a **Partner user** sees only their own quotes and a
**Partner admin** sees both.

## 7. Render environment and allowed URLs

After the first Render deploy you have a URL such as `https://channel-partner-portal-demo.onrender.com`.

**In Render → the service → Environment**, set and redeploy:

| Key | Value |
|---|---|
| `AUTH0_DOMAIN` | your tenant domain |
| `AUTH0_AUDIENCE` | `https://partner-portal-api` |
| `VITE_AUTH0_DOMAIN` | your tenant domain |
| `VITE_AUTH0_CLIENT_ID` | the SPA's Client ID |
| `VITE_AUTH0_AUDIENCE` | `https://partner-portal-api` |
| `DEMO_PASSWORD` | leave empty (ignored when Auth0 is set) |

`VITE_*` values are built into the front end, so change them with **Manual Deploy → Clear build
cache & deploy**.

**In Auth0 → the SPA → Settings**, set the Render URL in **Allowed Callback URLs**, **Allowed
Logout URLs** and **Allowed Web Origins** (add `http://localhost:5173` too for local work).

## Optional: Management API

The design reads `user_metadata` and Organization metadata through the Management API. The login
Action above makes that unnecessary for the demo. To use it as designed, create a
**Machine to Machine** application authorised for the Management API with `read:users` and
`read:organizations`, and set `AUTH0_MGMT_CLIENT_ID` / `AUTH0_MGMT_CLIENT_SECRET`.

## Troubleshooting

| Symptom | Cause |
|---|---|
| Loops back to the login page | Render URL missing from Allowed Callback URLs / Web Origins |
| `403 partner_not_linked` | The Action isn't in the Login flow, or the user lacks the metadata in step 6 |
| `403 forbidden` on quotes | User has no role, or RBAC "Add Permissions in the Access Token" is off |
| `401 invalid_token` | `AUTH0_AUDIENCE` / `VITE_AUTH0_AUDIENCE` differ from the API identifier |
