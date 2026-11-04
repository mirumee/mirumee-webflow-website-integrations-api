interface PipedriveResponse<T = Record<string, unknown>> {
  success: boolean;
  data: T;
}

interface PipedriveEntity {
  id: number;
  [key: string]: unknown;
}

const PIPEDRIVE_BASE = "https://api.pipedrive.com/v1";

function getApiToken(): string {
  const token = process.env.PIPEDRIVE_X_API_TOKEN;
  if (!token) throw new Error("Missing PIPEDRIVE_X_API_TOKEN");
  return token;
}

function apiUrl(path: string): string {
  const separator = path.includes("?") ? "&" : "?";
  return `${PIPEDRIVE_BASE}${path}${separator}api_token=${getApiToken()}`;
}

// Pipedrive user ID -> booking link. Also the list of salespeople a lead can
// be routed to via ?to= on /contact.
export const CALENDAR_LINKS: Record<string, string> = {
  "24022103": "https://calendar.app.google/UKzornFSVfqTjpjH6",
  "17062690": "https://calendar.app.google/fF41H84PgsiTZ2Jm8",
  "25079049": "https://calendar.app.google/L3fY4xaEJ9C3RzFq5",
};

export const DEFAULT_CALENDAR_LINK = "https://calendar.app.google/UKzornFSVfqTjpjH6";

export function isKnownSalesUser(userId: string | undefined): userId is string {
  return !!userId && Object.prototype.hasOwnProperty.call(CALENDAR_LINKS, userId);
}

const JSON_HEADERS = {
  "Content-Type": "application/json",
  Accept: "application/json",
};

interface CreatePersonParams {
  name: string;
  email: string;
  phone?: string;
}

interface PersonSearchResponse {
  success: boolean;
  data: { items: { item: PipedriveEntity }[] } | null;
}

export async function findPersonByEmail(email: string): Promise<PipedriveEntity | null> {
  const query = new URLSearchParams({ term: email, fields: "email", exact_match: "true" });
  const response = await fetch(apiUrl(`/persons/search?${query}`), {
    method: "GET",
    headers: { Accept: "application/json" },
  });

  const json: PersonSearchResponse = await response.json();
  if (!response.ok) throw new Error(`Pipedrive findPersonByEmail failed: ${JSON.stringify(json)}`);
  return json.data?.items[0]?.item ?? null;
}

export async function createPerson({ name, email, phone }: CreatePersonParams) {
  const response = await fetch(apiUrl("/persons"), {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify({
      name,
      email: [{ value: email, primary: true, label: "Work" }],
      ...(phone ? { phone: [{ value: phone, primary: true, label: "Work" }] } : {}),
      label: "109",
    }),
  });

  const json: PipedriveResponse<PipedriveEntity> = await response.json();
  if (!response.ok) throw new Error(`Pipedrive createPerson failed: ${JSON.stringify(json)}`);
  return json.data;
}

interface CreateDealParams {
  name: string;
  email: string;
  message: string;
  userId: string;
  personId: number;
  customFields?: Record<string, string>;
}

// Pipedrive "Message" deal field (long text). Unset = message only in the note.
function messageField(message: string): Record<string, string> {
  const fieldKey = process.env.PIPEDRIVE_FIELD_MESSAGE;
  return fieldKey ? { [fieldKey]: message } : {};
}

const WEB_FORMS_CHANNEL_ID = 99;

export async function createDeal({ name, email, message, userId, personId, customFields }: CreateDealParams) {
  const response = await fetch(apiUrl("/deals"), {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify({
      title: `${name} (${email})`,
      user_id: userId,
      person_id: personId,
      channel: WEB_FORMS_CHANNEL_ID,
      ...messageField(message),
      ...customFields,
    }),
  });

  const json: PipedriveResponse<PipedriveEntity> = await response.json();
  if (!response.ok) throw new Error(`Pipedrive createDeal failed: ${JSON.stringify(json)}`);
  return json.data;
}

export interface Attribution {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_term?: string;
  utm_content?: string;
  gclid?: string;
  gbraid?: string;
  wbraid?: string;
  landing_page?: string;
  referrer?: string;
  ga_client_id?: string;
  ga_session_id?: string;
  // Set server-side from the request's geo headers, not by the client.
  city?: string;
}

// Attribution key -> env var holding the Pipedrive deal custom field key.
const ATTRIBUTION_FIELD_ENV: Partial<Record<keyof Attribution, string>> = {
  ga_client_id: "PIPEDRIVE_FIELD_GA_CLIENT_ID",
  utm_source: "PIPEDRIVE_FIELD_UTM_SOURCE",
  utm_medium: "PIPEDRIVE_FIELD_UTM_MEDIUM",
  utm_campaign: "PIPEDRIVE_FIELD_UTM_CAMPAIGN",
  utm_term: "PIPEDRIVE_FIELD_UTM_TERM",
  utm_content: "PIPEDRIVE_FIELD_UTM_CONTENT",
  gclid: "PIPEDRIVE_FIELD_GCLID",
  landing_page: "PIPEDRIVE_FIELD_LANDING_PAGE",
  referrer: "PIPEDRIVE_FIELD_REFERRER",
};

export function attributionToDealFields(attribution?: Attribution): Record<string, string> {
  const fields: Record<string, string> = {};
  if (!attribution) return fields;
  for (const [attrKey, envName] of Object.entries(ATTRIBUTION_FIELD_ENV)) {
    const fieldKey = process.env[envName];
    const value = attribution[attrKey as keyof Attribution];
    // Pipedrive varchar fields reject values longer than 255 chars.
    if (fieldKey && value) fields[fieldKey] = value.slice(0, 255);
  }
  return fields;
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function formatAttributionNote(attribution?: Attribution): string {
  if (!attribution) return "";
  const lines = Object.entries(attribution)
    .filter(([, value]) => value)
    .map(([key, value]) => `${key}: ${escapeHtml(value)}`);
  return lines.length ? `<br><br><b>Attribution</b><br>${lines.join("<br>")}` : "";
}

interface CreateNoteParams {
  message: string;
  dealId: number;
  personId: number;
  userId: string;
}

export async function createNote({ message, dealId, personId, userId }: CreateNoteParams) {
  const response = await fetch(apiUrl("/notes"), {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify({
      content: message,
      deal_id: dealId,
      person_id: personId,
      user_id: userId,
    }),
  });

  const json: PipedriveResponse<PipedriveEntity> = await response.json();
  if (!response.ok) throw new Error(`Pipedrive createNote failed: ${JSON.stringify(json)}`);
  return json.data;
}

export interface PipedriveUserData {
  id: number;
  name: string;
  icon_url: string | null;
}

export async function fetchUser(userId: string): Promise<PipedriveUserData | null> {
  try {
    const response = await fetch(apiUrl(`/users/${userId}`), {
      method: "GET",
      headers: { Accept: "application/json" },
    });

    if (!response.ok) return null;

    const data: PipedriveResponse<PipedriveEntity> = await response.json();
    if (data.success && data.data) {
      return {
        id: data.data.id,
        name: data.data.name as string,
        icon_url: (data.data.icon_url as string | null),
      };
    }
  } catch (error) {
    console.error("Error fetching Pipedrive user:", error);
  }
  return null;
}
