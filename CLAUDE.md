# CLAUDE.md

Internal Microsoft 365 self-service portal for the Ayuntamiento de Aranda de Duero: Express 5 + EJS, signed in with Entra ID (MSAL), data from Microsoft Graph. UI text and the README are Spanish; code, comments, logs and this file are English.

## Never touch `.env`

`.env` holds the real credentials and is not in git, so nothing can restore it. Do not write, overwrite, move, delete or regenerate it, and do not read or print its values. This covers every indirect route too: shell redirection (`> .env`), `cp`/`mv` onto it, scripts, test setup and "temporary" swaps. A command that needs a different environment gets it from variables on the command line or from a file outside the project.

- Tests never read it: `test/helpers/env.js` sets `NODE_ENV=test`, and the app skips `dotenv` in that mode. Keep it that way; `test/routes.test.js` fails if the app loads `.env` during tests.
- When running commands against a copy of the project, use absolute paths for anything written, and never rely on a `cd` having succeeded.
- New settings go in `.env.example` and the README. Ask the user to add them to their own `.env`.

## Commands

```bash
npm run dev                                   # nodemon, NODE_ENV=development
npm start                                     # node server.js
npm test                                      # NODE_ENV=test ava
NODE_ENV=test npx ava test/graphService.test.js            # one file
NODE_ENV=test npx ava --match='*reset link*'                # by title
```

There is no linter, formatter or build step. `npm run coverage` is a stub: c8 crashes on the Node version in use (yargs ESM/CJS error), so coverage is not measured.

Node >= 25 is required (`engines`, Dockerfile and CI all use 25). CommonJS throughout.

## Layout

- `server.js` — builds and exports the app; only listens when run directly. Order: `securityHeaders` → body parsers → static → file-backed session → `refreshAccessToken` → `checkAdminStatus` → routers → 404 → `expiredSessionHandler` → error handler. It refuses to start in production without `SESSION_SECRET`.
- `middleware/securityHeaders.js` — CSP (`default-src 'self'`, no other servers, `frame-ancestors 'none'`), `nosniff`, `Referrer-Policy`, HSTS in production. Inline scripts are still allowed because the views have them; a new page that needs a script should put it in `public/js/` rather than inline, so that `'unsafe-inline'` can go one day.
- `routes/auth.js` — `/auth/signin`, `/auth/callback`, `/auth/logout`.
- `routes/index.js` — profile, groups, teams, organigrama, `/api/*`, and the public password reset flow.
- `/organigrama` — `services/orgChart.js` (pure) turns the directory into one tree under `ORG_CHART_ROOT` plus the list of people outside it; `public/js/organigrama.js` draws it with d3-org-chart (copies in `public/vendor/`, version in the file name) and runs the search. Initials are plain text: no avatar or image service.
- `public/vendor/` — Bootstrap, the Outfit typeface and the d3 libraries, served by the app. **Pages load nothing from other servers** (no CDN, no web fonts, no image services); `test/routes.test.js` checks it. A new library goes there, listed in its README.
- `routes/blog.js` — `/blog`: emails a post to Jetpack Post-by-Email through the signed-in user's mailbox.
- `routes/account.js` — `/directorio`, `/account`, `/account/groups`, `/account/sign-ins` (and its `/report`), `/account/mailboxes`, `/profile/me/auto-reply`, `/profile/me/photo`. What those pages *say* is decided in `services/accountInsights.js` (pure functions) and `config/licenseCatalog.js`.
- `routes/ownedGroups.js` — `/groups/owned`: owners seeing and changing the members of their groups.
- `routes/help.js` — `/ayuda` and its contact form. All its text is configuration: the introduction to Microsoft 365 in `config/helpGuide.js`, the questions in `config/helpTopics.js`.
- The portal's name, the organization's and the intranet address are `APP_NAME`, `ORG_NAME` and `INTRANET_URL` in `config/appConfig.js`, given to every view as `appName`, `orgName` and `intranetUrl` (`app.locals` in `server.js`). Do not write the name into a view.
- **The menu lives in `views/partials/header.ejs` only.** `server.js` gives it, per request, `currentUser` (name and address), `currentPath` (to mark the page inside a group), `canPublish` (the `/blog` list, so the link is only shown to those who may use it) and `hasSharedMailboxes`; `isAdmin` comes from `checkAdminStatus`. Pages set `currentPage` (`profile`, `account`, `directory`, `organigrama`, `groups`, `teams`, `rooms`, `blog`, `help`, `audit`), which picks the group. Sign-out is in the user menu; pages do not carry their own button.
- `routes/rooms.js` — `/salas`: the meeting rooms (place, capacity; sorted client-side by `public/js/rooms.js`) and, after a search, which are free; booking left to Outlook.
- `routes/admin.js` — `/admin/audit`, for users with a directory role (`res.locals.isAdmin`).
- `services/regionalSettings.js` — puts every account back on Madrid time and Spanish at sign-in (called from `/auth/callback`).
- `routes/groupRequests.js` — asking to join groups and owners deciding. Requests live in `services/requestStore.js` (one JSON file in `DATA_DIR`).
- `services/serviceHealthService.js` — Microsoft 365 incidents for the banner, app-only token, cached in memory.
- `services/graphService.js` — every Graph call. `services/tokenService.js` — everything MSAL (sign in, renewal, app-only tokens). `services/resetTokenService.js` — the token inside reset links. `services/emailService.js` — AWS SES (reset emails only). `services/wpService.js` — WordPress categories.
- `middleware/auth.js` — `isAuthenticated`, `redirectIfAuthenticated`, `refreshAccessToken`, `checkAdminStatus`, `checkPermission`. `middleware/rateLimit.js` — limits for the reset pages.
- `config/permissions.js` — domain and per-route allow-lists, overridden by the git-ignored `config/local.js` (template: `config/local.example.js`).

