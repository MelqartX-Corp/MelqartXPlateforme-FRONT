# 🚀 Firebase Hosting — Deployment Documentation

> **Projet :** PCB CUBEIT FRONT — Angular 19  
> **Firebase Project ID :** `pcb-pcba-platform`  
> **Live URL :** https://pcb-pcba-platform.web.app  
> **GitHub Repo :** https://github.com/Imtinen-Ayari/PCB_CUBEIT_FRONT  
> **Backend (Cloud Run) :** https://pcb-pcba-ms-user-lifbfhn44q-ew.a.run.app

---

## 📋 Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Prerequisites](#2-prerequisites)
3. [First-Time Setup (One Time Only)](#3-first-time-setup-one-time-only)
4. [CI/CD Pipeline — How Auto-Deployment Works](#4-cicd-pipeline--how-auto-deployment-works)
5. [Manual Deployment (Without GitHub Actions)](#5-manual-deployment-without-github-actions)
6. [Backend Configuration (CORS & OAuth2)](#6-backend-configuration-cors--oauth2)
7. [Firebase Project Configuration Files](#7-firebase-project-configuration-files)
8. [Environment Configuration](#8-environment-configuration)
9. [Common Errors & Fixes](#9-common-errors--fixes)
10. [Adding a New Microservice](#10-adding-a-new-microservice)

---

## 1. Architecture Overview

```
Developer's Machine
        │
        │  git push origin main
        ▼
  GitHub Repository
  (Imtinen-Ayari/PCB_CUBEIT_FRONT)
        │
        │  GitHub Actions triggered automatically
        ▼
  GitHub Actions Runner (Ubuntu)
  ┌─────────────────────────────────┐
  │  1. npm ci (install packages)   │
  │  2. ng build --configuration    │
  │     production                  │
  │  3. firebase deploy (upload     │
  │     dist/ to Firebase CDN)      │
  └─────────────────────────────────┘
        │
        ▼
  Firebase Hosting CDN
  https://pcb-pcba-platform.web.app
        │
        │  API calls (REST + JWT)
        ▼
  Google Cloud Run (Spring Boot)
  https://pcb-pcba-ms-user-lifbfhn44q-ew.a.run.app
```

---

## 2. Prerequisites

Before doing anything, make sure you have these installed on your machine:

| Tool | Version | How to check | Install |
|------|---------|--------------|---------|
| Node.js | >= 18 | `node -v` | https://nodejs.org |
| npm | >= 9 | `npm -v` | Bundled with Node.js |
| Angular CLI | >= 19 | `ng version` | `npm install -g @angular/cli` |
| Firebase CLI | >= 13 | `firebase --version` | `npm install -g firebase-tools` |
| Git | Any | `git --version` | https://git-scm.com |

---

## 3. First-Time Setup (One Time Only)

> ⚠️ This section is **already done** for this project. Read it to understand what was configured, or follow it if you need to set up from scratch on a new machine.

### Step 1 — Install Firebase CLI
```bash
npm install -g firebase-tools
```

### Step 2 — Login to Firebase
```bash
firebase login
```
This opens a browser window. Sign in with your Google account (`x@gmail.co`).  
To verify login worked: `firebase projects:list`

### Step 3 — Initialize Firebase Hosting

> ⚠️ **IMPORTANT:** When Firebase asks *"Would you like to use App Hosting instead?"* always answer **`n` (No)**. App Hosting requires a paid billing plan. We use standard Hosting which is FREE.

```bash
firebase init hosting
```

Answer the prompts exactly like this:

| Question | Answer |
|----------|--------|
| Are you ready to proceed? | `Y` |
| Please select an option | `Use an existing project` → select `pcb-pcba-platform` |
| Would you like to use App Hosting instead? | **`n` (No)** |
| What do you want to use as your public directory? | `dist/angular-workspace/browser` |
| Configure as a single-page app? | `y` (Yes) — **critical for Angular routing** |
| Set up automatic builds and deploys with GitHub? | `n` (No — done in next step) |
| Would you like to install agent skills for Firebase? | `n` (No) |
| File index.html already exists. Overwrite? | `n` (No) |

This creates two files:
- `firebase.json` — Firebase serving configuration
- `.firebaserc` — Links the local project to the Firebase project ID

### Step 4 — Connect GitHub for Automated Deployments

> ⚠️ Before running this command, make sure two Google Cloud APIs are **enabled** on your project:
> - `IAM Service Account Credentials API`  
> - `Cloud Resource Manager API`  
> Enable them at: https://console.cloud.google.com/apis/library (select project `pcb-pcba-platform`)

```bash
firebase init hosting:github
```

Answer the prompts exactly like this:

| Question | Answer |
|----------|--------|
| Are you ready to proceed? | `Y` |
| Log in to GitHub (browser opens) | Authorize Firebase |
| For which GitHub repository? | `Imtinen-Ayari/PCB_CUBEIT_FRONT` |
| Set up the workflow to run a build script before every deploy? | `y` |
| What script should be run before every deploy? | `npm ci && npm run build -- --configuration production` |
| Set up automatic deployment when a PR is merged? | `y` |
| What branch is associated with your live channel? | `main` |
| Would you like to install agent skills for Firebase? | `n` (No) |

This command automatically:
- Creates a service account in Google Cloud (`github-action-*`)
- Uploads the service account key as a GitHub secret: `FIREBASE_SERVICE_ACCOUNT_PCB_PCBA_PLATFORM`
- Creates `.github/workflows/firebase-hosting-merge.yml`
- Creates `.github/workflows/firebase-hosting-pull-request.yml`

### Step 5 — Push Everything to GitHub
```bash
git add .
git commit -m "chore: setup firebase hosting and automated github deployment"
git push origin main
```

Go to https://github.com/Imtinen-Ayari/PCB_CUBEIT_FRONT/actions and watch your first deployment run! ✅

---

## 4. CI/CD Pipeline — How Auto-Deployment Works

You never need to deploy manually again. The pipeline handles everything automatically.

### 🟢 Scenario 1: You push to `main` → Production Deploy

**File:** `.github/workflows/firebase-hosting-merge.yml`

```yaml
on:
  push:
    branches:
      - main         # Triggers on every push/merge to main
jobs:
  build_and_deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4              # Clone the repo
      - run: npm ci && npm run build -- --configuration production  # Build
      - uses: FirebaseExtended/action-hosting-deploy@v0  # Deploy to live
        with:
          channelId: live                      # → goes to PRODUCTION
          projectId: pcb-pcba-platform
          firebaseServiceAccount: ${{ secrets.FIREBASE_SERVICE_ACCOUNT_PCB_PCBA_PLATFORM }}
```

**Result:** Your changes are live at https://pcb-pcba-platform.web.app in ~2 minutes ⚡

---

### 🔵 Scenario 2: You open a Pull Request → Preview Deploy

**File:** `.github/workflows/firebase-hosting-pull-request.yml`

```yaml
on: pull_request    # Triggers on every PR opened or updated
jobs:
  build_and_preview:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci && npm run build -- --configuration production
      - uses: FirebaseExtended/action-hosting-deploy@v0
        with:
          # channelId NOT set → creates a temporary preview URL
          projectId: pcb-pcba-platform
          firebaseServiceAccount: ${{ secrets.FIREBASE_SERVICE_ACCOUNT_PCB_PCBA_PLATFORM }}
```

**Result:** GitHub bot posts a comment on your PR with a unique preview URL like:  
`https://pcb-pcba-platform--pr123-feature-xyz-abc123.web.app`

This lets you **test your feature without touching production**!

---

### 🔄 Your Daily Development Workflow

```
Feature Development
──────────────────
1. Create a new branch:
   git checkout -b feature/my-new-feature

2. Write your code...

3. Commit and push:
   git add .
   git commit -m "feat: add my new feature"
   git push origin feature/my-new-feature

4. Open a Pull Request on GitHub
   → GitHub Actions builds a PREVIEW URL automatically
   → You can test on the preview URL before merging

5. After review, merge the PR into main
   → GitHub Actions builds and deploys to PRODUCTION automatically
   → Live in ~2 minutes at https://pcb-pcba-platform.web.app
```

---

## 5. Manual Deployment (Without GitHub Actions)

Use this when you want to deploy directly from your machine without going through GitHub.

### Step 1 — Build the Angular App
```bash
# From the project root
ng build --configuration production
# OR
npm run build -- --configuration production
```
The output is generated in: `dist/angular-workspace/browser/`

### Step 2 — Deploy to Firebase
```bash
firebase deploy --only hosting
```

### One-liner (build + deploy)
```bash
npm run build -- --configuration production && firebase deploy --only hosting
```

> ⚠️ **Note:** Make sure you are logged in first: `firebase login`

---

## 6. Backend Configuration (CORS & OAuth2)

Because your frontend is now hosted at `https://pcb-pcba-platform.web.app`, your Spring Boot backend on Cloud Run must be updated to allow requests from this new domain.

### 6.1 — Spring Boot CORS Configuration

In your Spring Security config (usually `SecurityConfig.java` or `CorsConfig.java`), add the Firebase URLs to the list of allowed origins:

```java
configuration.setAllowedOrigins(Arrays.asList(
    "http://localhost:4200",                        // Local development
    "https://pcb-pcba-platform.web.app",            // Firebase Hosting (main)
    "https://pcb-pcba-platform.firebaseapp.com"     // Firebase Hosting (alt)
    // If you use preview deploys, you may need to add a wildcard later
));
```

After changing the backend, redeploy it to Cloud Run.

### 6.2 — Google OAuth2 Redirect URIs

When a user logs in with Google, your backend redirects them back to the frontend after authentication. You must add the Firebase URL to the list of authorized redirect URIs in Google Cloud Console.

**Steps:**
1. Go to https://console.cloud.google.com/
2. Select your project
3. Navigate to **APIs & Services > Credentials**
4. Click on your **OAuth 2.0 Client ID**
5. Under **Authorized redirect URIs**, add:
   ```
   https://pcb-pcba-platform.web.app/oauth2/callback
   ```
6. Click **Save**

Also update the `redirectUri` in your Spring Boot `application.yml` / environment variables:
```yaml
spring:
  security:
    oauth2:
      client:
        registration:
          google:
            redirect-uri: "https://pcb-pcba-platform.web.app/oauth2/callback"
```

---

## 7. Firebase Project Configuration Files

### `firebase.json`
Controls how Firebase serves and routes your Angular app.
```json
{
  "hosting": {
    "public": "dist/angular-workspace/browser",
    "ignore": [
      "firebase.json",
      "**/.*",
      "**/node_modules/**"
    ],
    "rewrites": [
      {
        "source": "**",
        "destination": "/index.html"
      }
    ]
  }
}
```

> ⚠️ The `rewrites` rule `"** → /index.html"` is **critical**. Without it, refreshing or directly navigating to a URL like `/dashboard` would return a 404 error. This rule tells Firebase to always serve `index.html` and let Angular's router handle the path.

### `.firebaserc`
Links your local project directory to your Firebase project.
```json
{
  "projects": {
    "default": "pcb-pcba-platform"
  }
}
```

---

## 8. Environment Configuration

Angular uses environment files to switch between dev and production backend URLs.

### `src/environments/environment.ts` (Development)
Used when running `ng serve` locally.
```typescript
export const environment = {
  production: false,
  services: {
    msUser: 'http://localhost:8089',
    // msOrder: 'http://localhost:8090',
  },
};
```

### `src/environments/environment.production.ts` (Production)
Automatically used by `ng build --configuration production`.
```typescript
export const environment = {
  production: true,
  services: {
    msUser: 'https://pcb-pcba-ms-user-lifbfhn44q-ew.a.run.app',
    // msOrder: 'https://pcb-pcba-ms-order-lifbfhn44q-ew.a.run.app',
  },
};
```

The swap between these two files is configured in `angular.json`:
```json
"fileReplacements": [
  {
    "replace": "src/environments/environment.ts",
    "with": "src/environments/environment.production.ts"
  }
]
```

---

## 9. Common Errors & Fixes

### ❌ Error: `Invalid values: Argument: project, Given: "production"`
**Cause:** Wrong syntax for the build script. The `--` separator is missing.
```bash
# ❌ WRONG — npm consumes the flag
npm run build --configuration production

# ✅ CORRECT — npm passes the flag to ng build
npm run build -- --configuration production
```
**Fix:** Update both `.github/workflows/*.yml` files to use `--` before `--configuration`.

---

### ❌ Error: `Service account ... does not exist (404)` during `firebase init hosting:github`
**Cause:** Two Google Cloud APIs are disabled on the project.  
**Fix:** Enable both of these APIs in Google Cloud Console:
- `IAM Service Account Credentials API`
- `Cloud Resource Manager API`

Then re-run `firebase init hosting:github`.

---

### ❌ Error: `Firebase App Hosting requires billing to be enabled`
**Cause:** You answered `Yes` to "Would you like to use App Hosting instead?" when running `firebase init hosting`.  
**Fix:** Re-run `firebase init hosting` and answer **`n` (No)** to that question.

---

### ❌ Error: CORS error in browser after deploying to Firebase
**Cause:** The Spring Boot backend doesn't allow requests from `https://pcb-pcba-platform.web.app`.  
**Fix:** Add the Firebase URL to the `allowedOrigins` list in your Spring Boot CORS configuration (see Section 6.1).

---

### ❌ Error: Angular routes return 404 on page refresh
**Cause:** `firebase.json` is missing the `rewrites` rule.  
**Fix:** Make sure `firebase.json` has this rule:
```json
"rewrites": [{ "source": "**", "destination": "/index.html" }]
```

---

### ❌ Error: Google OAuth2 login fails after deploying
**Cause:** The OAuth2 redirect URI is not registered in Google Cloud Console.  
**Fix:** Add `https://pcb-pcba-platform.web.app/oauth2/callback` to the list of Authorized Redirect URIs (see Section 6.2).

---

## 10. Adding a New Microservice

When you add a new Spring Boot microservice (e.g., `ms-order`) and deploy it to Cloud Run:

**Step 1:** Add its URL to `src/environments/environment.production.ts`:
```typescript
services: {
  msUser:  'https://pcb-pcba-ms-user-lifbfhn44q-ew.a.run.app',
  msOrder: 'https://pcb-pcba-ms-order-lifbfhn44q-ew.a.run.app', // ← Add this
},
```

**Step 2:** Add it to `src/environments/environment.ts` for local development:
```typescript
services: {
  msUser:  'http://localhost:8089',
  msOrder: 'http://localhost:8090', // ← Add this
},
```

**Step 3:** Inject and use it in your Angular service:
```typescript
private base = environment.services.msOrder;
```

**Step 4:** Commit and push to `main`. The CI/CD pipeline will rebuild and redeploy automatically.

---

## 🔑 GitHub Secrets (Auto-managed by Firebase CLI)

| Secret Name | Description | Managed by |
|-------------|-------------|------------|
| `FIREBASE_SERVICE_ACCOUNT_PCB_PCBA_PLATFORM` | Service account key to authenticate Firebase deploys | Firebase CLI (auto) |
| `GITHUB_TOKEN` | Standard GitHub token for PR comments | GitHub (auto) |

> These secrets are stored in https://github.com/Imtinen-Ayari/PCB_CUBEIT_FRONT/settings/secrets/actions and are automatically injected by GitHub Actions during pipeline execution. **Never commit these values to your code.**

---

*Documentation generated for PCB CUBEIT FRONT — Angular 19 + Firebase Hosting + GitHub Actions CI/CD*
