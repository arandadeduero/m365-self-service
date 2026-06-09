# Microsoft 365 Login Demo

A modern Node.js application demonstrating Microsoft 365 authentication with extended user data display using Fluent UI Web Components.

## Features

- ✅ **Microsoft 365 Authentication** - Single tenant OAuth 2.0 flow with MSAL
- ✅ **Extended User Data** - Profile, photo, groups, manager information
- ✅ **Groups Management** - View all tenant groups with membership status
- ✅ **Access Request Reports** - Generate text reports for group access requests
- ✅ **Fluent UI Design** - Microsoft-consistent design using Web Components
- ✅ **Dual Display Mode** - Formatted view + raw JSON data
- ✅ **Smart Error Handling** - Detailed dev errors vs. simple production messages
- ✅ **Testing Suite** - Ava test runner with c8 coverage
- ✅ **Auto-restart Dev Server** - Nodemon for efficient development
- ✅ **Heroku Ready** - Easy deployment to Heroku

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

- **Runtime**: Node.js >= 25.0.0
- **Framework**: Express 5.0.1
- **Template Engine**: EJS 3.1.10
- **Authentication**: @azure/msal-node 2.15.0
- **UI Components**: Fluent UI Web Components (beta)
- **HTTP Client**: axios 1.7.9
- **Session Management**: express-session 1.18.1
- **Testing**: ava 6.2.0 + c8 10.1.3
- **Dev Server**: nodemon 3.1.9

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

- **Name**: `M365 Login Demo` (or any name you prefer)
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
   - ✅ `User.ReadBasic.All` - Read all users' basic profiles
   - ✅ `GroupMember.Read.All` - Read user's group memberships
   - ✅ `Group.Read.All` - Read all groups in the tenant (for Groups page)
   - ✅ `Directory.Read.All` - Read directory data
   - ✅ `MailboxSettings.Read` - Read mailbox settings (for Shared Mailboxes detection)
   - ✅ `Mail.Send` - Send emails as the signed-in user (for manager correction requests)
   - ✅ `offline_access` - Maintain access to data
4. Click **Add permissions**
5. (Recommended) Click **Grant admin consent for [Your Organization]**
   - This allows users to sign in without individual consent prompts

### Step 6: Verify Settings

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
cd example-login-m365

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
```

**How to generate SESSION_SECRET:**

```bash
# macOS/Linux
openssl rand -base64 32

# Or using Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

### Step 4: Start the Development Server

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

### Step 5: Test the Application

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
example-login-m365/
├── package.json                      # Dependencies and scripts
├── .env.example                      # Environment variables template
├── .gitignore                        # Files to ignore in git
├── Procfile                          # Heroku deployment config
├── nodemon.json                      # Auto-restart configuration
├── README.md                         # This file
├── server.js                         # Main Express application
│
├── config/
│   ├── authConfig.js                # MSAL configuration
│   └── graphConfig.js               # Microsoft Graph API endpoints
│
├── middleware/
│   ├── auth.js                      # Authentication check middleware
│   └── errorHandler.js              # Error handling (dev vs prod)
│
├── routes/
│   ├── auth.js                      # Authentication routes
│   └── index.js                     # Main application routes
│
├── services/
│   └── graphService.js              # Microsoft Graph API calls
│
├── public/
│   ├── css/
│   │   └── custom.css               # Additional styling
│   ├── js/
│   │   └── profile.js               # Client-side JavaScript
│   └── images/
│       └── default-avatar.svg       # Default profile picture
│
├── views/
│   ├── partials/
│   │   ├── header.ejs               # Reusable header
│   │   └── footer.ejs               # Reusable footer
│   ├── login.ejs                    # Login page
│   ├── profile.ejs                  # User profile page
│   ├── error-dev.ejs                # Development error page
│   └── error-prod.ejs               # Production error page
│
└── test/
    ├── auth.test.js                 # Authentication tests
    └── routes.test.js               # Route tests