## Things that are easy to get wrong

- **Two kinds of token.** Signed-in routes use the delegated token in `req.session.accessToken`. The reset flow has no session and uses an app-only token (`getAppToken()`), so it needs *application* permissions in Entra, separate from the delegated `scopes` in `config/authConfig.js`.
- **Token renewal lives in the session.** At sign-in the MSAL token cache (which holds the refresh token) is serialized into `req.session.tokenCache`. `refreshAccessToken` renews the access token when it has under 5 minutes left, with a fresh MSAL client loaded from that cache. Never put user tokens through the shared client in `tokenService`: its cache is process-wide. If renewal fails the session is regenerated (emptied), not destroyed, so later middleware can still read `req.session`.
- **Graph errors carry `graphStatus`.** Service functions throw generic `Failed to ...` errors built with `graphError()`, which keeps Graph's HTTP status. `expiredSessionHandler` turns a 401 for a signed-in user into a redirect to `/login`. If you wrap one of these errors in a new one, copy `graphStatus` across.
- **Adding a delegated scope** means editing `scopes` in `config/authConfig.js` and granting it in the app registration; existing sessions keep the old consent until the user signs in again.
- **Service functions fail in two different ways.** Optional data (`getUserPhoto`, `getUserManager`, `getUserGroups`, `getAllUsers`, `getUserAdminRoles`) swallows errors and returns `null`/`[]`; required data throws. Check which one you are calling before relying on a throw.
- **Graph lists are paged.** Use `getAllPages()` for any collection; a single `axios.get` silently returns only the first page (100 items for most collections).
- **`checkPermission('/blog')` takes its key as an argument, never from the URL.** Express sends `/Blog` and `/blog/` to the handler of `/blog`, so a lookup by `req.path` found no list for them and let anybody through (found in the security audit of 2026-10-11). A key with no list lets nobody in; `/blog` defaults to an empty list until `config/local.js` lists usernames (the part before `@`). `MULTIPART_ROUTES` in `middleware/csrf.js` normalises the path for the same reason.
- **The OAuth callback needs the `state` of the session.** `/auth/signin` stores a random `oauthState`, `/auth/callback` refuses any other value (login CSRF), removes it, and regenerates the session before storing the tokens. Tests sign in with `signInAgent(agent)` from the stubs, which goes through `/auth/signin` first; calling the callback directly is a 400.
- **Profile edits are a diff, one field per request.** `POST /profile/me/edit` reads the profile, sends only what changed (an emptied box as `null`; Graph refuses `''`), and one `PATCH` per field, because Graph rejects a whole update over one field. A 403 means the user may not change that field (seen in the real tenant for the phone of an account with an admin role); the rest is saved and the user is sent back to the form with a notice. This was left that way on purpose: no broader permission.
- **Locked profile fields are not in the form, so the POST must skip them.** A field is locked when it is missing from `PROFILE_EDITABLE_FIELDS` or was refused earlier in the session (`req.session.profileRefused`). It is rendered as a disabled input, which browsers do not post; reading its absence as "emptied" would clear the value. `lockedProfileFields()` decides for both the view and the handler.
- **`config/appConfig.js` values that tests change are read at request time.** Use `appConfig.SHARED_MAILBOXES`, `appConfig.PROFILE_EDITABLE_FIELDS` and `appConfig.ADMIN_EMAIL` through the object in new code, not destructured at the top of the file.
- **d3-org-chart only marks nodes.** `setCentered`, `setHighlighted` and `setExpanded` change flags in the data and draw nothing until `render()` is called; `_expanded` on a node means the node itself is visible, not that its children are. Names go into the cards as HTML, so they pass through `escapeHtml`.
- **`checkAdminStatus` runs on every request** and calls Graph once per request for signed-in users.
- **Errors:** pages call `next(err)` with `err.status`, rendered by `views/error.ejs`. The message is hidden in production unless `err.expose` is set, so set it (see `userError()` in `routes/index.js`) on any error whose message is written for the user. `/api/*` returns `{ success: false, error }` JSON; `/blog` POST and permission denials reply in plain text.
- **Env vars read at require time:** `ADMIN_EMAIL` and `REDIRECT_URI` in `routes/index.js`, `RESET_RATE_LIMIT` in `middleware/rateLimit.js`. `TOKEN_SECRET` is read on use, so the app starts without it and only the reset flow fails.

