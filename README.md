# Money Tracking Dashboard

A personal finance dashboard for your "Money Tracking - AUD" Google Sheet. Pure React + Chart.js frontend — no backend, no Apps Script. It talks to the Google Sheets API v4 directly from the browser, authenticated as *you* via Google Sign-In (OAuth2). Deployable to GitHub Pages.

## What it does

- **Dashboard**: net worth trend (all sources combined, cumulative), income vs expense by month (bar chart), spending breakdown by category (doughnut, filterable by month), recent transactions.
- **Sources**: current balance per source (Cash, Commonwealth, ING, savings accounts, etc.), click a source to see its full transaction history.
- **Add Transaction**: log Income or Expense against a source and category. Writes a new row to the `Transaction` sheet.
- **Transfer**: move money between two sources (e.g. Commonwealth → Commonwealth-Saving). Writes two linked rows (negative on the source, positive on the destination, tagged `Exchange (self)`), matching how your sheet already records transfers.
- Sources and category lists are fetched live from the `Metadata` sheet on every load — not hardcoded.

## Architecture — why sign-in is required

```
Browser (React app)
   │  OAuth access token (Google Identity Services, client-side only)
   ▼
Google Sheets API v4  ──  https://sheets.googleapis.com/...
   │
   ▼
Your "Money Tracking - AUD" spreadsheet
```

There's no server sitting between the browser and the sheet, so there's no OAuth *client secret* to hide — that's what makes a backend-free setup possible. But your spreadsheet is presumably private, and writing to it requires **your** authorization, not just a read-only API key. So the app asks you to sign in with the Google account that owns/can-edit the sheet, and uses the resulting access token (kept in `sessionStorage`, cleared when you close the tab) to call the Sheets API as you. Every request is subject to your own Google account's normal Sheets permissions — the app can't do anything you couldn't already do by editing the sheet directly.

## Setup

### 1. Google Cloud OAuth Client

1. Go to [Google Cloud Console](https://console.cloud.google.com/) → create or select a project.
2. **APIs & Services → Library** → enable **Google Sheets API**.
3. **APIs & Services → OAuth consent screen** → set up as "External" (or "Internal" if using a Workspace account), add your own email as a test user if the app stays in Testing mode.
4. **APIs & Services → Credentials → Create Credentials → OAuth client ID**:
   - Application type: **Web application**
   - Authorized JavaScript origins: add `http://localhost:5173` (for local dev) and your GitHub Pages URL, e.g. `https://<username>.github.io` (once you know it — you can add it after first deploy)
   - No redirect URIs needed (this uses the implicit token flow, not redirect-based)
5. Copy the **Client ID** (looks like `xxxx.apps.googleusercontent.com`). This is *not* a secret — it's fine to ship in frontend code — but it still goes in an env var for configurability.

### 2. Sheet ID

From your sheet's URL:
`https://docs.google.com/spreadsheets/d/`**`15KPHd1Y1NpjyvgROP7xL3LHsrRw8-Hdimz54RkX1-Is`**`/edit`

### 3. Frontend

```bash
cd frontend
cp .env.example .env
# edit .env: set VITE_GOOGLE_CLIENT_ID and VITE_SHEET_ID
npm install
npm run dev
```

Open the printed localhost URL, click **Sign in with Google**, and grant access when prompted (scope: `spreadsheets`, which allows read/write to sheets you already have access to — it does not grant access to other Google data).

### 4. Deploy to GitHub Pages

1. Push this repo to GitHub.
2. Repo Settings → Pages → Source: **GitHub Actions**.
3. Repo Settings → Secrets and variables → Actions → New repository secret:
   - `VITE_GOOGLE_CLIENT_ID`
   - `VITE_SHEET_ID`
4. Merge to `main` — `.github/workflows/deploy.yml` builds and publishes `frontend/dist` to Pages automatically, setting the Vite base path to `/<repo-name>/`.
5. Once you know the Pages URL, go back to Google Cloud Console → your OAuth client → add that URL to **Authorized JavaScript origins**.

**Sheet assumptions** — adjust `frontend/src/lib/sheetsApi.js` if yours differs:
- `Transaction` sheet: column A=Date, B=Change, C=Source, D=Comment, E=Sub category. Columns F onward (Main Category, Type, Month, Balance) are computed by your sheet's own formulas. When the app appends a new row, it copies the formulas from the row directly above (columns F→) into the new row via a Sheets API `copyPaste` request — same effect as dragging the formula down by hand. If those columns instead use a self-extending `ARRAYFORMULA` in row 2, the copy is a harmless no-op.
- `Metadata` sheet: contains a mini-table headed `Name | Type` (sources, e.g. Cash / Liquid) and another headed `Main Category | Sub category | Type` (category map). The app scans for these headers rather than fixed cell positions.

## File structure

```
frontend/
  src/
    hooks/useGoogleAuth.js     Google Identity Services OAuth (sign-in/out, token)
    hooks/useFinanceData.js    Loads transactions + metadata once signed in
    lib/sheetsApi.js           Direct Sheets API v4 calls (get/append/copy-formula)
    lib/transform.js           Parses sheet rows into balances, trends, category breakdowns
    lib/chartSetup.js          Chart.js global config (dark theme)
    components/                Card, NavBar, SignInScreen, charts, forms, transaction table
    pages/Dashboard.jsx        Trends + overview
    pages/Sources.jsx          Balances + per-source history
    App.jsx                    Sign-in gate + tab routing
  .env.example
.github/workflows/deploy.yml   CI: build + deploy to Pages on push to main
```

## Notes / limitations

- **Sign-in is per browser session** — closing the tab clears the token (by design, for safety on shared/public GitHub Pages hosting); reopening the app will prompt sign-in again (or silently re-auth if Google still has an active session and prior consent).
- **No delete/edit of existing transactions yet** — only appends (new transaction, transfer) are wired up. Say the word if you want update/delete added.
- **Currency parsing** handles both native Sheets numbers and `"$1,234.56"`-style strings, since your sheet mixes formats across sub-tables.
- **Net worth trend** sums *all* sources including savings — filter by source type (`Liquid` only) in `Dashboard.jsx` if you'd rather exclude savings from the headline number.
- If you ever want multiple people using this without each needing edit access to the raw sheet, that's a different trust model — you'd want the Apps Script (or similar) proxy back, scoped down to just the actions you allow.
