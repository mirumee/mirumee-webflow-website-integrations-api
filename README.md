This is a [Next.js](https://nextjs.org) project bootstrapped with [`webflow cloud init`](https://developers.webflow.com/webflow-cloud/intro).

## Environment variables

Create a `.env` (based on `.env.example`) with:

```bash
# Pipedrive
PIPEDRIVE_X_API_TOKEN=...
PIPEDRIVE_DEFAULT_USER_ID=...

# Google Sheets (fallback for @gmail.com submissions)
GMAIL_CONTACT_SPREADSHEET_ID=...
GMAIL_CONTACT_SPREADSHEET_RANGE=Sheet1!A:D
GOOGLE_SERVICE_CLIENT_EMAIL=...
GOOGLE_SERVICE_PRIVATE_KEY_2=...

# CORS
ALLOWED_ORIGINS=https://your-site.webflow.io,https://your-domain.com

# Teamtailor (for /api/get-job-offers)
TEAMTAILOR_API_KEY=...
TEAMTAILOR_COMPANY_CUSTOM_FIELD_API_ID=... # optional, needed for company filtering

# Optional — Teamtailor /v1/jobs list filters (see https://docs.teamtailor.com/ )
# Defaults on Teamtailor’s side: filter[status]=published, filter[feed]=public.
# Use when jobs are internal-only, unlisted, etc. (may require an Internal-scoped API key).
# TEAMTAILOR_JOBS_FILTER_STATUS=published
# TEAMTAILOR_JOBS_FILTER_FEED=public
```

## Getting Started

First, run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

You can deploy your app by running [`webflow cloud deploy`](https://developers.webflow.com/webflow-cloud/environment).

## API routes

- `POST /api/submit-contact-form`
- `GET /api/get-pipedrive-user?userId=123`
- `GET /api/calendar?to=123`
- `GET /api/get-job-offers?company=kaiko`

`GET /api/get-job-offers` returns:

```json
{
  "count": 0,
  "hasOffers": false,
  "offers": []
}
```

When no `company` query is provided, it returns all offers.

## Quick test (UI mock data)

To verify the Webflow UI wiring without calling Teamtailor, load the careers page with:

- `?mockJobs=1`

Example:

```text
https://<your-webflow-domain>/careers?mockJobs=1
```

When `mockJobs=1` is present, `public/job-offers.js` renders mock offers (2 roles) so you can confirm:

- tabs appear
- job rows clone/render correctly
- “no offers” state behavior

## Quick test (real offers + company filter)

When testing the real API response, you can filter jobs by company:

```text
GET https://<your-cloud-domain>/app/api/get-job-offers?company=kaiko
```

Notes:

- `company` matches the optional Teamtailor custom field value (`TEAMTAILOR_COMPANY_CUSTOM_FIELD_API_ID`)
- if `company` is omitted, the API returns every offer from Teamtailor (no company filter)

## Webflow script for job offers

This repo now includes `public/job-offers.js` to render offers in Webflow only when offers are available.

Expected markup:

```html
<div data-job-offers-wrapper data-company="kaiko" style="display:none;">
  <template data-job-offer-template>
    <a data-job-offer-item data-job-link href="#">
      <span data-job-position></span>
      <span data-job-title></span>
      <span data-job-salary></span>
    </a>
  </template>
  <div data-job-offers-list></div>
</div>

<div data-job-offers-empty style="display:none;">
  No open roles right now.
</div>
```

Then include:

```html
<script src="https://<your-cloud-domain>/job-offers.js"></script>
```