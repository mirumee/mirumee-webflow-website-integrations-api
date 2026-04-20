This is a [Next.js](https://nextjs.org) project bootstrapped with [`webflow cloud init`](https://developers.webflow.com/webflow-cloud/intro).

## Environment variables

Copy `.env.example` to `.env` and fill in the values. See comments in `.env.example` for details.

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
- `POST /app/api/sync-jobs` — sync Teamtailor jobs into the Webflow **Jobs** collection (live items). Header **`x-sync-secret`**: value of `SYNC_JOBS_SECRET`. Query **`skipArchive=1`** to keep Webflow items whose slug is no longer in Teamtailor (default: archive them). Called every 10 min by the GitHub Action in `.github/workflows/sync-jobs.yml` — see [Scheduled sync](#scheduled-sync).

### Webflow Jobs collection fields

Defaults in `src/lib/webflow-jobs-sync.ts` match this shape (field slug = Webflow "API name"):

| Webflow field    | Slug (typical)             | Sync source                                               |
| ---------------- | -------------------------- | --------------------------------------------------------- |
| Name             | `name`                     | Job title                                                 |
| Slug             | `slug`                     | TeamTailor job id (e.g. `7466842`)                        |
| Department       | `department`               | Department name (from job `included` or departments list) |
| Locations label  | `locations-label`          | City / name per location from `included`                  |
| Remote status    | `remote-status-2`          | `remote` / `hybrid` / `none` (plain text)                 |
| Apply URL        | `apply-url`                | Link URL                                                  |
| TeamTailor ID    | `teamtailor-id`            | Same as job id                                            |
| Description      | `description`              | Job body HTML from Teamtailor (falls back to pitch)       |
| Min / Max salary | `min-salary`, `max-salary` | Numbers                                                   |
| Currency         | `currency`                 | Plain text                                                |

Override or extend with **`WEBFLOW_JOBS_FIELD_MAP`** if your API names differ.

Webflow token: **Data API** with **CMS:read** and **CMS:write**. [Data API docs](https://developers.webflow.com/data/reference/rest-introduction).

Example:

```bash
curl -X POST 'https://<host>/app/api/sync-jobs' \
  -H "x-sync-secret: $SYNC_JOBS_SECRET"
```

## Scheduled sync

Teamtailor does not push changes to us; instead a GitHub Action calls `POST /app/api/sync-jobs` on a schedule. The sync fetches jobs live from the Teamtailor REST API (`fetchJobOffers` in `src/lib/teamtailor.ts`) and upserts/archives Webflow CMS items accordingly.

Workflow: [`.github/workflows/sync-jobs.yml`](.github/workflows/sync-jobs.yml)

- Cron: every 10 minutes (`*/10 * * * *`). GitHub Actions has a 5-min floor and deliveries can lag up to ~15 min under load.
- Manual run: Actions → **Sync Teamtailor jobs to Webflow** → **Run workflow**.
- If you do not want to wait for the next scheduled run, trigger the workflow manually from GitHub Actions: [Sync Teamtailor jobs to Webflow ](https://github.com/mirumee/mirumee-webflow-website-integrations-api/actions/runs/24664590885).
- Optional input `skip_archive` on manual runs — keep Webflow items whose slug is no longer in Teamtailor.

Required GitHub config (Settings → Secrets and variables → Actions):

| Kind     | Name               | Value                                              |
| -------- | ------------------ | -------------------------------------------------- |
| Secret   | `SYNC_JOBS_SECRET` | Same value as `SYNC_JOBS_SECRET` in production env |
| Variable | `SYNC_JOBS_URL`    | `https://<host>/app/api/sync-jobs`                 |

Behaviour:

- New job in Teamtailor → `created: 1` on next run, item appears in Webflow CMS.
- Field change (title, body, salary, department, location, remote status…) → `updated: 1`, item updated.
- Unlist / archive / delete in Teamtailor → `archived: 1`, item moved to Webflow's Archived tab.

Visitors see updates only after the Webflow **site** is published. Item-level publish is already done by the sync (it uses `/items/live`), but the public site cache needs a site publish to refresh.

## API reference

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

4. On the "Can't find an offer?" number element: **`data-find-offer-index`** (value optional).

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

<div data-job-offers-empty style="display:none;">No open roles right now.</div>
```

Then include:

```html
<script src="https://<your-cloud-domain>/job-offers.js"></script>
```