## CSRF and the audit log: rules for new routes

- **Every form needs `<input type="hidden" name="_csrf" value="<%= csrfToken() %>">`** and every client-side `fetch` that is not a GET needs the `X-CSRF-Token` header. `csrfProtection` (global, in `server.js`) refuses anything else with a 403.
- **Upload forms are the exception in how, not whether.** A multipart body is only readable after multer, so the route must be listed in `MULTIPART_ROUTES` in `middleware/csrf.js` *and* call `verifyCsrfToken` right after its upload middleware (see `/blog`, `/profile/me/photo`). Listing it without calling it leaves the route unprotected.
- **`csrfToken()` starts a session.** Only call it in views that have a form: a page that calls it creates a session file for every anonymous visitor. `/reset-password` does this by necessity.
- **Record what users change** with `auditRequest(req, 'area.action', details)` after the change succeeded. Details say what was affected, never the content: no passwords, tokens, reset links or message bodies. `audit()` never throws.

## Account pages

- **"Could not check" is not "has none".** Sign-in methods, inbox rules and the drive quota come back as `null` when Graph refuses, and the views say so instead of showing an empty list. This matters most for warnings: a failed read must never produce "you have no second factor" or hide a forwarding rule behind "no rules". Keep new checks to the same contract.
- **Warnings err towards silence.** An unknown sign-in method counts as a second factor, and only *enabled* rules count as forwarding outside. A false alarm on a security page teaches users to ignore it.
- **The sign-in log is read with the app's token**, so the user it is read for comes from `req.session.account.localAccountId` and nothing else. Never take a user ID from the request there.
- **Reporting a sign-in ends the session, so order matters.** The details are read again from the log with the id the form sent (never trusted from the browser), the email to IT goes out first with the session's token, then the sessions are revoked, then the audit entry is written, and only then is the session regenerated. The result page states which steps worked; it must not claim sessions were closed when the call failed.
- **Shared mailboxes come from a list, checked per user.** Graph cannot list them. `canOpenMailbox` asks for the inbox of each address in `sharedMailboxes` (`config/local.js`) with the user's token: 200 is yes, 403/404 is no, anything else is "not checked". Mailboxes the user cannot open are never named on the page. A missing `Mail.Read.Shared` consent also answers 403, so there it looks like "no access to any".
- **Rooms: "unknown" is a third state.** A room is free only when its `availabilityView` is all zeros; a schedule with an `error`, or none at all, is "sin comprobar", and stays bookable because Outlook checks again.
- **Regional enforcement must not block sign-in.** `enforceRegionalSettings` never rejects; a mailbox that cannot be read or changed is logged and skipped. It preserves the user's working days and hours and only fixes their time zone.
- **New licenses and services** are added to `config/licenseCatalog.js`. Unknown licenses show their code; unknown service plans are left out.
- **Short explanations on the pages are part of the feature.** When a page shows a Microsoft 365 concept (group, list, owner, second factor), it says in a sentence what that is. Keep doing that on new pages.