```

---

## Part 4: Testing

This project uses **ava** as the test runner and **c8** for code coverage.

### Run All Tests

```bash
npm test
```

### Run Tests in Watch Mode (for development)

```bash
npm run test:watch
```

### Generate Coverage Report

```bash
npm run coverage
```

This creates an HTML coverage report in the `coverage/` directory.

### Test Coverage

Current tests cover:
- ✅ Authentication routes (/auth/signin, /auth/callback, /auth/logout)
- ✅ Route protection (unauthenticated access)
- ✅ Login page rendering
- ✅ 404 error handling

---

## Part 5: Environment Variables

| Variable | Description | Example | Required |
|----------|-------------|---------|----------|
| `CLIENT_ID` | Application (client) ID from Azure | `12345678-1234-...` | Yes |
| `CLIENT_SECRET` | Client secret value from Azure | `abc123...` | Yes |
| `TENANT_ID` | Directory (tenant) ID from Azure | `87654321-4321-...` | Yes |
| `REDIRECT_URI` | OAuth callback URL | `http://localhost:3000/auth/callback` | Yes |
| `SESSION_SECRET` | Random string for session encryption | Generated random value | Yes |
| `PORT` | Port for the server | `3000` | No (default: 3000) |
| `NODE_ENV` | Environment mode | `development` or `production` | No (default: development) |

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
9. **Profile page rendered** with Fluent UI components
10. **User clicks "Logout"** → Session cleared → Redirected to login

### Session Management

- Sessions are stored in memory (server-side)
- Session cookies are HTTP-only (XSS protection)
- Secure flag enabled in production (HTTPS only)
- SameSite=lax (CSRF protection)
- Session lifetime: 24 hours

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

## Part 8: Error Handling

### Development Mode (`NODE_ENV=development`)

Shows detailed error information:
- Full error message
- Complete stack trace
- Request details (URL, method, headers)
- Session status
- Debugging hints

### Production Mode (`NODE_ENV=production`)

Shows user-friendly error messages:
- Large HTTP status code (e.g., 500)
- Simple explanation based on error type:
  - **401**: Authentication Required
  - **403**: Access Denied
  - **404**: Page Not Found
  - **500**: Internal Server Error
- "Return to Home" button
- NO sensitive information exposed

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

### Secrets

- ✅ Client secret never committed to git
- ✅ Environment variables for all sensitive data
- ✅ `.env` file in `.gitignore`
- ✅ Different secrets for dev and production

### Sessions

- ✅ Secure random session secret
- ✅ HTTP-only cookies (XSS protection)
- ✅ Secure flag in production (HTTPS only)
- ✅ SameSite=lax (CSRF protection)
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

### Issue: Port 3000 already in use

**Solution:** Change the port in `.env`:

```env
PORT=3001
```

### Issue: Tests failing

**Solution:** Make sure you have test environment variables set:

```bash
# The tests need these even with dummy values
export CLIENT_ID=test-id
export CLIENT_SECRET=test-secret
export TENANT_ID=test-tenant
export SESSION_SECRET=test-session-secret

npm test
```

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

## Part 14: Fluent UI Web Components

This application uses [Fluent UI Web Components](https://github.com/microsoft/fluentui/tree/master/packages/web-components) for Microsoft-consistent design.

### Components Used

- `<fluent-card>` - Card containers
- `<fluent-button>` - Buttons with Fluent styling
- `<fluent-divider>` - Section dividers
- `<fluent-accordion>` - Collapsible sections
- `<fluent-accordion-item>` - Individual accordion items

### Customization

Edit `public/css/custom.css` to customize:

```css
/* Override Fluent UI variables */
fluent-button[appearance="accent"] {
  --accent-fill-rest: #0078d4; /* Microsoft Blue */
}
```

### Documentation

- [Fluent UI Web Components Docs](https://learn.microsoft.com/en-us/fluent-ui/web-components/)
- [Component Examples](https://explore.fast.design/components/fast-button)

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

### Fluent UI

- [Fluent UI](https://developer.microsoft.com/en-us/fluentui)
- [Fluent Design System](https://www.microsoft.com/design/fluent/)

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
