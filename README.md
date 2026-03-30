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

# Webflow — POST /app/api/sync-jobs (Teamtailor → CMS)
WEBFLOW_API_TOKEN=
WEBFLOW_JOBS_COLLECTION_ID=
SYNC_JOBS_SECRET=
# WEBFLOW_JOBS_FIELD_MAP={"title":"name","id":"slug","salaryDisplay":"my-salary-field"}
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

Base path in production: **`/app`** (see `next.config.ts`).

- `POST /app/api/submit-contact-form`
- `GET /app/api/get-pipedrive-user?userId=123`
- `GET /app/api/calendar?to=123`
- `GET /app/api/get-job-offers?company=kaiko`
- `POST /app/api/sync-jobs` — sync Teamtailor jobs into the Webflow **Jobs** collection (live items). Header **`x-sync-secret`**: value of `SYNC_JOBS_SECRET`. Optional query **`archiveMissing=1`**: archive CMS items whose slug no longer exists in Teamtailor.

### Webflow Jobs collection fields

Defaults in `src/lib/webflow-jobs-sync.ts` match this shape (field slug = Webflow “API name”):

| Webflow field     | Slug (typical)   | Sync source |
|-------------------|------------------|-------------|
| Name              | `name`           | Job title   |
| Slug              | `slug`           | TeamTailor job id (e.g. `7466842`) |
| Department        | `department`     | Department name (from job `included` or departments list) |
| Locations label   | `locations-label`| City / name per location from `included` |
| Remote status     | `remote-status`  | `remote` / `hybrid` / `none` — **must match your Option choices** in Webflow |
| Apply URL         | `apply-url`      | Link URL    |
| TeamTailor ID     | `teamtailor-id`  | Same as job id |
| Min / Max salary  | `min-salary`, `max-salary` | Numbers |
| Currency          | `currency`       | Plain text  |

**Description** (rich text) is not filled yet (needs a TeamTailor job-body fetch). Override or extend with **`WEBFLOW_JOBS_FIELD_MAP`** if your API names differ.

Webflow token: **Data API** with **CMS:read** and **CMS:write**. [Data API docs](https://developers.webflow.com/data/reference/rest-introduction).

Example:

```bash
curl -X POST 'https://<host>/app/api/sync-jobs?archiveMissing=1' \
  -H "x-sync-secret: $SYNC_JOBS_SECRET"
```

`GET /api/get-job-offers` returns:

```json
{
  "count": 0,
  "hasOffers": false,
  "offers": []
}
```

When no `company` query is provided, it returns all offers.

## Quick test (real offers + company filter)

When testing the real API response, you can filter jobs by company:

```text
GET https://<your-cloud-domain>/app/api/get-job-offers?company=kaiko
```

Notes:

- `company` matches the optional Teamtailor custom field value (`TEAMTAILOR_COMPANY_CUSTOM_FIELD_API_ID`)
- if `company` is omitted, the API returns every offer from Teamtailor (no company filter)

## Webflow script for job offers

`public/job-offers.js` supports **CMS-first** careers pages and a **legacy** Teamtailor JSON mode.

### CMS Collection list (recommended for `/careers`)

1. Custom attribute **`data-job-offers-cms`** on a parent section.

2. Wrapper around the Collection list: **`data-job-offers-list`** (or class **`job_offers_list`**).

3. Inside each collection item, on the element that shows the row number only: **`data-job-position`**. Do not CMS-bind that element if the script should own the value.

4. On the “Can’t find an offer?” number element: **`data-find-offer-index`** (value optional).

5. Optional department tabs: **`data-job-department-id`** and **`data-job-department-name`** on each row, plus **`.all_positions_wrapper`** + **`.all_positions_button`** in the Designer.

CMS mode does **not** call the API or hide the list.

### API-driven markup (legacy)

Use this only when **`data-job-offers-cms`** is **not** set. Requires **`[data-job-offers-list]`** and **`[data-job-offer-template]`**.

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