## Group requests and the status banner

- **Owner tools follow the same two rules as approvals:** the owner's own token, and ownership checked on the server on every request (`loadOwnedGroup`), including the read of the member list. Person IDs are checked against the directory ID format before they go into a Graph URL.
- **Exactly one owner is the warning, not "fewer than two".** `getGroupOwners` returns `[]` when it fails, and that must not become "you are the only owner".
- **Approval uses the approver's token.** `addGroupMember` runs with the signed-in owner's delegated token, never an app-only one, so the app cannot change a group its user could not. Do not switch it to `getAppToken()`.
- **Who may decide is checked on the server on every decision** (`loadRequestToResolve`: the request is pending and the user owns its group). The page only lists what the user owns, but the POST must not rely on that.
- **Only groups Graph can manage get a request** (`isManageable`: Microsoft 365 groups and security groups that are not mail-enabled). Everything else, and groups without owners, falls back to one email to `ADMIN_EMAIL`.
- **`requestStore` is synchronous on purpose.** Each operation reads and writes the file in one step with no `await` in between, which is what keeps two requests in this process from overwriting each other. Making it async needs a lock. It is not safe for several instances.
- **The status banner must never break or slow a page.** `getServiceIssues()` never rejects, has a 3 second timeout, and caches failures for an hour so a missing permission is not retried on every page.

## Password reset, and why it is built this way

- `POST /reset-password` answers before it looks the user up, and does the lookup and email in the background. The answer and its timing are therefore the same for known and unknown addresses. Do not `await` that work or report its failure to the client.
- The link's address comes from `REDIRECT_URI`, never from the request's `Host` header, which an attacker controls.
- The token is AES-256-GCM (tamper-proof) and stateless. It records the user's `lastPasswordChangeDateTime`; `checkResetToken` compares it with the directory on every use, so a link dies the moment the password changes. There is no store of used links. Graph may take a moment to report the new timestamp, so reuse within seconds of a reset is theoretically possible.
- Both steps are rate limited per IP (`express-rate-limit`, in memory). Behind a proxy this needs `TRUST_PROXY`.
- The reset email goes to the first alternate address of the account (`otherMails`) and only falls back to the account's own mailbox when there is none. The form shows the account being reset, never the address the link went to.

## Not verified against a real tenant

Everything is tested against stubs. These depend on Microsoft's side and should be checked once in the real tenant:

- `/users?$expand=manager($select=id)` returning every user with their manager (org chart).
- `lastPasswordChangeDateTime` being readable with the app's application permissions, and changing when the app sets a password. If it is not readable, **no reset link is ever sent** (`sendResetLink` refuses, `reset.link_failed` in the audit log with the reason), because the link could not be made single use.
- Group requests: `/groups/{id}/owners`, `/me/ownedObjects/microsoft.graph.group`, and an owner adding a member with delegated `GroupMember.ReadWrite.All`; also that the "already a member" error still contains "already exist".
- Sign-in methods (`/me/authentication/methods` with `UserAuthenticationMethod.Read`) and devices (`/me/registeredDevices` and `/me/ownedDevices` cast to `microsoft.graph.device`).
- Service incidents: `/admin/serviceAnnouncement/issues` with `$filter=isResolved eq false` and the application permission `ServiceHealth.Read.All`.
- Regional settings: that `PATCH /me/mailboxSettings` accepts `timeZone`, `language` and `workingHours` together, and above all that a normal user may change their own `preferredLanguage` (if not, that part fails quietly at every sign-in and should be removed or done with an app token).
- Inbox rules (`/me/mailFolders/inbox/messageRules`), drive quota (`/me/drive?$select=quota` with `Files.Read`) and `/me/memberOf/microsoft.graph.group` returning `resourceProvisioningOptions`.
- "No fui yo": `POST /me/revokeSignInSessions` with the delegated permission `User.RevokeSessions.All` for a user without an admin role, and that sign-in log entries carry an `id`.
- Calendar sharing: `/me/calendar/calendarPermissions` with `Calendars.Read`, and that the entry for the whole organization is the one without an address.
- Shared mailboxes: that `/users/{address}/mailFolders/inbox` with `Mail.Read.Shared` answers 200 for a mailbox the user has full access to and 403 or 404 otherwise.
- Rooms: `/places/microsoft.graph.room` with `Place.Read.All`, `getSchedule` accepting 20 room addresses at once with `Calendars.Read`, and the Outlook deep link (`/calendar/deeplink/compose` with `startdt`, `enddt`, `location`, `to`) filling in the room.
- Owner tools: `/groups/{id}/members/microsoft.graph.user` returning `userType`, and an owner removing a member with delegated `GroupMember.ReadWrite.All`.
- Sign-in log: `/auditLogs/signIns` filtered by `userId` with `AuditLog.Read.All` (application), which also needs Entra ID P1/P2.
- The service plan names in `config/licenseCatalog.js` against the tenant's real licenses.
- Automatic replies: the form's dates are sent with the time zone name read from `/me/mailboxSettings/timeZone`, and read back with a `Prefer: outlook.timezone` header in that same zone.
- Photo upload (`PUT /me/photo/$value`) with the `User.ReadWrite` scope, and `MailboxSettings.ReadWrite` being consented.
- Silent renewal with the tenant's real refresh tokens (the MSAL mechanics are covered by `test/tokenService.test.js` against a fake token endpoint).

