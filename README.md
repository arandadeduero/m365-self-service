# Mi Microsoft 365 - Ayuntamiento de Aranda de Duero

Internal self-service portal for Microsoft 365 users of the Ayuntamiento de Aranda de Duero. Staff sign in with their Microsoft 365 account to see and edit their profile, browse groups and Teams, view the org chart, publish to the municipal WordPress blog and reset a forgotten password. Built with Node.js, Express, EJS and Bootstrap 5.


## Features

- ✅ **Microsoft 365 Authentication** - Single tenant OAuth 2.0 authorization code flow with MSAL
- ✅ **Profile** - Profile, photo, groups, manager and raw Graph data; users can edit their job title, phones, office and photo. Fields Microsoft does not let a user change are shown read-only
- ✅ **Directory** - Searchable staff directory with phones and offices
- ✅ **My Account** - What the license includes in plain language with a link to each app, OneDrive space, an account checklist, password age and expiry, sign-in methods with a warning when there is no second factor, devices, inbox rules with a warning when mail is forwarded outside, and the recovery address
- ✅ **My Groups** - What each group the user belongs to is (a Team, a mailing list, a security group) and what it gives them
- ✅ **My Sign-ins** - Where and when the account was used recently, with a "No fui yo" button that tells IT and closes every session of the account
- ✅ **Calendar Sharing** - Who can see the user's calendar and what each of them can do, with a warning for people outside the organization
- ✅ **Shared Mailboxes** - Which of the organization's shared mailboxes the user can open
- ✅ **Owner Tools** - Owners see the members and guests of their groups, add and remove members, and are warned when a group has a single owner
- ✅ **Rooms** - Which meeting rooms are free at a given time, with a link that books them in Outlook
- ✅ **Help** - What Microsoft 365 is and which tools the organization has, answers to the usual questions, and a form to write to IT with the state of the account attached
- ✅ **Intranet Link** - The home page, the help page and the footer link to the organization's intranet
- ✅ **Regional Settings** - Every account is put back on Madrid time and Spanish at each sign-in
- ✅ **Audit Viewer** - Administrators can read and filter the audit log in the app
- ✅ **Service Status** - A banner on every page while Microsoft reports an incident in Microsoft 365
- ✅ **Automatic Replies** - Turn out-of-office replies on, off or on between two dates
- ✅ **Groups** - All tenant groups with membership status; requests to join go to the group's owners, who approve or reject in the app
- ✅ **Teams** - Joined teams and their channels
- ✅ **Organigrama** - Org chart built from each user's manager
- ✅ **Publicar en Blog** - Publicar posts en WordPress vía email con adjuntos PDF y programación (delay)
- ✅ **Password Reset** - Self-service reset link sent by email (AWS SES) to the user's alternate address: valid for 15 minutes, single use and rate limited
- ✅ **Audit Log** - Who signed in, changed what and requested what, one JSON line per event
- ✅ **CSRF Protection** - Every form and client-side request carries a per-session token
- ✅ **Silent Token Renewal** - Access tokens are renewed in the background, so users stay signed in for the whole session
- ✅ **Admin Banner** - Users holding an Entra directory role see an ADMIN banner and their roles
- ✅ **Per-route Permissions** - `/blog` is restricted to an allow-list kept in `config/local.js`
- ✅ **Persistent Sessions** - File-based session storage to maintain login across server restarts
- ✅ **Error Pages** - Friendly error page; the real message is only shown outside production
- ✅ **Testing Suite** - Ava + supertest, with Microsoft Graph, MSAL, AWS SES and WordPress stubbed
- ✅ **Docker Image** - Built and published to GitHub Container Registry on every push to `main`
- ✅ **Auto-restart Dev Server** - Nodemon for efficient development

## Screenshots

### Profile Page
After logging in, you'll see:
- Your profile photo and basic information
- Contact details
- Group memberships
- Manager information
- Collapsible raw JSON data

### Groups Page
View and manage group access:
- All tenant groups with visual membership indicators (✓ green check / ✗ red cross)
- Select non-member groups to request access
- Generate formatted access request reports
- Filter and search through groups

## Technology Stack

Exact versions are in `package.json`.

- **Runtime**: Node.js >= 25
- **Framework**: Express 5
- **Template Engine**: EJS
- **Authentication**: @azure/msal-node
- **HTTP Client**: axios (Microsoft Graph and WordPress REST API)
- **Sessions**: express-session + session-file-store
- **Email**: Microsoft Graph `sendMail` (as the signed-in user) and AWS SES (password reset)
- **Uploads**: multer (in memory, blog attachments)
- **Testing**: ava + supertest
- **Dev Server**: nodemon

## Prerequisites

- **Node.js** version 25 or higher
- **npm** version 10 or higher
- **Azure account** with Entra ID (Azure AD) access
- **Microsoft 365** account for testing

---

## Part 1: Azure/Entra ID Setup

Before running the application, you must register it in Azure Portal.

### Step 1: Register Your Application

