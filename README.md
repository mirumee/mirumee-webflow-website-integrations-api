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

`public/job-offers.js` supports **CMS-first** careers pages and a **legacy** Teamtailor JSON mode.

### CMS Collection list (recommended for `/careers`)

1. Add custom attribute **`data-job-offers-cms`** on a parent (e.g. `find_offer_section`).

2. The list wrapper must be **`[data-job-offers-list]`** or **`.job_offers_list`** and must wrap Webflow’s Collection list output.

3. With **`data-job-offers-cms`**, the script **does not** call the API or change list visibility. It:

   - finds each **`.w-dyn-item`** (or **`[data-job-offer-row]`** fallback) and sets **`[data-job-position]`** or **`.index_number`** to `01`, `02`, …;
   - updates **`.index_number`** outside **`.w-dyn-item`** in **`[data-find-offer-section]`**, **`.find_offer_section`**, or **`.find_offer_wrapper`** to the next index after the last job (empty list → `01`; avoids overwriting row numbers when the list sits inside the same section);
   - if **`.all_positions_wrapper`** and department tab buttons exist, builds tabs from **`data-job-department-id`** (and optional **`data-job-department-name`**) on each row or a descendant.

4. Optional: on the CMS row (e.g. link block), add custom attributes **`data-job-department-id`** and **`data-job-department-name`** bound from plain-text CMS fields for tab filtering.

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