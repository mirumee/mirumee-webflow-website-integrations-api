import type { NextApiRequest, NextApiResponse } from "next";
import { getCorsHeaders } from "@/lib/cors";
import { fetchJobOffers } from "@/lib/teamtailor";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const origin = (req.headers.origin as string | null) ?? null;
  const corsHeaders = getCorsHeaders(origin);
  Object.entries(corsHeaders).forEach(([key, value]) => res.setHeader(key, value));

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const company = typeof req.query.company === "string" ? req.query.company.trim() : "";
    const offers = await fetchJobOffers();

    // Mirror mirumee-site behavior:
    // - no company query => return all offers
    // - company query => return only matching offers
    const filteredOffers = company
      ? offers.filter((offer) => offer.company?.toLowerCase() === company.toLowerCase())
      : offers;

    return res.status(200).json({
      count: filteredOffers.length,
      hasOffers: filteredOffers.length > 0,
      offers: filteredOffers,
    });
  } catch (error) {
    console.error("get-job-offers error:", error);
    const message =
      error instanceof Error ? error.message : error != null ? String(error) : "Unknown error";
    // Return a safe details field to help diagnose misconfiguration (missing env, auth, etc.).
    return res.status(500).json({ error: "Internal server error", details: message });
  }
}
