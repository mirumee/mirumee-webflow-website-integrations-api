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

export interface JobOffer {
  id: string;
  title: string;
  departmentId: string | null;
  locationIds: string[];
  url: string | null;
  applyUrl: string | null;
  remoteStatus: "none" | "hybrid" | "remote";
  minSalary: number | null;
  maxSalary: number | null;
  currency: string | null;
  company: string | null;
}

/** Max page size per Teamtailor jobs list docs (default is 10 if omitted). */
const JOBS_PAGE_SIZE = 30;

interface JobsListResponse {
  data?: TeamtailorJobRaw[];
  links?: { next?: string | null };
}

function buildInitialJobsUrl(): string {
  const params = new URLSearchParams({
    include: "department,locations,custom-field-values",
    "page[size]": String(JOBS_PAGE_SIZE),
    "page[number]": "1",
  });

  // https://docs.teamtailor.com/ — list defaults: filter[status]=published, filter[feed]=public.
  // Optional overrides when your postings are internal, unlisted, etc. (requires matching API key scope).
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

async function fetchAllJobs(headers: HeadersInit): Promise<TeamtailorJobRaw[]> {
  const jobs: TeamtailorJobRaw[] = [];
  let url: string | null = buildInitialJobsUrl();

  while (url) {
    const response = await fetch(url, { headers });
    if (!response.ok) {
      const payload = await response.text();
      throw new Error(`Teamtailor jobs request failed: ${response.status} ${payload}`);
    }
    const json = (await response.json()) as JobsListResponse;
    jobs.push(...(json.data ?? []));
    const next = json.links?.next;
    url = next && typeof next === "string" && next.length > 0 ? next : null;
  }

  return jobs;
}

export async function fetchJobOffers(): Promise<JobOffer[]> {
  const companyFieldId = process.env.TEAMTAILOR_COMPANY_CUSTOM_FIELD_API_ID;
  const headers = getTeamtailorHeaders();

  const [jobs, customFieldResponse] = await Promise.all([
    fetchAllJobs(headers),
    companyFieldId
      ? fetch(
          `${TEAMTAILOR_BASE_URL}/custom-fields/${companyFieldId}?include=custom-field-values`,
          { headers },
        )
      : Promise.resolve(null),
  ]);

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

    return {
      id: job.id,
      title: job.attributes.title,
      departmentId: job.relationships.department?.data?.id ?? null,
      locationIds: (job.relationships.locations?.data ?? []).map((loc) => loc.id),
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