1. Go to [Azure Portal](https://portal.azure.com)
2. Navigate to **Microsoft Entra ID** → **App registrations**
3. Click **New registration**

### Step 2: Fill Registration Form

- **Name**: `Mi Microsoft 365 - Ayuntamiento de Aranda de Duero` (or any name you prefer)
- **Supported account types**: Select **"Accounts in this organizational directory only (Single tenant)"**
- **Redirect URI**:
  - Platform: **Web**
  - URI: `http://localhost:3000/auth/callback`

Click **Register**

### Step 3: Copy Important Values

After registration, you'll see the app's overview page. **Copy these values** (you'll need them later):

- **Application (client) ID** - Example: `12345678-1234-1234-1234-123456789abc`
- **Directory (tenant) ID** - Example: `87654321-4321-4321-4321-cba987654321`

### Step 4: Create a Client Secret

1. In the left menu, go to **Certificates & secrets**
2. Click **Client secrets** → **New client secret**
3. Add a description: `Production Secret`
4. Choose expiration period: **24 months** (or your preference)
5. Click **Add**
6. **⚠️ IMMEDIATELY COPY THE SECRET VALUE** - You won't be able to see it again!

### Step 5: Configure API Permissions

  1. In the left menu, go to **API permissions**
  2. Click **Add a permission** → **Microsoft Graph** → **Delegated permissions**
  3. Add the following permissions:
     - ✅ `User.Read` - Read user profile
     - ✅ `User.ReadWrite` - Let users edit their own profile
     - ✅ `User.ReadBasic.All` - Read all users' basic profiles
     - ✅ `GroupMember.Read.All` - Read user's group memberships
     - ✅ `GroupMember.ReadWrite.All` - Let a group's owner add the person whose request they approve
     - ✅ `UserAuthenticationMethod.Read` - Read the user's own sign-in methods (account page)
     - ✅ `Group.Read.All` - Read all groups in the tenant (for Groups page)
     - ✅ `Directory.Read.All` - Read directory data
     - ✅ `MailboxSettings.ReadWrite` - Read and change the user's automatic replies
     - ✅ `Mail.Send` - Send emails as the signed-in user (for manager correction requests & blog posts)
     - ✅ `Files.Read` - Read how much OneDrive space the user has used. The permission covers the user's files in general; the app only asks for the quota
     - ✅ `User.RevokeSessions.All` - Close the user's own sessions when they report a sign-in ("No fui yo")
     - ✅ `Calendars.Read` - Read who the calendar is shared with, and whether rooms are free. The permission covers the user's calendar in general; the app does not read appointments
     - ✅ `Mail.Read.Shared` - Check which shared mailboxes the user can open. The permission lets an app read the user's mail and the shared mail they have access to; the app only asks whether each inbox exists and never reads a message
     - ✅ `Place.Read.All` - Read the list of meeting rooms
     - ✅ `offline_access` - Maintain access to data
     - ✅ `Team.ReadBasic.All` - Read the teams the user has joined (Teams page)
     - ✅ `Channel.ReadBasic.All` - Read the channels of those teams
  4. Click **Add permissions**
  5. (Recommended) Click **Grant admin consent for [Your Organization]**
     - This allows users to sign in without individual consent prompts

  The list above must match `scopes` in `config/authConfig.js`.

  **"My sign-ins" needs an application permission and a license.** Add `AuditLog.Read.All` as an *Application* permission, with admin consent. Microsoft only serves the sign-in log to tenants with Entra ID P1 or P2. Without either, the page says the log is unavailable. The app only ever reads the log of the user who is signed in.

  **The service status banner needs an application permission.** Add `ServiceHealth.Read.All` as an *Application* permission, with admin consent. Without it the app works and simply never shows the banner.

  **Password reset needs application permissions too.** The reset pages work without a signed-in user, so they call Microsoft Graph with an app-only token (client credentials). The app registration therefore also needs *Application* permissions, with admin consent, to read users (including `lastPasswordChangeDateTime`, which is what makes reset links single use) and to update a user's `passwordProfile`. Check the current Microsoft Graph documentation for "Update user" for the exact permission and directory role required to change passwords, as it is more restrictive than a normal profile update.

### Step 6: Fill In Alternate Email Addresses

A password reset link is sent to the first **alternate email address** of the account (`otherMails` in Entra ID, "Other emails" in the admin portal), because someone who forgot their password usually cannot open the mailbox of that same account. Accounts without one still get the link in their Microsoft 365 mailbox. The "Mi cuenta" page tells each user which of the two applies to them.

### Step 7: Add WordPress Integration (Jetpack)

  1. Enable **Post by Email** in your WordPress site Jetpack settings.
  2. Copy the generated email address.
  3. Add it to your `.env` file as `JETPACK_POST_BY_EMAIL`.

### Step 8: Verify Settings


- Go to **Authentication** tab
- Ensure **Allow public client flows** is set to **No**
- Under **Implicit grant and hybrid flows**, leave all checkboxes unchecked
- We're using Authorization Code Flow (most secure)

**✅ Azure setup complete!** Now you can set up the application.

---

## Part 2: Local Development Setup

### Step 1: Clone or Download the Repository

```bash
# If using git
git clone <repository-url>
cd mi-microsoft-365

# Or download and extract the ZIP file
```

### Step 2: Install Dependencies

```bash
npm install
```

This will install all required packages including Express, MSAL, axios, EJS, and development tools.

### Step 3: Configure Environment Variables

1. Copy the example environment file:

```bash
cp .env.example .env
```

2. Open `.env` in your editor and fill in the values from Azure:

```env
# From Azure App Registration
CLIENT_ID=your-application-client-id-here
CLIENT_SECRET=your-client-secret-value-here
TENANT_ID=your-tenant-id-here

# Local development configuration
REDIRECT_URI=http://localhost:3000/auth/callback
PORT=3000
NODE_ENV=development

# Generate a random secret for sessions
SESSION_SECRET=your-random-session-secret-here

# Encrypts password reset links. Without it password reset does not work
TOKEN_SECRET=another-random-secret-here
```

`.env.example` also lists the WordPress and AWS SES settings; see [Part 5](#part-5-environment-variables) for all of them.

**How to generate SESSION_SECRET and TOKEN_SECRET:**

```bash
# macOS/Linux
openssl rand -base64 32

# Or using Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

### Step 4: Configure Route Permissions (optional)

The blog page is closed to everyone until you say who may use it. Copy the example and list the usernames (the part of the email before `@`):

```bash
cp config/local.example.js config/local.js
```

```javascript
module.exports = {
  permissions: {
    DOMAIN: 'arandadeduero.es',
    '/blog': ['username1', 'username2']
  }
};
```

`config/local.js` is ignored by git. Restart the server after changing it.

The same file lists the shared mailboxes of the organization, which Microsoft Graph cannot list by itself:

```javascript
module.exports = {
  permissions: { /* ... */ },
  sharedMailboxes: ['registro@arandadeduero.es', 'obras@arandadeduero.es']
};
```

Each user then sees, under "Mi cuenta" → "Buzones compartidos", the ones of that list they can open. Without the list the link is not shown.

### Step 5: Start the Development Server

```bash
# Start with auto-restart on file changes
npm run dev

# Or start normally
npm start
```

You should see:

```
=================================
Server running on port 3000
Environment: development
URL: http://localhost:3000
=================================
```

### Step 6: Test the Application

1. Open your browser to `http://localhost:3000`
2. You'll see the login page
3. Click **"Sign in with Microsoft"**
4. Sign in with your Microsoft 365 account
5. You'll be redirected to your profile page with:
   - Your profile photo
   - Contact information
   - Group memberships
   - Manager details
   - Raw JSON data (collapsible)

---

## Part 3: Project Structure

```
mi-microsoft-365/
├── server.js                         # Express app: middleware, sessions, routes
├── package.json                      # Dependencies and scripts
├── .env.example                      # Environment variables template
├── nodemon.json                      # Auto-restart configuration
├── Dockerfile / .dockerignore        # Production image
├── Procfile                          # Heroku deployment config
├── CLAUDE.md                         # Notes for working on the code with Claude Code
│
├── .github/
│   ├── dependabot.yml
│   └── workflows/
│       ├── test.yml                  # Runs npm test on pushes and pull requests
│       └── docker-publish.yml        # Builds and pushes the image to GHCR
│
├── config/
│   ├── authConfig.js                 # MSAL configuration and Graph scopes
│   ├── graphConfig.js                # Microsoft Graph API endpoints
│   ├── permissions.js                # Allowed domain and per-route allow-lists
│   ├── local.example.js              # Template for config/local.js (git-ignored)
│   ├── appConfig.js                  # Admin mailbox, public address, time zone and language
│   ├── licenseCatalog.js             # Licenses and services in plain Spanish
│   └── wpConfig.js                   # Jetpack Post-by-Email address
│
├── middleware/
│   ├── auth.js                       # Authentication, token renewal, admin status, permissions
│   ├── rateLimit.js                  # Limits on the password reset pages
│   ├── csrf.js                       # CSRF token for forms and client-side requests
│   └── errorHandler.js               # 404, rejected tokens and error page
│
├── routes/
│   ├── auth.js                       # Sign in, OAuth callback, logout
│   ├── index.js                      # Profile, groups, teams, org chart, APIs, password reset
│   ├── account.js                    # Directory, account pages, automatic replies, photo
│   ├── admin.js                      # Audit viewer for administrators
│   ├── groupRequests.js              # Asking to join a group, owners approving
│   └── blog.js                       # Publish to the WordPress blog
│
├── services/
│   ├── graphService.js               # Microsoft Graph API calls
│   ├── tokenService.js               # MSAL: sign in, token renewal, app-only tokens
│   ├── resetTokenService.js          # Encrypted token carried by reset links
│   ├── accountInsights.js            # Turns Graph data into what the account pages say
│   ├── regionalSettings.js           # Keeps accounts on Madrid time and Spanish
│   ├── auditService.js               # Audit log
│   ├── requestStore.js               # Requests to join groups (JSON file)
│   ├── serviceHealthService.js       # Microsoft 365 incidents, cached
│   ├── emailService.js               # Password reset emails (AWS SES)
│   └── wpService.js                  # WordPress REST API (categories)
│
├── public/                           # custom.css, profile.js, default avatar
│
├── views/
│   ├── partials/                     # header.ejs, footer.ejs
│   ├── login.ejs
│   ├── profile.ejs / edit-profile.ejs
│   ├── groups.ejs / group-requests.ejs / teams.ejs / organigrama.ejs
│   ├── directory.ejs / account.ejs / auto-reply.ejs
│   ├── my-groups.ejs / sign-ins.ejs / audit.ejs
│   ├── blog.ejs
│   ├── reset-password.ejs / reset-password-form.ejs
│   └── error.ejs                     # Error page
│
├── sessions/                         # Session files (created at runtime, git-ignored)
├── audit/                            # Audit log, a file per day (created at runtime, git-ignored)
├── data/                             # Requests to join groups (created at runtime, git-ignored)
│
└── test/
    ├── helpers/
    │   ├── env.js                    # Fixed environment for tests
    │   └── stubs.js                  # Stubs for axios, MSAL and AWS SES
    ├── auth.test.js                  # OAuth routes without a session
    ├── routes.test.js                # Route protection and login page
    ├── authenticated.test.js         # Profile, groups, teams, blog and APIs as a signed-in user
    ├── account.test.js               # Directory, account pages, automatic replies, photo
    ├── accountInsights.test.js       # Licenses, groups, rules, checklist in plain language
    ├── regional-settings.test.js     # Madrid time and Spanish at sign-in
    ├── audit-viewer.test.js          # Audit page for administrators
    ├── group-requests.test.js        # Group requests with several users
    ├── requestStore.test.js          # Request storage
    ├── service-status.test.js        # Incident banner and its cache
    ├── csrf.test.js                  # CSRF protection
    ├── auditService.test.js          # Audit log
    ├── reset-password.test.js        # Reset request validation
    ├── reset-password-flow.test.js   # Full reset: link, expiry, single use, new password
    ├── resetTokenService.test.js     # Reset link token
    ├── rate-limit.test.js            # Limits on the reset pages
    ├── token-refresh.test.js         # Expired and rejected access tokens
    ├── tokenService.test.js          # Real MSAL against a fake Entra ID endpoint
    ├── middleware.test.js            # Authentication, permissions, admin status
    ├── errorHandler.test.js          # Error page behaviour
    └── graphService.test.js          # Microsoft Graph service
```

---

## Part 4: Testing

This project uses **ava** as the test runner and **supertest** to drive the Express app.

### Run All Tests

```bash
npm test
```

### Run One File or One Test

```bash
NODE_ENV=test npx ava test/graphService.test.js
NODE_ENV=test npx ava --match='*reset link*'
```

### Run Tests in Watch Mode (for development)

```bash
npm run test:watch
```

### How the Tests Work

No test talks to Microsoft, AWS or WordPress:

- `test/helpers/env.js` sets every environment variable to a fixed test value, so a real `.env` is not needed (or used) by the files that require it.
- `test/helpers/stubs.js` replaces axios, the MSAL token calls and the SES client, and records what the app tried to send.
- `test/authenticated.test.js` signs in through the real `/auth/callback` route with MSAL stubbed, then reuses the session cookie.

### What Is Covered

- ✅ OAuth routes: sign in redirect, callback, logout
- ✅ Route protection for anonymous users, login page, 404
- ✅ Profile, edit profile, groups, teams, org chart as a signed-in user
- ✅ `/api/users`, manager correction and group access request emails
- ✅ Blog: allow-list, categories, Jetpack email body, attachments
- ✅ Password reset: same answer for unknown users, forged Host header, expired, used and tampered links, rate limits, password update
- ✅ Access tokens: silent renewal, sign-out when renewal fails or Microsoft Graph rejects the token
- ✅ Directory, account page (sign-in methods, devices), automatic replies and photo upload
- ✅ Group requests: routing to owners or admin, approval, rejection, who may decide
- ✅ Service status banner and its caching
- ✅ What the license includes, the account checklist, inbox rules, my groups and my sign-ins
- ✅ Regional settings corrected at sign-in, and sign-in working when they cannot be
- ✅ Audit viewer: administrators only, filters, damaged lines
- ✅ CSRF protection of every form, upload and JSON request
- ✅ Audit log entries, and that they never contain passwords, links or messages
- ✅ Middleware: authentication, permissions, admin status, error pages
- ✅ Microsoft Graph service: request shape, paging and error handling of each call

### Coverage

`npm run coverage` only prints a notice: c8 does not run on current Node.js versions, so there is no coverage report at the moment.

---

## Part 5: Environment Variables

| Variable | Description | Example | Required |
|----------|-------------|---------|----------|
| `CLIENT_ID` | Application (client) ID from Azure | `12345678-1234-...` | Yes |
| `CLIENT_SECRET` | Client secret value from Azure | `abc123...` | Yes |
| `TENANT_ID` | Directory (tenant) ID from Azure | `87654321-4321-...` | Yes |
| `REDIRECT_URI` | OAuth callback URL; also used to build the post-logout URL | `http://localhost:3000/auth/callback` | Yes |
| `SESSION_SECRET` | Random string that signs the session cookie | Generated random value | Yes |
| `TOKEN_SECRET` | Random string that encrypts password reset links | Generated random value | For password reset |
| `JETPACK_POST_BY_EMAIL` | Jetpack Post-by-Email address the blog page sends to | `user@post.wordpress.com` | For the blog |
| `WP_URL` | WordPress site URL (categories are read from its REST API) | `https://example.es` | For the blog |
| `WP_USER` | WordPress user for the REST API | `editor` | For the blog |
| `WP_APP_PASSWORD` | WordPress application password of that user | Generated in WordPress | For the blog |
| `AWS_REGION` | AWS region of the SES identity | `eu-west-1` | For password reset |
| `AWS_ACCESS_KEY_ID` | AWS access key allowed to send with SES | `AKIA...` | For password reset |
| `AWS_SECRET_ACCESS_KEY` | Secret of that access key | | For password reset |
| `FROM_EMAIL` | SES-verified sender of password reset emails | `no-responder@arandadeduero.dev` | For password reset |
| `AUDIT_DIR` | Directory of the audit log | `/var/log/m365-tools` | No (default: `./audit`) |
| `DATA_DIR` | Directory of the requests to join groups | `/var/lib/m365-tools` | No (default: `./data`) |
| `PASSWORD_MAX_AGE_DAYS` | Days a password lasts in your tenant; makes the account page show the days left | `90` | No (no expiry shown) |
| `PROFILE_EDITABLE_FIELDS` | Profile fields users may change themselves, out of `mobilePhone`, `businessPhones`, `jobTitle`, `officeLocation`; the rest are shown read-only | `mobilePhone,businessPhones` | No (default: all four) |
| `INTRANET_URL` | Address of the organization's intranet, linked from the home page, the help page and the footer | `https://example.sharepoint.com` | No (default: the Ayuntamiento's) |
| `ADMIN_EMAIL` | Mailbox that receives manager correction and group access requests, reported sign-ins and messages from the help page | `informatica@example.es` | Recommended (a built-in address is used otherwise) |
| `TRUST_PROXY` | Number of reverse proxies in front of the app, so it sees the real client address and protocol | `1` | When behind a proxy |
| `RESET_RATE_LIMIT` | Reset links one IP address may request every 15 minutes | `5` | No (default: 5) |
| `PORT` | Port for the server | `3000` | No (default: 3000) |
| `NODE_ENV` | Environment mode | `development` or `production` | No (default: development) |

`REDIRECT_URI` also decides the address used in password reset links: they point at its origin (for example `https://herramientas.example.es`), never at the host of the incoming request.

Who may use `/blog` is not an environment variable: it is set in `config/local.js` (see Part 2, Step 4).

---

## Part 6: Application Flow

### Authentication Flow

1. **User visits `/`** → Not authenticated → Redirected to `/login`
2. **User clicks "Sign in with Microsoft"** → Redirected to `/auth/signin`
3. **App generates auth URL** → Redirects to Microsoft login page
4. **User signs in** → Microsoft validates credentials
5. **Microsoft redirects to `/auth/callback`** with authorization code
6. **App exchanges code for access token** → Stores in session
7. **User redirected to `/`** → Now authenticated
8. **App fetches user data** from Microsoft Graph API:
   - Profile information
   - Profile photo
   - Group memberships
   - Manager details
9. **Profile page rendered**
10. **User clicks "Logout"** → Session cleared → Redirected to login

### Routes

| Method | Path | Access | Purpose |
|--------|------|--------|---------|
| GET | `/login` | Public | Login page |
| GET | `/auth/signin` | Public | Redirect to Microsoft sign in |
| GET | `/auth/callback` | Public | OAuth callback, creates the session |
| GET | `/auth/logout` | Public | Destroys the session and signs out of Microsoft |
| GET | `/` | Signed in | Profile |
| GET, POST | `/profile/me/edit` | Signed in | Edit job title, phones and office |
| POST | `/profile/me/photo` | Signed in | Upload a new profile photo (JPG or PNG, up to 4 MB) |
| GET, POST | `/profile/me/auto-reply` | Signed in | Automatic (out-of-office) replies |
| GET | `/account` | Signed in | What the user has and how their account is set up and protected |
| GET | `/account/groups` | Signed in | The user's groups and what each one gives them |
| GET | `/account/sign-ins` | Signed in | The user's own recent sign-ins |
| POST | `/account/sign-ins/report` | Signed in | "No fui yo": tell IT about a sign-in and close every session |
| GET | `/account/mailboxes` | Signed in | The shared mailboxes the user can open |
| GET | `/groups/owned` | Signed in | The groups the user owns |
| GET | `/groups/owned/:id` | Owners of the group | Its members, guests and owners |
| POST | `/groups/owned/:id/members` | Owners of the group | Add a member |
| POST | `/groups/owned/:id/members/:userId/remove` | Owners of the group | Remove a member |
| GET | `/salas` | Signed in | Meeting rooms that are free at a given time |
| GET | `/ayuda` | Signed in | Help page |
| POST | `/ayuda/contacto` | Signed in | Write to IT from the user's mailbox |
| GET | `/admin/audit` | Administrators | The audit log, with filters |
| GET | `/directorio` | Signed in | Staff directory |
| GET | `/groups` | Signed in | Tenant groups and distribution lists (names starting with `DIST`) |
| POST | `/groups/generate-report` | Signed in | Text report of the selected groups (JSON) |
| GET | `/teams` | Signed in | Joined teams and channels |
| GET | `/organigrama` | Signed in | Org chart |
| GET | `/api/users` | Signed in | Users of the organization (JSON) |
| POST | `/api/manager-correction` | Signed in | Emails a manager correction request |
| POST | `/api/group-access-request` | Signed in | Asks to join the selected groups |
| GET | `/groups/requests` | Signed in | Requests for the groups I own, and the ones I made |
| POST | `/groups/requests/:id/approve`, `/reject` | Owner of the group | Decide on a request |
| GET, POST | `/blog` | Signed in and on the allow-list | Publish a post to WordPress by email |
| GET, POST | `/reset-password` | Public | Ask for a password reset link |
| GET, POST | `/reset-password/:token` | Public (link from the email) | Choose a new password |

### Session Management

- Microsoft access tokens last about an hour. The session also keeps the MSAL token cache (with the refresh token), and the app renews the access token shortly before it expires, so users stay signed in for the whole session
- If the token cannot be renewed, or Microsoft Graph rejects it (for example after the account is disabled), the session is emptied and the user is sent back to the login page

- Sessions are stored in files (persistent across server restarts)
- Session cookies are HTTP-only (XSS protection)
- Secure flag enabled in production (HTTPS only)
- SameSite=lax, plus a CSRF token in every form and client-side request
- Session lifetime: 24 hours
- Sessions persist in `sessions/` directory (excluded from git)

---

## Part 7: Microsoft Graph API Usage

The application makes the following Microsoft Graph API calls:

### 1. User Profile (Extended)

**Endpoint:** `GET /v1.0/me`

**Fields Retrieved:**
- `id`, `displayName`, `givenName`, `surname`
- `mail`, `userPrincipalName`
- `jobTitle`, `department`, `companyName`
- `officeLocation`, `employeeId`
- `mobilePhone`, `businessPhones`
- `preferredLanguage`

### 2. Profile Photo

**Endpoint:** `GET /v1.0/me/photo/$value`

Returns binary image data. If no photo exists, uses default avatar.

### 3. Group Memberships

**Endpoint:** `GET /v1.0/me/memberOf`

Returns array of groups the user belongs to.

### 4. Manager

**Endpoint:** `GET /v1.0/me/manager`

Returns manager's profile information. If no manager assigned, returns null.

All calls are made in parallel for optimal performance.

---

### Regional Settings

Everybody works in the same place, so every account is kept on the same settings. Each time a user signs in to this app, it checks and, where they differ, corrects:

| Setting | Value | Affects |
|---------|-------|---------|
| Mailbox time zone | Madrid (`Romance Standard Time`) | Outlook, and the calendar shown in Teams |
| Mailbox language | Spanish (`es-ES`) | Outlook, folder names and dates |
| Working hours time zone | Madrid | Calendar and scheduling; the user's own days and hours are kept |
| Account preferred language | Spanish (`es-ES`) | Microsoft 365 web apps, Teams included |

What this cannot do: it does not lock anything. A user can still change a setting in Outlook, and it is put back the next time they sign in here, not before. Users who never open this app are not corrected. The desktop Teams app also follows the computer's own language and time zone, which the app cannot reach. Each correction is written to the audit log. The values are in `config/appConfig.js`.

### Reporting a Sign-in ("No fui yo")

Each entry of "Mis inicios de sesión" has a button for the user who does not recognise it. The app emails `ADMIN_EMAIL` the details of that sign-in (read again from the log, not taken from the browser), closes every session of the account on every device (`revokeSignInSessions`), and ends the session in this app. The page that follows says honestly which of the two steps worked, and sends the user to change their password: closing sessions does not help if somebody knows it. Tokens already issued can stay valid for up to an hour.

### Profile Fields Users May Not Change

Tenants differ in which profile fields a user may edit, and accounts with an admin role are stricter still. The app sends each changed field on its own, saves the ones Microsoft accepts, and shows the refused ones read-only for the rest of the session with "pide el cambio a Informática". If you already know which fields your tenant refuses, set `PROFILE_EDITABLE_FIELDS` so they are read-only from the start.

### Owner Tools

`/groups/owned` lists the groups the signed-in user owns and flags the ones where they are the only owner. Each group page shows its members, marks external guests, and lets the owner add or remove members, with their own token, so the app cannot do anything the owner could not do in Outlook or Teams. Distribution lists and mail-enabled security groups are shown but cannot be changed, because Microsoft Graph cannot change them. Owners are not managed here.

### Rooms

`/salas` asks for a day and a time and shows which meeting rooms are free. It only looks: "Reservar en Outlook" opens a new meeting with the room and time filled in, and the room is booked when the user sends it. It needs rooms to exist as room mailboxes in Exchange.

### Audit Viewer

Users who hold an Entra ID directory role (the same ones who see the red ADMIN banner) have an "Auditoría" entry in the menu. `/admin/audit` shows the last seven days of the audit log, newest first, and can be narrowed to one day, one kind of event or one person. Any directory role counts, not only Global Administrator.

### Group Requests

When a user asks to join groups on the Groups page, each group is handled on its own:

- **Microsoft 365 groups and security groups that have owners**: a pending request is stored and the owners get an email with a link to `/groups/requests`. Any owner can approve or reject there. Approving adds the person to the group immediately, using the owner's own permissions, and the requester is told by email either way.
- **Groups without owners, distribution lists and mail-enabled security groups**: these go to `ADMIN_EMAIL` in one email, as before. Microsoft Graph cannot change the membership of lists managed in Exchange, so their owners could not approve here.

Requests are kept in `DATA_DIR/group-requests.json` and never deleted, so users can see the outcome of theirs. The app is meant to run as a single instance; several instances sharing that file would overwrite each other.

### Service Status

While Microsoft reports an open incident for any Microsoft 365 service, signed-in users see a banner with the service and a short description at the top of every page. Advisories are not shown. The list is read at most once every five minutes and shared by all users. If it cannot be read, no banner is shown and the next attempt is an hour later.

### Audit Log

Every action that changes something, and every sign in, is appended to a file per day in `AUDIT_DIR` (`./audit` by default), one JSON object per line:

```json
{"time":"2026-10-10T15:04:05.123Z","event":"profile.update","actor":"usuario@arandadeduero.es","ip":"203.0.113.5","fields":["mobilePhone"]}
```

| Event | Recorded when |
|-------|---------------|
| `auth.sign_in`, `auth.sign_out` | A user signs in or out |
| `account.regional_settings_corrected` | Time zone or language was put back at sign-in (which settings) |
| `permission.denied` | A user is refused a page: the blog allow-list, the audit viewer, or deciding on a request for a group they do not own |
| `profile.update`, `profile.photo_update` | Profile details or photo change |
| `mail.auto_reply_update` | Automatic replies change (status only, never the message) |
| `account.sign_in_reported` | A user reported a sign-in as not theirs (its id and address, whether IT was told and the sessions closed) |
| `group.member_added`, `group.member_removed` | An owner changed the members of their group |
| `help.contact` | A user wrote to IT from the help page (never the message) |
| `request.manager_correction`, `request.group_access` | A request is emailed to the admin mailbox |
| `group_request.created`, `group_request.approved`, `group_request.rejected` | A request to join a group is sent to its owners, and their decision |
| `blog.post` | A post is sent to WordPress (title, status, number of attachments) |
| `reset.link_requested` | A reset link is asked for: the address and whether it went to the `alternate` address, the `mailbox`, or `nobody` |
| `reset.link_failed` | The link could not be sent |
| `reset.password_changed`, `reset.rejected` | A password is reset, or an attempt is refused |

Passwords, reset links and message contents are never written. The app only appends; rotating or archiving old files is up to you. If the log cannot be written the action still goes ahead and the failure is reported in the server log.

```bash
# Who reset a password this month?
grep -h '"reset.password_changed"' audit/2026-10-*.log
```

---

## Part 8: Error Handling

Pages report errors through one template, `views/error.ejs`, which shows the HTTP status code, a message and a link back to the home page.

- **Outside production** the message is the real error message.
- **In production** (`NODE_ENV=production`) the message is always a generic "Lo sentimos, ha ocurrido un error" text.

The stack trace, URL and method are written to the server log in both modes and never sent to the browser.

Some endpoints answer differently:

- `/api/*` returns JSON: `{ "success": false, "error": "..." }`
- A failed `POST /blog` and a denied permission check answer in plain text

Two cases are not treated as plain errors:

- Messages written for the user (an expired or already used reset link, too many attempts, passwords that do not match) are shown in production as well.
- When Microsoft Graph answers 401 for the signed-in user, the user is redirected to the login page instead of seeing an error.

---

## Part 9: Heroku Deployment

### Prerequisites

1. Install Heroku CLI:

```bash
npm install -g heroku
```

2. Create a Heroku account at [heroku.com](https://heroku.com)

### Deployment Steps

#### 1. Login to Heroku

```bash
heroku login
```

#### 2. Create Heroku App

```bash
# Let Heroku generate a name
heroku create

# Or specify your own name
heroku create my-m365-login-demo
```

Note the app URL (e.g., `https://mysterious-ocean-12345.herokuapp.com`)

#### 3. Set Environment Variables

```bash
heroku config:set CLIENT_ID=your-client-id-from-azure
heroku config:set CLIENT_SECRET=your-client-secret-from-azure
heroku config:set TENANT_ID=your-tenant-id-from-azure
heroku config:set SESSION_SECRET=$(openssl rand -base64 32)
heroku config:set NODE_ENV=production
heroku config:set REDIRECT_URI=https://your-app-name.herokuapp.com/auth/callback
```

Replace `your-app-name` with your actual Heroku app name.

#### 4. Deploy to Heroku

```bash
git add .
git commit -m "Ready for Heroku deployment"
git push heroku main
```

Or if your branch is `master`:

```bash
git push heroku master
```

#### 5. Open Your App

```bash
heroku open
```

#### 6. View Logs (if needed)

```bash
heroku logs --tail
```

### Post-Deployment: Update Azure Redirect URI

**IMPORTANT:** After deploying to Heroku, you must update your Azure app registration:

1. Go to [Azure Portal](https://portal.azure.com)
2. Navigate to your app registration
3. Go to **Authentication**
4. Under **Platform configurations** → **Web**
5. Click **Add URI**
6. Add: `https://your-app-name.herokuapp.com/auth/callback`
7. Click **Save**

Now test your production deployment!

---

## Part 10: Alternative Deployment Options

### Docker

Every push to `main` builds the `Dockerfile` and publishes the image to GitHub Container Registry (`.github/workflows/docker-publish.yml`), tagged `latest` and `sha-<commit>`.

```bash
docker build -t m365-tools .
docker run --env-file .env -e NODE_ENV=production -p 3000:3000 \
  -v m365-sessions:/usr/src/app/sessions \
  -v m365-audit:/usr/src/app/audit \
  -v m365-data:/usr/src/app/data m365-tools
```

Notes:

- `.env` and `config/local.js` are not part of the image (`.env` is excluded and `local.js` is git-ignored), so pass the environment at run time and mount `config/local.js` if you use the blog allow-list.
- The audit log is written to `audit/` and pending group requests to `data/`. Without volumes they are lost with the container.
- Sessions are files in `sessions/`. Without a volume, everybody is signed out when the container is replaced. The same applies to platforms with an ephemeral filesystem, such as Heroku.
- In production the session cookie is `Secure`, so the app must be reached over HTTPS.
- Behind a reverse proxy, set `TRUST_PROXY=1`. Otherwise every visitor appears to come from the proxy's address and they all share one password reset rate limit.
- Rate limit counters are kept in memory, so they restart with the container and are not shared between several instances.

### Render.com

1. Create account at [render.com](https://render.com)
2. Connect your GitHub repository
3. Create new Web Service
4. Set environment variables in dashboard
5. Deploy

### Railway.app

1. Create account at [railway.app](https://railway.app)
2. Create new project from GitHub
3. Set environment variables
4. Deploy automatically

### Azure App Service

1. Create App Service in Azure Portal
2. Choose Node.js runtime
3. Deploy from GitHub or local git
4. Set environment variables in Configuration
5. Your redirect URI will be on same domain as Azure AD

### DigitalOcean App Platform

1. Create account at [digitalocean.com](https://digitalocean.com)
2. Create new app from GitHub
3. Configure environment variables
4. Deploy

---

## Part 11: Security Considerations

### Tokens

- ✅ Access tokens stored server-side only (in session)
- ✅ Never exposed to client-side JavaScript
- ✅ Tokens not stored in cookies
- ✅ Session cookies are HTTP-only
- ✅ Sessions persist across server restarts (file-based storage)

### Secrets

- ✅ Client secret never committed to git
- ✅ Environment variables for all sensitive data
- ✅ `.env` file in `.gitignore`
- ✅ Different secrets for dev and production

### Sessions

- ✅ Secure random session secret
- ✅ HTTP-only cookies (XSS protection)
- ✅ Secure flag in production (HTTPS only)
- ✅ SameSite=lax
- ✅ CSRF token required on every request that changes something
- ✅ 24-hour session lifetime

### HTTPS

- ✅ Required in production
- ✅ Automatically provided by Heroku
- ✅ Secure cookies only work over HTTPS

### Best Practices

1. **Rotate secrets regularly** - Create new client secrets in Azure every 6-12 months
2. **Use HTTPS** - Always use HTTPS in production
3. **Validate redirect URIs** - Only whitelist your actual URIs in Azure
4. **Monitor logs** - Watch for unusual authentication patterns
5. **Keep dependencies updated** - Run `npm audit` regularly

---

## Part 12: Troubleshooting

### Issue: "Missing required environment variables" warning

**Solution:** Make sure you've created a `.env` file with all required variables:

```bash
cp .env.example .env
# Then edit .env with your actual values
```

### Issue: Authentication fails with "invalid_client" error

**Possible causes:**
1. Wrong `CLIENT_ID` or `CLIENT_SECRET`
2. Client secret has expired
3. Wrong `TENANT_ID`

**Solution:** Double-check your `.env` values against Azure Portal

### Issue: "Redirect URI mismatch" error

**Solution:** Ensure the `REDIRECT_URI` in your `.env` file exactly matches the redirect URI configured in Azure:

- Local: `http://localhost:3000/auth/callback`
- Heroku: `https://your-app-name.herokuapp.com/auth/callback`

### Issue: "Insufficient permissions" error

**Solution:** 
1. Go to Azure Portal → Your app → API permissions
2. Ensure all required permissions are added
3. Click "Grant admin consent"

### Issue: Cannot see profile photo

**Possible causes:**
1. User has no profile photo in Microsoft 365
2. Permission `User.Read` not granted

**Solution:** This is normal. The app will show a default avatar if no photo exists.

### Issue: Password reset email not received

The page always answers that a link was sent if the address belongs to an account, whether or not it does, so the answer does not tell you what happened. The server log does.

**Possible causes:**
1. Email is in spam folder
2. The address does not belong to any account
3. AWS SES not configured correctly (look for `Error sending reset link` in the log)
4. The app registration lacks the application permissions the reset needs

**Solution:**
1. Check spam/junk folder for emails from the `FROM_EMAIL` address
2. Verify the address and the AWS SES credentials in `.env`
3. Outside production, the link is also printed in the server log

### Issue: A reset link says "El enlace ya ha sido utilizado"

A link works once: it stops working as soon as the account's password changes, by this app or anywhere else. Request a new link. Links also expire after 15 minutes.

### Issue: "Demasiados intentos" on the password reset pages

One IP address may request 5 links and make 20 link attempts every 15 minutes (`RESET_RATE_LIMIT` changes both). If everybody hits the limit at once, the app is behind a proxy and `TRUST_PROXY` is not set.

### Issue: Port 3000 already in use

**Solution:** Change the port in `.env`:

```env
PORT=3001
```

### Issue: Tests failing

**Solution:** The tests set their own environment and do not need a `.env` file. Check that dependencies are installed (`npm ci`) and that you are on Node.js 25 or newer (`node --version`).

### Issue: A form answers "El formulario ha caducado"

The form's CSRF token no longer matches the session, usually because the session expired or the page was left open across a sign-out. Reload the page and submit again.

### Issue: Password reset fails and the log says "TOKEN_SECRET is not configured"

**Solution:** `TOKEN_SECRET` is missing from `.env`. Generate one with `openssl rand -base64 32`. The server warns about it at startup.

### Issue: `/blog` answers "Access Denied"

**Solution:** Your username is not on the allow-list. Add it to `'/blog'` in `config/local.js` (see Part 2, Step 4) and restart the server. Only accounts of the configured domain are accepted.

---

## Part 13: Development Tips

### Hot Reloading

The dev server uses nodemon for auto-restart:

```bash
npm run dev
```

Changes to these files trigger restart:
- `*.js` files in root, routes, middleware, services, config
- `*.ejs` files in views
- `*.css` files

### Viewing Logs

Development mode logs all requests:

```
GET /
GET /css/custom.css
GET /auth/signin
```

### Testing Authentication Locally

1. Make sure your Azure redirect URI includes `http://localhost:3000/auth/callback`
2. Start dev server: `npm run dev`
3. Open `http://localhost:3000`
4. Sign in with your M365 account
5. Check browser network tab to debug auth flow

### Debugging

Add breakpoints or console.log statements:

```javascript
// In routes/index.js
console.log('User data:', userData);
```

---

## Part 14: UI & Styling Design

This application uses **Bootstrap 5** alongside custom CSS and variables to achieve a modern, responsive layout consistent with corporate web applications.

### Design Elements Used

- **Typography**: Google Fonts integration (`Manrope` and `Sora`) for a clean, professional aesthetic.
- **Card Panels**: `.app-panel` classes with subtle shadows and border-top accents based on the current page section.
- **Responsive Layout**: Bootstrap's responsive grid system ensures the interface functions well on both desktop and mobile screens.
- **Dynamic Backgrounds**: CSS radial gradients matching page accents.

### Customization

Edit `public/css/custom.css` to customize the primary/secondary palette and accent colors:

```css
:root {
  --app-ink: #182433;
  --app-muted: #5a6678;
  --app-primary: #0d6efd;
  --app-secondary: #f59f00;
  --app-surface: #ffffff;
}
```

### Documentation

- [Bootstrap 5 Documentation](https://getbootstrap.com/docs/5.3/getting-started/introduction/)

---

## Part 15: Contributing

If you'd like to contribute:

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Make your changes
4. Run tests: `npm test`
5. Commit: `git commit -m "Add my feature"`
6. Push: `git push origin feature/my-feature`
7. Create a Pull Request

---

## Part 16: License

MIT License

Copyright (c) 2026

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

---

## Part 17: Additional Resources

### Microsoft Documentation

- [Microsoft Graph API](https://learn.microsoft.com/en-us/graph/)
- [MSAL Node.js](https://learn.microsoft.com/en-us/azure/active-directory/develop/msal-node-migration)
- [Entra ID (Azure AD)](https://learn.microsoft.com/en-us/azure/active-directory/)

### Bootstrap & CSS

- [Bootstrap 5](https://getbootstrap.com)
- [Bootstrap 5 Docs](https://getbootstrap.com/docs/5.3/)

### Node.js & Express

- [Node.js Documentation](https://nodejs.org/docs)
- [Express.js Guide](https://expressjs.com/en/guide/routing.html)
- [EJS Documentation](https://ejs.co)

---

## Questions or Issues?

If you encounter any problems or have questions:

1. Check the [Troubleshooting](#part-12-troubleshooting) section
2. Review your environment variables
3. Check Azure Portal configuration
4. Review server logs: `heroku logs --tail` (for Heroku)

---

**Happy coding!** 🚀
