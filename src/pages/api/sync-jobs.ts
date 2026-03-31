import type { NextApiRequest, NextApiResponse } from "next";
import { fetchJobOffers } from "@/lib/teamtailor";
import { syncJobOffersToWebflow } from "@/lib/webflow-jobs-sync";

/**
 * POST /api/sync-jobs
 * Pull jobs from Teamtailor (same rules as /api/get-job-offers) and upsert into Webflow CMS (live).
 *
 * Auth: header x-sync-secret must equal env SYNC_JOBS_SECRET.
 * Query: skipArchive=1 — keep Webflow items whose slug is no longer in Teamtailor (default: archive them).
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const secret = process.env.SYNC_JOBS_SECRET?.trim();
  const header = req.headers["x-sync-secret"];
  const sent = Array.isArray(header) ? header[0] : header;
  if (!secret || sent !== secret) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const skipArchive =
    req.query.skipArchive === "1" || req.query.skipArchive === "true";

  try {
    const offers = await fetchJobOffers();
    const result = await syncJobOffersToWebflow(offers, { archiveMissing: !skipArchive });
    return res.status(200).json({ ok: true, ...result });
  } catch (error) {
    console.error("sync-jobs error:", error);
    const message = error instanceof Error ? error.message : String(error);
    return res.status(500).json({ error: "Sync failed", details: message });
  }
}
