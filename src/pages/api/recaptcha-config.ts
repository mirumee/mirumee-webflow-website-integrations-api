import type { NextApiRequest, NextApiResponse } from "next";
import { getCorsHeaders } from "@/lib/cors";
import { getRecaptchaSiteKey } from "@/lib/recaptcha";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const origin = (req.headers.origin as string | null) ?? null;
  const corsHeaders = getCorsHeaders(origin);
  Object.entries(corsHeaders).forEach(([key, value]) =>
    res.setHeader(key, value),
  );

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  res.setHeader("Cache-Control", "public, max-age=300");
  return res.status(200).json({ siteKey: getRecaptchaSiteKey() ?? null });
}
