# Easy Auth (App Service Authentication) Setup

This application supports three authentication modes, configured via the `AUTHENTICATION_MODE` environment variable:

| Mode | Value | Description |
|---|---|---|
| No authentication | `none` | No authentication required (default) |
| Built-in MSAL | `builtin` | Application manages OAuth2/OIDC via MSAL (original behavior) |
| Easy Auth | `easyauth` | Azure App Service handles authentication at the platform level |

> **Backward compatibility:** If `AUTHENTICATION_MODE` is not set but `ENABLE_AUTHENTICATION=true`, the mode defaults to `builtin`.

## Setting Up Easy Auth with Entra ID

### 1. Register an Application in Entra ID

If you don't already have an app registration for this web app:

1. Go to **Azure Portal** → **Microsoft Entra ID** → **App registrations** → **New registration**
2. Set **Name** to your app name
3. Set **Redirect URI** to `https://<your-app-name>.azurewebsites.net/.auth/login/aad/callback`
4. Note the **Application (client) ID** and **Directory (tenant) ID**

### 2. Configure API Permissions

To enable group membership lookup via Graph API:

1. In the app registration, go to **API permissions** → **Add a permission**
2. Select **Microsoft Graph** → **Delegated permissions**
3. Add `User.Read` and `GroupMember.Read.All`
4. Click **Grant admin consent** for your tenant

### 3. Enable App Service Authentication

1. Go to **Azure Portal** → your **App Service** → **Authentication**
2. Click **Add identity provider**
3. Select **Microsoft** as the identity provider
4. Configure:
   - **App registration type**: Pick an existing app registration (or create a new one)
   - **Application (client) ID**: Use the ID from step 1
   - **Client secret**: Set in the App Service Authentication config (not in Key Vault — Easy Auth manages this)
   - **Issuer URL**: `https://login.microsoftonline.com/<tenant-id>/v2.0`
   - **Allowed token audiences**: `api://<client-id>` (if using a custom scope)
5. Set **Restrict access** to **Require authentication** (this prevents unauthenticated requests from reaching your app)
6. Set **Unauthenticated requests** to **HTTP 302 Found redirect: recommended for web applications**
7. Click **Add**

### 4. Enable the Token Store

The token store is required so that Easy Auth provides the `X-MS-TOKEN-AAD-ACCESS-TOKEN` header, which this app uses to call the Graph API for group membership.

1. In **Authentication** settings, go to **Edit** on the Microsoft provider
2. Ensure **Token store** is set to **On** (this is the default)

Alternatively, via Azure CLI:

```bash
az webapp auth update \
  --resource-group <resource-group> \
  --name <app-name> \
  --token-store true
```

### 5. Configure the Application

Set the following App Service application setting:

```
AUTHENTICATION_MODE=easyauth
```

Remove or leave unset: `ENABLE_AUTHENTICATION`, `CLIENT_ID`, `AUTHORITY`, `REDIRECT_PATH` — these are only used in `builtin` mode.

The following settings are still relevant in `easyauth` mode:

| Setting | Purpose |
|---|---|
| `AUTHENTICATION_MODE` | Set to `easyauth` |
| `FORWARD_ACCESS_TOKEN_TO_ORCHESTRATOR` | If `true`, the user's AAD access token (from `X-MS-TOKEN-AAD-ACCESS-TOKEN`) is forwarded to the orchestrator |
| `ALLOWED_GROUP_NAMES` | Comma-separated list of Entra ID group names allowed access |
| `ALLOWED_USER_PRINCIPALS` | Comma-separated list of allowed user object IDs |
| `ALLOWED_USER_NAMES` | Comma-separated list of allowed user principal names |

## How It Works

When `AUTHENTICATION_MODE=easyauth`:

1. **Authentication** is handled entirely by the App Service platform. Unauthenticated users are redirected to the Entra ID login page before any request reaches the Flask app.

2. **Identity headers** are injected by App Service on every authenticated request:
   - `X-MS-CLIENT-PRINCIPAL-ID` — the user's Entra ID object ID (OID)
   - `X-MS-CLIENT-PRINCIPAL-NAME` — the user's UPN or email
   - `X-MS-TOKEN-AAD-ACCESS-TOKEN` — the user's access token (requires token store)

3. **Group membership** is resolved by calling the Microsoft Graph API (`/me/memberOf`) using the access token from the `X-MS-TOKEN-AAD-ACCESS-TOKEN` header — the same approach used in `builtin` mode.

4. **Authorization** uses the same `ALLOWED_GROUP_NAMES`, `ALLOWED_USER_PRINCIPALS`, and `ALLOWED_USER_NAMES` settings as other modes.

5. **Orchestrator payload** is unchanged — `client_principal_id`, `client_principal_name`, `client_group_names`, and optionally `access_token` are sent in the same format regardless of auth mode.

6. **Logout** redirects to `/.auth/logout`, which is handled by the App Service platform.

## Security Notes

- Easy Auth **strips `X-MS-*` headers from external requests** — only the platform can set them, so they are trustworthy within the App Service environment.
- The `X-MS-TOKEN-AAD-ACCESS-TOKEN` is a delegated user token. If `FORWARD_ACCESS_TOKEN_TO_ORCHESTRATOR` is enabled, the orchestrator can independently validate this token to verify user identity.
- Easy Auth does **not** work in local development. Use `AUTHENTICATION_MODE=builtin` or `AUTHENTICATION_MODE=none` when developing locally.

## Comparison of Authentication Modes

| Aspect | `none` | `builtin` | `easyauth` |
|---|---|---|---|
| Login flow | None | App manages via MSAL | App Service platform |
| Token management | None | App manages refresh via MSAL | Platform manages tokens |
| Client secret | Not needed | Stored in Key Vault | Managed by App Service config |
| Flask session for auth | Not used | Required (stores user/tokens) | Not used |
| Group lookup | None | Graph API via MSAL token | Graph API via Easy Auth token |
| Local development | Works | Works | **Not available** — use `builtin` or `none` locally |
| `/login`, `/logout` routes | Redirect to index | Active (MSAL flow) | `/logout` redirects to `/.auth/logout` |