## Tests

Ava + supertest, one worker per file. Nothing may reach the network:

- `test/helpers/env.js` — require it first in every test file; it sets `NODE_ENV=test` (so the app does not load `.env`) and pins every env var the app reads.
- A session that had a profile field refused keeps it read-only. Tests of that use a session of their own (`freshSession` in `test/authenticated.test.js`), not the shared agent.
- `test/helpers/stubs.js` — `stubAxios()` (routes requests by method + URL suffix, records calls, unmatched → 404), `stubMsal()` (its returned state sets token lifetime and makes renewal fail), `stubSes()`, `waitFor()` for work done after the response, `getCsrfToken(agent)`, `auditEvents()`. Create the stubs **before** requiring `../server`, because `wpService` calls `axios.create` at load.
- Tests that share a stub use `test.serial` and reset it in `beforeEach`.
- Signed-in tests (`test/authenticated.test.js`) log in with `signInAgent(agent)` (through the real `/auth/signin` and `/auth/callback`, MSAL stubbed) and keep the cookie in a supertest agent. This writes a session file under `sessions/`, removed by the logout at the end.
- **POSTs need a CSRF token and a cookie.** Use a supertest agent, get the token with `getCsrfToken(agent)`, and send it as the header or the `_csrf` field. Fetch pages that contain a form with an agent too and log it out afterwards (`/auth/logout`), or its session file is left in `sessions/`.
- `test/helpers/env.js` points `AUDIT_DIR` and `DATA_DIR` at temp directories per test file. A test file that skips it writes into the project.
- To act as several users, set `msal.account` (the state returned by `stubMsal()`) before each sign-in; see `test/group-requests.test.js`. The Graph stub cannot tell users apart, so per-user answers are variables the test sets before acting as each one.
- Signing in calls Graph (regional settings). Tests that count calls either clear `http.calls` after signing in or stub settings that are already right; see `test/csrf.test.js` and `test/token-refresh.test.js`.
- The incident lookup happens once per process on the first signed-in page; tests that count Graph calls should filter out `/serviceAnnouncement/`.
- `test/tokenService.test.js` is the exception to stubbing MSAL: it runs the real library against a fake token endpoint injected through `msalConfig.system.networkClient`.
- `test/helpers/env.js` sets `RESET_RATE_LIMIT` high; only `test/rate-limit.test.js` lowers it.
- Tests that depend on permissions set `permissions.DOMAIN` / `permissions['/blog']` themselves, since a developer's `config/local.js` would otherwise change the outcome.


## Deployment

`Dockerfile` (multi-stage, node:25-alpine) is built and pushed to GHCR by `.github/workflows/docker-publish.yml` on every push to `main`; `.github/workflows/test.yml` runs `npm test`. Sessions are files in `sessions/`, the audit log is in `audit/` (`AUDIT_DIR`) and group requests in `data/` (`DATA_DIR`), so all three are lost when a container is replaced unless those directories are volumes. Run a single instance: sessions, rate limits and the request store are all per process or per directory. Rate limit counters are in memory too, per process.
