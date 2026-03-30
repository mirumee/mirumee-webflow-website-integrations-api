const TEAMTAILOR_BASE_URL = "https://api.teamtailor.com/v1";
const TEAMTAILOR_API_VERSION = "20240404";

function getTeamtailorApiKey(): string {
  const apiKey = process.env.TEAMTAILOR_API_KEY;
  if (!apiKey) {
    throw new Error("Missing TEAMTAILOR_API_KEY");
  }
  return apiKey;
}

function getTeamtailorHeaders(): HeadersInit {
  return {
    Authorization: `Token token=${getTeamtailorApiKey()}`,
    "X-Api-Version": TEAMTAILOR_API_VERSION,
    // Teamtailor API is JSON:API; it rejects plain `application/json` with HTTP 406.
    Accept: "application/vnd.api+json",
  };
}

interface TeamtailorRelationRef {
  id: string;
  type: string;
}

interface TeamtailorJobRaw {
  id: string;
  attributes: {
    title: string;
    "remote-status"?: "none" | "hybrid" | "remote";
    "min-salary"?: number | null;
    "max-salary"?: number | null;
    currency?: string | null;
  };
  links?: {
    "careersite-job-url"?: string;
    "careersite-job-apply-url"?: string;
  };
  relationships: {
    department?: {
      data?: TeamtailorRelationRef | null;
    };
    locations?: {
      data?: TeamtailorRelationRef[];
    };
    "custom-field-values"?: {
      data?: TeamtailorRelationRef[];
    };
  };
}

interface TeamtailorCustomFieldValue {
  id: string;
  attributes: {
    value?: string[] | null;
  };
}

/** Resource returned in `included` when jobs are fetched with `include=department,locations`. */
interface JsonApiIncluded {
  id: string;
  type: string;
  attributes?: {
    name?: string;
    city?: string;
    [key: string]: unknown;
  };
}

export interface JobOffer {
  id: string;
  title: string;
  departmentId: string | null;
  /** Department display name when present in job `included` or resolved from API. */
  departmentName: string | null;
  locationIds: string[];
  /** City / name per location, or id fallback, comma-separated for CMS. */
  locationsLabel: string;
  url: string | null;
  applyUrl: string | null;
  remoteStatus: "none" | "hybrid" | "remote";
  minSalary: number | null;
  maxSalary: number | null;
  currency: string | null;
  company: string | null;
}

interface DepartmentRow {
  id: string;
  name: string;
}

/** Max page size per Teamtailor list docs (default is 10 if omitted). */
const JOBS_PAGE_SIZE = 30;
const DEPARTMENTS_PAGE_SIZE = 30;

interface JobsListResponse {
  data?: TeamtailorJobRaw[];
  included?: JsonApiIncluded[];
  links?: { next?: string | null };
}

function mergeIncludedIntoMaps(
  included: JsonApiIncluded[] | undefined,
  departmentNames: Map<string, string>,
  locationLabels: Map<string, string>,
) {
  for (const inc of included ?? []) {
    if (inc.type === "departments") {
      const name = inc.attributes?.name;
      if (typeof name === "string" && name.length > 0) {
        departmentNames.set(inc.id, name);
      }
    }
    if (inc.type === "locations") {
      const a = inc.attributes;
      const label =
        (typeof a?.city === "string" && a.city) ||
        (typeof a?.name === "string" && a.name) ||
        "";
      if (label) {
        locationLabels.set(inc.id, label);
      }
    }
  }
}

function buildInitialJobsUrl(): string {
  const params = new URLSearchParams({
    include: "department,locations,custom-field-values",
    "page[size]": String(JOBS_PAGE_SIZE),
    "page[number]": "1",
  });

  const statusFilter = process.env.TEAMTAILOR_JOBS_FILTER_STATUS?.trim();
  const feedFilter = process.env.TEAMTAILOR_JOBS_FILTER_FEED?.trim();
  if (statusFilter) {
    params.set("filter[status]", statusFilter);
  }
  if (feedFilter) {
    params.set("filter[feed]", feedFilter);
  }

  return `${TEAMTAILOR_BASE_URL}/jobs?${params.toString()}`;
}

