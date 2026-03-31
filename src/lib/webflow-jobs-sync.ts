import type { JobOffer } from "@/lib/teamtailor";

const WEBFLOW_API = "https://api.webflow.com/v2";

function getToken(): string {
  const t = process.env.WEBFLOW_API_TOKEN?.trim();
  if (!t) throw new Error("Missing WEBFLOW_API_TOKEN");
  return t;
}

function getCollectionId(): string {
  const id = process.env.WEBFLOW_JOBS_COLLECTION_ID?.trim();
  if (!id) throw new Error("Missing WEBFLOW_JOBS_COLLECTION_ID");
  return id;
}

export function formatSalaryDisplay(offer: JobOffer): string {
  const { minSalary, maxSalary, currency } = offer;
  if (!currency || (minSalary == null && maxSalary == null)) return "";
  const fmt = (n: number) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  if (minSalary != null && maxSalary != null) {
    return `${fmt(minSalary)} - ${fmt(maxSalary)} ${currency}`;
  }
  return `${fmt((minSalary ?? maxSalary) as number)} ${currency}`;
}

/**
 * Maps internal keys -> Webflow field slugs (CMS -> field -> API name in sidebar).
 * Default matches a Jobs collection with: Name, Slug, Department, Locations label,
 * Remote status, Apply URL (Link), TeamTailor ID, Description (Rich text), Min/Max salary, Currency.
 */
function fieldSlugMap(): Record<string, string> {
  const raw = process.env.WEBFLOW_JOBS_FIELD_MAP?.trim();
  if (raw) {
    try {
      return JSON.parse(raw) as Record<string, string>;
    } catch {
      throw new Error("WEBFLOW_JOBS_FIELD_MAP must be valid JSON");
    }
  }
  return {
    title: "name",
    id: "slug",
    department: "department",
    locationsLabel: "locations-label",
    remoteStatus: "remote-status",
    applyUrl: "apply-url",
    teamtailorId: "teamtailor-id",
    descriptionHtml: "description",
    minSalary: "min-salary",
    maxSalary: "max-salary",
    currency: "currency",
  };
}

const REQUIRED_KEYS = new Set(["title", "id"]);

function buildFieldData(offer: JobOffer): Record<string, unknown> {
  const map = fieldSlugMap();
  const computed: Record<string, unknown> = {
    title: offer.title,
    id: offer.id,
    department: offer.departmentName ?? offer.departmentId ?? "",
    locationsLabel: offer.locationsLabel,
    remoteStatus: offer.remoteStatus,
    applyUrl: (offer.applyUrl ?? "").trim(),
    teamtailorId: offer.id,
    descriptionHtml: offer.descriptionHtml,
    minSalary: offer.minSalary,
    maxSalary: offer.maxSalary,
    currency: offer.currency ?? "",
  };

  const fieldData: Record<string, unknown> = {};
  for (const [internalKey, webflowSlug] of Object.entries(map)) {
    const v = computed[internalKey];
    if (v === undefined) continue;

    if (REQUIRED_KEYS.has(internalKey)) {
      fieldData[webflowSlug] = v;
      continue;
    }

    if (v === "" || v === null) continue;

    if (internalKey === "minSalary" || internalKey === "maxSalary") {
      if (typeof v === "number" && !Number.isNaN(v)) {
        fieldData[webflowSlug] = v;
      }
      continue;
    }

    if (internalKey === "applyUrl" && typeof v === "string") {
      fieldData[webflowSlug] = v;
      continue;
    }

    if (internalKey === "descriptionHtml" && typeof v === "string") {
      fieldData[webflowSlug] = v;
      continue;
    }

    fieldData[webflowSlug] = v;
  }
  return fieldData;
}

type WebflowItemRow = {
  id: string;
  fieldData: { slug?: string; name?: string };
};

type ListResponse = {
  items: WebflowItemRow[];
  pagination: { total: number; limit: number; offset: number };
};

async function webflowFetch(path: string, init: RequestInit): Promise<Response> {
  return fetch(`${WEBFLOW_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${getToken()}`,
      "Content-Type": "application/json",
      ...init.headers,
    },
  });
}

export async function listAllItems(collectionId: string): Promise<WebflowItemRow[]> {
  const items: WebflowItemRow[] = [];
  let offset = 0;
  const limit = 100;
  let total = Infinity;

  while (offset < total) {
    const res = await webflowFetch(
      `/collections/${collectionId}/items?limit=${limit}&offset=${offset}`,
      { method: "GET" },
    );
    if (!res.ok) {
      throw new Error(`Webflow list items ${res.status}: ${await res.text()}`);
    }
    const body = (await res.json()) as ListResponse;
    items.push(...body.items);
    total = body.pagination?.total ?? items.length;
    offset += body.items.length;
    if (body.items.length === 0) break;
  }
  return items;
}

async function createLiveItem(collectionId: string, fieldData: Record<string, unknown>) {
  const res = await webflowFetch(`/collections/${collectionId}/items/live`, {
    method: "POST",
    body: JSON.stringify({
      items: [
        {
          isArchived: false,
          isDraft: false,
          fieldData,
        },
      ],
    }),
  });
  if (!res.ok) {
    throw new Error(`Webflow create live item ${res.status}: ${await res.text()}`);
  }
  const body = (await res.json()) as { items?: Array<{ id: string }>; id?: string };
  if (body.items?.[0]?.id) return { id: body.items[0].id };
  if (body.id) return { id: body.id };
  return { id: "" };
}

async function updateLiveItems(
  collectionId: string,
  patches: Array<{ id: string; fieldData: Record<string, unknown> }>,
) {
  const res = await webflowFetch(`/collections/${collectionId}/items/live`, {
    method: "PATCH",
    body: JSON.stringify({ items: patches }),
  });
  if (!res.ok) {
    throw new Error(`Webflow update live items ${res.status}: ${await res.text()}`);
  }
}

async function archiveLiveItem(collectionId: string, itemId: string) {
  const res = await webflowFetch(`/collections/${collectionId}/items/live`, {
    method: "PATCH",
    body: JSON.stringify({
      items: [{ id: itemId, isArchived: true }],
    }),
  });
  if (!res.ok) {
    throw new Error(`Webflow archive item ${res.status}: ${await res.text()}`);
  }
}

export type SyncJobsResult = {
  created: number;
  updated: number;
  archived: number;
  offerCount: number;
};

export async function syncJobOffersToWebflow(
  offers: JobOffer[],
  options: { archiveMissing?: boolean } = {},
): Promise<SyncJobsResult> {
  const collectionId = getCollectionId();
  const existing = await listAllItems(collectionId);
  const slugToId = new Map<string, string>();
  for (const row of existing) {
    const slug = row.fieldData?.slug;
    if (slug) slugToId.set(slug, row.id);
  }

  const ttSlugs = new Set(offers.map((o) => o.id));
  let created = 0;
  let updated = 0;
  let archived = 0;

  for (const offer of offers) {
    const fieldData = buildFieldData(offer);
    const existingId = slugToId.get(offer.id);
    if (existingId) {
      await updateLiveItems(collectionId, [{ id: existingId, fieldData }]);
      updated += 1;
    } else {
      await createLiveItem(collectionId, fieldData);
      created += 1;
    }
  }

  if (options.archiveMissing) {
    for (const row of existing) {
      const slug = row.fieldData?.slug;
      if (!slug) continue;
      if (ttSlugs.has(slug)) continue;
      await archiveLiveItem(collectionId, row.id);
      archived += 1;
    }
  }

  return {
    created,
    updated,
    archived,
    offerCount: offers.length,
  };
}
