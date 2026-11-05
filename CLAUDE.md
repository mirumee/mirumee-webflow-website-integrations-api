# CLAUDE.md

## Webflow Cloud apps and environment variables

There are two Webflow Cloud apps for this repo:

| App | App ID | Site | Purpose |
| --- | --- | --- | --- |
| `mirumee-webflow-website-integrations-api` | `4ed03436-df90-4c2d-a682-dcd66c4265f6` | Mirumee | **Production.** Connected to this GitHub repo and auto-deploys on push to `main`. Environment `main` (`4185a3fe-c624-46a1-8060-f69b9aeeb608`), mounted at `/app`. |
| `contact-form-api` | `a888c796-fa7e-46db-adb3-139b0fd8615d` | Mirumee Design (staging) | The app referenced in `webflow.json`. **This is intentional; don't change `webflow.json`.** |

- For now, manage env vars **only on production** (`4ed03436-…`, env `4185a3fe-…`). The app in `webflow.json` is not the one serving the live site.
- Local dev reads `.env.local` (gitignored). Every new variable goes in `.env.local`, in `.env.example` (empty value), and in the production app.
- Use the Webflow CLI to write env vars. The Webflow MCP can only read variable metadata.
  ```bash
  npx @webflow/webflow-cli apps env-vars import <file.env> \
    --app-id 4ed03436-df90-4c2d-a682-dcd66c4265f6 \
    --environment-id 4185a3fe-c624-46a1-8060-f69b9aeeb608 \
    --skip-existing --dry-run   # drop --dry-run to apply
  ```
  Write the import file to a temp location containing only the keys you need. Never import the whole `.env.local`. Mark secrets with `--secret`.
- New env vars only take effect after the next deploy (a push to `main`).

## Pipedrive

- Use `PIPEDRIVE_X_API_TOKEN` from `.env.local` for Pipedrive API calls. Never print it.
- Deal attribution custom fields are mapped through the `PIPEDRIVE_FIELD_*` env vars (see `src/lib/pipedrive.ts` `ATTRIBUTION_FIELD_ENV`). The fields are varchar, so values are truncated to 255 characters.

## Tracking (GA4)

`public/track.js` and `public/contact-form.js` are served from `/app/` and loaded by the Webflow site (`track.js` in site footer code, `contact-form.js` in page footer code of each page with a lead form).

- **Click events:** `<a>`/`<button>` with `data-track="foo-bar"` sends `foo_bar_click` with `track_location` (`data-track-location`), `track_name` (`data-track-name`) and `link_url`. Set these as custom attributes in the Webflow Designer.
- **Code Embeds:** elements inside HTML Embeds are tagged by the `AUTO_TAGS` rules in `public/track.js`, not in the embed HTML. Each rule is scoped to a page class: the custom attribute `class` set on **every** Code Embed of that page in Webflow (it renders as `class="w-embed <page>"`). Renaming or removing that attribute silently disables the page's rules.

  | Page | Embed `class` |
  | --- | --- |
  | /product-design | `product-design` |
  | /case-study/&lt;slug&gt; | `case-study-<slug>` (breitling, butterfly, lulu, rough-trade, spaya, butterfly-design, extrarx, homenow, prismavet) |

  For a new HTML page: add the `class` attribute to its embeds, then add rules to `AUTO_TAGS`. Check the class name doesn't match an existing Webflow style.
- **Lead forms:** a `<form data-lead-form="<location>">` on a page that loads `/app/contact-form.js` is submitted to `/app/api/submit-contact-form` (Pipedrive), and `generate_lead` is sent with `track_location=<location>` and `deal_id`. Current forms: `contact`, `health-data-ai`, `saleor`, `saleor-enterprise`.
- **reCAPTCHA v3:** `contact-form.js` gets the site key from `/app/api/recaptcha-config` and sends a token (action `submit_contact_form`) with each submission; the API rejects missing/low-score tokens (`RECAPTCHA_MIN_SCORE`, default 0.5). Verification is skipped when `RECAPTCHA_SECRET_KEY` is unset (local dev).