async function fetchAllJobsWithIncluded(
  headers: HeadersInit,
): Promise<{
  jobs: TeamtailorJobRaw[];
  departmentNames: Map<string, string>;
  locationLabels: Map<string, string>;
}> {
  const jobs: TeamtailorJobRaw[] = [];
  const departmentNames = new Map<string, string>();
  const locationLabels = new Map<string, string>();
  let url: string | null = buildInitialJobsUrl();

  while (url) {
    const response = await fetch(url, { headers });
    if (!response.ok) {
      const payload = await response.text();
      throw new Error(`Teamtailor jobs request failed: ${response.status} ${payload}`);
    }
    const json = (await response.json()) as JobsListResponse;
    jobs.push(...(json.data ?? []));
    mergeIncludedIntoMaps(json.included, departmentNames, locationLabels);
    const next = json.links?.next;
    url = next && typeof next === "string" && next.length > 0 ? next : null;
  }

  return { jobs, departmentNames, locationLabels };
}

/** Used when job `included` omits a department; fills names for {@link fetchJobOffers}. */
async function fetchDepartments(): Promise<DepartmentRow[]> {
  const headers = getTeamtailorHeaders();
  const rows: DepartmentRow[] = [];
  let url: string | null = `${TEAMTAILOR_BASE_URL}/departments?page[size]=${DEPARTMENTS_PAGE_SIZE}&page[number]=1`;

  while (url) {
    const response = await fetch(url, { headers });
    if (!response.ok) {
      const payload = await response.text();
      throw new Error(`Teamtailor departments request failed: ${response.status} ${payload}`);
    }
    const json = (await response.json()) as {
      data?: Array<{ id: string; attributes?: { name?: string } }>;
      links?: { next?: string | null };
    };

    for (const row of json.data ?? []) {
      const name = row.attributes?.name ?? "";
      rows.push({ id: row.id, name });
    }

    const next = json.links?.next;
    url = next && typeof next === "string" && next.length > 0 ? next : null;
  }

  return rows;
}

/** Merge department names from `/departments` for ids absent in job `included` (edge cases). */
async function enrichDepartmentNames(
  jobs: TeamtailorJobRaw[],
  departmentNames: Map<string, string>,
): Promise<void> {
  const missing = new Set<string>();
  for (const job of jobs) {
    const id = job.relationships.department?.data?.id;
    if (id && !departmentNames.has(id)) {
      missing.add(id);
    }
  }
  if (missing.size === 0) return;

  const allDepartments = await fetchDepartments();
  for (const d of allDepartments) {
    if (missing.has(d.id) && d.name) {
      departmentNames.set(d.id, d.name);
    }
  }
}

export async function fetchJobOffers(): Promise<JobOffer[]> {
  const companyFieldId = process.env.TEAMTAILOR_COMPANY_CUSTOM_FIELD_API_ID;
  const headers = getTeamtailorHeaders();

  const [jobBundle, customFieldResponse] = await Promise.all([
    fetchAllJobsWithIncluded(headers),
    companyFieldId
      ? fetch(
          `${TEAMTAILOR_BASE_URL}/custom-fields/${companyFieldId}?include=custom-field-values`,
          { headers },
        )
      : Promise.resolve(null),
  ]);

  const { jobs, departmentNames, locationLabels } = jobBundle;
  await enrichDepartmentNames(jobs, departmentNames);

  const companyByCustomFieldValueId = new Map<string, string>();
  if (companyFieldId && customFieldResponse && customFieldResponse.ok) {
    const customFieldJson = (await customFieldResponse.json()) as {
      included?: TeamtailorCustomFieldValue[];
    };

    for (const fieldValue of customFieldJson.included ?? []) {
      const company = fieldValue.attributes?.value?.[0] ?? null;
      if (company) {
        companyByCustomFieldValueId.set(fieldValue.id, company);
      }
    }
  }

  return jobs.map((job) => {
    const customFieldRefs = job.relationships["custom-field-values"]?.data ?? [];
    const company =
      customFieldRefs
        .map((fieldRef) => companyByCustomFieldValueId.get(fieldRef.id))
        .find((value): value is string => Boolean(value)) ?? null;

    const departmentId = job.relationships.department?.data?.id ?? null;
    const locationIds = (job.relationships.locations?.data ?? []).map((loc) => loc.id);

    const departmentName = departmentId ? departmentNames.get(departmentId) ?? null : null;

    const locationsLabel = locationIds.length
      ? locationIds.map((id) => locationLabels.get(id) ?? id).join(", ")
      : "";

    return {
      id: job.id,
      title: job.attributes.title,
      departmentId,
      departmentName,
      locationIds,
      locationsLabel,
      url: job.links?.["careersite-job-url"] ?? null,
      applyUrl: job.links?.["careersite-job-apply-url"] ?? null,
      remoteStatus: job.attributes["remote-status"] ?? "none",
      minSalary: job.attributes["min-salary"] ?? null,
      maxSalary: job.attributes["max-salary"] ?? null,
      currency: job.attributes.currency ?? null,
      company,
    };
  });
}
